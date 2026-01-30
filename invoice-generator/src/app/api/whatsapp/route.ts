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

export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Fetch all messages from whatsapp_messages table
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
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

    // Evolution Manager / webhook toolings sometimes wrap payload as { body: {...} }
    const raw: EvolutionWebhookEnvelope = await request.json();
    // Debug logging is noisy; keep it opt-in or non-production.
    if (process.env.NODE_ENV !== "production" || process.env.EVOLUTION_WEBHOOK_DEBUG === "true") {
      console.log("Evolution webhook payload:", raw);
    }

    const body = (raw?.body ?? raw) as any;
    const eventRaw = String(body?.event || "");
    const eventNorm = eventRaw.toLowerCase().replace(/_/g, ".");
    if (!body || eventNorm !== "messages.upsert") {
      return NextResponse.json({ ignore: true, reason: "Not a message event" }, { status: 200 });
    }

    const data = body?.data as any;
    if (!data) {
      return NextResponse.json({ ignore: true, reason: "Missing data" }, { status: 200 });
    }

    // Ignore outgoing messages
    if (data.key?.fromMe === true) {
      return NextResponse.json({ ignore: true, reason: "Outgoing message" }, { status: 200 });
    }

    const remoteJid = data.key?.remoteJid || "";
    const contactId = normalizeContactId(remoteJid);
    if (!contactId) {
      return NextResponse.json({ ignore: true, reason: "Missing contactId" }, { status: 200 });
    }

    const messageId: string = data.key?.id || `${Date.now()}`;
    const timestampIso = parseMaybeEpochSecondsToIso(data.messageTimestamp);

    const messageType: string = String(data.messageType || "");
    const messageTypeNorm = messageType.toLowerCase();
    const isImage = messageTypeNorm === "imagemessage";

    let messageText = extractTextMessage(data);
    if (!isImage && !messageText) {
      return NextResponse.json({ ignore: true, reason: "No text message" }, { status: 200 });
    }

    let filePath: string | null = null;
    let imageUrl: string | null = null;
    let mimeType: string | null = null;

    if (isImage) {
      const base64 = data?.message?.base64;
      if (!base64) {
        return NextResponse.json({ ignore: true, reason: "No image base64" }, { status: 200 });
      }

      mimeType = data?.message?.imageMessage?.mimetype || "image/jpeg";
      const ext = String(mimeType).includes("png") ? "png" : "jpg";
      filePath = `${contactId}/${messageId}.${ext}`;

      const buffer = Buffer.from(String(base64), "base64");

      const bucket = "whatsapp_images";
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      // Public URL (only works if bucket is public)
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      imageUrl = publicData?.publicUrl || null;

      // If caption exists, keep it as message text; otherwise default to empty
      messageText = messageText || "";
    }

    // Keep message retrieval as-is: we write into whatsapp_messages.
    // Note: your UI also expects a `read` flag; we set it if column exists.
    const baseRow = {
      id: messageId,
      contactId,
      event: eventRaw,
      instance: body.instance ?? null,
      message: messageText || null,
      created_at: timestampIso,
      read: false,
      // extra metadata (will be ignored by DB if columns don't exist; we fallback below if needed)
      sender: body.sender ?? null,
      messageType: messageType || null,
      filePath,
      imageUrl,
      mimeType,
      messageTimestamp: data.messageTimestamp ?? null,
      remoteJid: remoteJid || null,
    };

    // Prefer upsert to avoid duplicates on repeated webhooks.
    let writeError: unknown = null;
    const upsertRes = await supabase
      .from("whatsapp_messages")
      // onConflict requires a unique constraint; `id` is primary in types.
      .upsert(baseRow, { onConflict: "id" });

    writeError = upsertRes.error;

    // If schema doesn't have the extra columns, retry with minimal row.
    if (writeError) {
      console.error("Supabase upsert error (full row):", writeError);
      const minimalRow = {
        id: messageId,
        contactId,
        event: eventRaw,
        instance: body.instance ?? null,
        message: messageText || null,
        created_at: timestampIso,
      };

      const retryRes = await supabase.from("whatsapp_messages").upsert(minimalRow, { onConflict: "id" });
      if (retryRes.error) {
        console.error("Supabase upsert error (minimal row):", retryRes.error);
        return NextResponse.json({ error: retryRes.error.message }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        success: true,
        event: eventRaw,
        instance: body.instance ?? null,
        contactId,
        messageId,
        messageType: messageType || null,
        timestamp: data.messageTimestamp ?? null,
        filePath,
        imageUrl,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error handling Evolution webhook:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process webhook" },
      { status: 500 }
    );
  }
}
