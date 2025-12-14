"use client";
import dynamic from "next/dynamic";
import React, { useState } from "react";
import Generate from "./generate";

const Preview = dynamic(() => import("./preview"), { ssr: false });

const QuotationPage = () => {
	const [rows, setRows] = useState(
		Array(10)
			.fill(0)
			.map(() => ({ description: "", rate: "" }))
	);
	const [industryName, setIndustryName] = useState("");
	const [confirmedRows, setConfirmedRows] = useState(rows);
	const [confirmedIndustry, setConfirmedIndustry] = useState("");

	const handleConfirm = () => {
		setConfirmedRows([...rows]);
		setConfirmedIndustry(industryName);
	};

	return (
		<div className="flex h-screen w-full items-start gap-5 lg:gap-7 p-4 lg:p-6 overflow-hidden">
			<div className="w-[560px] xl:w-[620px]">
				<Generate
					rows={rows}
					setRows={setRows}
					industryName={industryName}
					setIndustryName={setIndustryName}
					onConfirm={handleConfirm}
				/>
			</div>
			<div className="flex-1">
				<Preview rows={confirmedRows} industryName={confirmedIndustry} />
			</div>
		</div>
	);
};

export default QuotationPage;
