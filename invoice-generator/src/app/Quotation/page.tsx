"use client";
import dynamic from "next/dynamic";
import React, { useState, useEffect } from "react";
import Generate from "./generate";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const Preview = dynamic(() => import("./preview"), { ssr: false });

export interface RowData {
	description: string;
	rate: string;
	isNote?: boolean;
}

export interface QuotationRecord {
	id: string;
	quotation_no: string | null;
	industry_name: string | null;
	description: RowData[];
	quotation_date: string;
	created_at: string;
}

const QuotationPage = () => {
	const [rows, setRows] = useState(
		Array(10)
			.fill(0)
			.map(() => ({ description: "", rate: "" }))
	);
	const [industryName, setIndustryName] = useState("");
	const [confirmedRows, setConfirmedRows] = useState(rows);
	const [confirmedIndustry, setConfirmedIndustry] = useState("");
	const [quotations, setQuotations] = useState<QuotationRecord[]>([]);

	const fetchQuotations = async () => {
		const supabase = getSupabaseBrowserClient();
		const { data, error } = await supabase
			.from("quotations")
			.select("*")
			.order("created_at", { ascending: false });
		if (data) {
			setQuotations(data);
		}
	};

	useEffect(() => {
		fetchQuotations();
	}, []);

	const handleConfirm = () => {
		setConfirmedRows([...rows]);
		setConfirmedIndustry(industryName);
	};

	const handleRegenerate = (q: QuotationRecord) => {
		setIndustryName(q.industry_name || "");
		const desc = Array.isArray(q.description) ? q.description : [];
		const newRows = [...desc];
		while (newRows.length < 10) {
			newRows.push({ description: "", rate: "" });
		}
		setRows(newRows);
	};

	const handleSaveQuotation = async () => {
		const supabase = getSupabaseBrowserClient();
		const quotation_no = `QT-${Date.now().toString().slice(-6)}`;
		
		const { data, error } = await supabase.from("quotations").insert([{
			quotation_no,
			industry_name: confirmedIndustry,
			description: confirmedRows,
			// let default CURRENT_DATE handle quotation_date
		}]).select();

		if (data) {
			fetchQuotations();
			alert("Quotation saved successfully!");
		} else {
			console.error("Error saving quotation", error);
			alert("Failed to save quotation.");
		}
	};

	return (
		<div className="flex flex-col lg:flex-row h-screen w-full items-start gap-5 lg:gap-7 p-4 lg:p-6 pt-20 lg:pt-6 overflow-y-auto lg:overflow-hidden bg-black text-white">
			<div className="w-full lg:w-[560px] xl:w-[620px] shrink-0">
				<Generate
					rows={rows}
					setRows={setRows}
					industryName={industryName}
					setIndustryName={setIndustryName}
					onConfirm={handleConfirm}
					pastQuotations={quotations}
				/>
			</div>
			<div className="w-full lg:flex-1 h-full overflow-y-auto">
				<Preview 
					rows={confirmedRows} 
					industryName={confirmedIndustry} 
					quotations={quotations}
					onSave={handleSaveQuotation}
					onRegenerate={handleRegenerate}
				/>
			</div>
		</div>
	);
};

export default QuotationPage;
