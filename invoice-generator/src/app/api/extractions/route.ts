import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../../lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const gp = searchParams.get("gp") ?? "";
    const limit = Number(searchParams.get("limit") ?? "10");

    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from("document_extractions")
      .select("id, document_no, document_date, items, URL")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (gp) {
      query = query.ilike("document_no", `${gp}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}