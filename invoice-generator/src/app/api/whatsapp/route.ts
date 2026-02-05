import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseServer";

type EvolutionWebhookEnvelope = {
  body?: unknown;
} & Record<string, unknown>;

function normalizeContactId(remoteJid: string | null | undefined): string {
  if (!remoteJid) return "";
  return String(remoteJid)
    .replace("@s.whatsapp.net", "")
    .replace("@g.us", "");
}

function parseMaybeEpochSecondsToIso(ts: unknown): string | null {
  if (ts == null) return null;
  const asNum = typeof ts === "number" ? ts : Number(ts);
  if (Number.isFinite(asNum) && asNum > 0) {
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  const d = new Date(String(ts));
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

function extractTextMessage(data: unknown): string {
  const d = data as any;
  return (
    d?.message?.conversation ||
    d?.message?.extendedTextMessage?.text ||
    d?.message?.imageMessage?.caption ||
    ""
  );
}

function extractFromMe(raw: unknown, body: unknown, data: unknown): boolean | null {
  const r = raw as any;
  const b = body as any;
  const d = data as any;
  const v =
    d?.key?.fromMe ??
    b?.data?.key?.fromMe ??
    r?.data?.key?.fromMe ??
    r?.body?.data?.key?.fromMe;
  return typeof v === "boolean" ? v : null;
}

function extractPushName(raw: unknown, body: unknown, data: unknown): string | null {
  const r = raw as any;
  const b = body as any;
  const d = data as any;
  const v = d?.pushName ?? b?.pushName ?? b?.data?.pushName ?? r?.pushName ?? r?.body?.pushName;
  return typeof v === "string" && v.trim() ? v : null;
}

function extractSender(raw: unknown, body: unknown, data: unknown): string | null {
  const r = raw as any;
  const b = body as any;
  const d = data as any;

  const candidates = [
    // sometimes n8n/evolution sends sender at the envelope level
    b?.sender,
    r?.sender,
    r?.body?.sender,
    // group participant ids
    d?.key?.participantAlt,
    d?.key?.participant,
    // other possible shapes
    d?.sender,
    b?.data?.sender,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }

  return null;
}

function normalizeSenderId(sender: string | null): string | null {
  if (!sender) return null;
  return String(sender)
    .replace("@s.whatsapp.net", "")
    .replace("@lid", "")
    .replace("@g.us", "")
    .trim();
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();

    const url = new URL(_request.url);
    const contactId = url.searchParams.get("contactId");
    const order = (url.searchParams.get("order") || "desc").toLowerCase();
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : null;
    const ascending = order === "asc";
    
    // Fetch all messages from whatsapp_messages table
    let q = supabase.from("whatsapp_messages").select("*");
    if (contactId) {
      q = q.eq("contactId", contactId);
    }
    q = q.order("created_at", { ascending });
    if (limit && Number.isFinite(limit) && limit > 0) {
      q = q.limit(Math.min(10_000, Math.floor(limit)));
    }

    const { data, error } = await q;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const messages = (data || []) as any[];

    // Filter out "poor" duplicates (missing sender/pushName/fromMe) when a richer
    // row exists for the same contactId+message within a short time window.
    const parseMs = (v: any) => {
      const ms = new Date(String(v || "")).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };
    const hasMeta = (m: any) =>
      m?.sender != null || m?.pushName != null || typeof m?.fromMe === "boolean";

    const sorted = [...messages].sort((a, b) => parseMs(a.created_at) - parseMs(b.created_at));
    const result: any[] = [];
    const lastIndexByKey = new Map<string, number>();
    const lastRichByKey = new Map<string, { ms: number; index: number }>();
    const WINDOW_MS = 30_000;

    for (const m of sorted) {
      const key = `${m?.contactId ?? ""}|${m?.message ?? ""}`;
      const ms = parseMs(m?.created_at);
      const rich = hasMeta(m);

      const lastRich = lastRichByKey.get(key);
      if (!rich && lastRich && Math.abs(ms - lastRich.ms) <= WINDOW_MS) {
        continue;
      }

      const existingIndex = lastIndexByKey.get(key);
      if (rich && existingIndex != null) {
        const existing = result[existingIndex];
        if (existing && !hasMeta(existing) && Math.abs(ms - parseMs(existing.created_at)) <= WINDOW_MS) {
          result[existingIndex] = m;
          lastRichByKey.set(key, { ms, index: existingIndex });
          continue;
        }
      }

      const newIndex = result.push(m) - 1;
      lastIndexByKey.set(key, newIndex);
      if (rich) lastRichByKey.set(key, { ms, index: newIndex });
    }

    // Return the requested order
    result.sort((a, b) => (ascending ? parseMs(a.created_at) - parseMs(b.created_at) : parseMs(b.created_at) - parseMs(a.created_at)));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching WhatsApp messages:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();

    // Evolution sends an array with webhook data
    let raw: any = await request.json();
    console.log("Evolution webhook received:", JSON.stringify(raw, null, 2));

    // If it's an array, take the first element
    if (Array.isArray(raw)) {
      raw = raw[0];
    }

    // Extract the body (Evolution wraps data in body property)
    const body = raw?.body || raw;
    const data = body?.data;

    if (!data) {
      console.log("No data in webhook, ignoring");
      return NextResponse.json({ success: true, ignored: true }, { status: 200 });
    }

    // Extract basic info - NO FILTERS, save everything
    const eventRaw = String(body?.event || "");
    const remoteJid = data?.key?.remoteJid || "";
    const contactId = normalizeContactId(remoteJid);
    const messageId: string = data?.key?.id || `msg_${Date.now()}`;
    const timestampIso = parseMaybeEpochSecondsToIso(data?.messageTimestamp);

    const fromMe = extractFromMe(raw, body, data);
    const pushName = extractPushName(raw, body, data);
    let sender = extractSender(raw, body, data);

    // Fallback: for direct chats, remoteJid is the other party.
    if (!sender && typeof remoteJid === "string" && remoteJid.endsWith("@s.whatsapp.net")) {
      sender = remoteJid;
    }

    sender = normalizeSenderId(sender);
    
    // Extract message text from any source
    let messageText = extractTextMessage(data);

    // Handle image messages - upload to bucket
    const messageType: string = String(data?.messageType || "");
    const isImage = messageType === "imageMessage";

    if (isImage && data?.message?.base64) {
      const base64 = data.message.base64;
      const mimeType = data?.message?.imageMessage?.mimetype || "image/jpeg";
      const ext = String(mimeType).includes("png") ? "png" : "jpg";
      const filePath = `${contactId}/${messageId}.${ext}`;

      const buffer = Buffer.from(String(base64), "base64");
      const bucket = "whatsapp_images";
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error("Image upload error:", uploadError);
      } else {
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        const imageUrl = publicData?.publicUrl || "";
        console.log("Image uploaded:", imageUrl);
        // Add image URL to message text
        messageText = messageText ? `${messageText}\n${imageUrl}` : imageUrl;
      }
    }

    // Save to whatsapp_messages (matches the new schema: sender/pushName/fromMe)
    // Note: id is uuid with default, so we don't provide an id here.
    const createdAtIso = timestampIso || new Date().toISOString();
    const row = {
      contactId: contactId || null,
      message: messageText || null,
      event: eventRaw || null,
      instance: body?.instance ?? null,
      created_at: createdAtIso,
      status: fromMe === true ? true : false,
      sender,
      pushName,
      fromMe,
    };

    // Deduplicate: Evolution/n8n can deliver the same message twice (one "rich", one "poor").
    // If a near-identical record exists, update it with missing fields instead of inserting a duplicate.
    if (row.contactId && row.message) {
      const baseMs = new Date(createdAtIso).getTime();
      const ms = Number.isFinite(baseMs) ? baseMs : Date.now();
      const windowStart = new Date(ms - 60_000).toISOString();
      const windowEnd = new Date(ms + 60_000).toISOString();

      let q = supabase
        .from("whatsapp_messages")
        .select("id, sender, pushName, fromMe, created_at")
        .eq("contactId", row.contactId)
        .eq("message", row.message)
        .gte("created_at", windowStart)
        .lte("created_at", windowEnd)
        .order("created_at", { ascending: false })
        .limit(1);

      if (row.sender) {
        q = q.eq("sender", row.sender);
      }

      const { data: existing } = await q.maybeSingle();
      if (existing?.id) {
        const patch: any = {};
        if (existing.sender == null && row.sender != null) patch.sender = row.sender;
        if (existing.pushName == null && row.pushName != null) patch.pushName = row.pushName;
        if (existing.fromMe == null && row.fromMe != null) patch.fromMe = row.fromMe;
        if (Object.keys(patch).length > 0) {
          const { error: updErr } = await supabase
            .from("whatsapp_messages")
            .update(patch)
            .eq("id", existing.id);
          if (updErr) {
            console.error("Database update error (dedupe merge):", updErr);
          }
        }

        return NextResponse.json(
          {
            success: true,
            id: existing.id,
            messageId,
            contactId,
            saved: true,
            deduped: true,
          },
          { status: 200 }
        );
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert(row)
      .select("id")
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        id: inserted?.id ?? null,
        messageId,
        contactId,
        saved: true
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process webhook" },
      { status: 500 }
    );
  }
}
