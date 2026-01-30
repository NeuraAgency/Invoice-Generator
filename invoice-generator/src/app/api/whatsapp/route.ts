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

    // Save to whatsapp_messages - ONLY columns that exist in schema
    const row = {
      id: messageId,
      contactId: contactId || null,
      message: messageText || null,
      event: eventRaw || null,
      instance: body?.instance ?? null,
      created_at: timestampIso || new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from("whatsapp_messages")
      .upsert(row, { onConflict: "id" });

    if (insertError) {
      console.error("Database insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
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
