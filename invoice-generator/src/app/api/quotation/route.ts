import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
	try {
		const supabase = getSupabaseAdminClient();
		const { searchParams } = new URL(request.url);

		let query = supabase
			.from("quotations")
			.select("*")
			.order("created_at", { ascending: false });

		const quotation = searchParams.get("quotation");
		if (quotation) {
			query = query.ilike("quotation_no", `%${quotation}%`);
		}

		const industry = searchParams.get("industry");
		if (industry) {
			query = query.ilike("industry_name", `%${industry}%`);
		}

		const from = searchParams.get("from");
		if (from) {
			query = query.gte("quotation_date", from);
		}

		const to = searchParams.get("to");
		if (to) {
			query = query.lte("quotation_date", to);
		}

		const limit = searchParams.get("limit");
		if (limit) {
			query = query.limit(parseInt(limit, 10));
		}

		const { data, error } = await query;

		if (error) {
			console.error("Supabase error:", error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json(data || []);
	} catch (error: any) {
		console.error("Error fetching quotations:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to fetch quotations" },
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const supabase = getSupabaseAdminClient();
		const body = await request.json();

		const { data, error } = await supabase
			.from("quotations")
			.insert([
				{
					quotation_no: body.quotation_no,
					industry_name: body.industry_name,
					description: body.description,
					quotation_date: body.quotation_date || new Date().toISOString(),
				},
			])
			.select()
			.single();

		if (error) {
			console.error("Supabase insert error:", error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json(data);
	} catch (error: any) {
		console.error("Error creating quotation:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to create quotation" },
			{ status: 500 }
		);
	}
}
