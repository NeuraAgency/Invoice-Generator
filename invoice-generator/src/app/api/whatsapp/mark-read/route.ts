import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    const { contactId } = await request.json();

    if (!contactId) {
      return NextResponse.json(
        { error: "contactId is required" },
        { status: 400 }
      );
    }

    // Mark all messages from this contact as read (both false and null status)
    const { error } = await supabase
      .from("whatsapp_messages")
      .update({ status: true })
      .eq("contactId", contactId)
      .or("status.eq.false,status.is.null");

    if (error) {
      console.error("Error marking messages as read:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in mark-read endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
