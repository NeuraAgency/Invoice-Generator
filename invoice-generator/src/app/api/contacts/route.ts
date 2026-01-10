import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Fetch all contacts
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contact, company_name, User_name, contactId } = body;

    if (!contact) {
      return NextResponse.json(
        { error: "Contact is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    
    // Insert new contact
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        contact,
        company_name,
        User_name,
        contactId
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create contact" },
      { status: 500 }
    );
  }
}
