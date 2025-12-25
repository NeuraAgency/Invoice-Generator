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
		<div className="flex flex-col lg:flex-row h-screen w-full items-start gap-5 lg:gap-7 p-4 lg:p-6 pt-20 lg:pt-6 overflow-y-auto lg:overflow-hidden bg-black text-white">
			<div className="w-full lg:w-[560px] xl:w-[620px] shrink-0">
				<Generate
					rows={rows}
					setRows={setRows}
					industryName={industryName}
					setIndustryName={setIndustryName}
					onConfirm={handleConfirm}
				/>
			</div>
			<div className="w-full lg:flex-1">
				<Preview rows={confirmedRows} industryName={confirmedIndustry} />
			</div>
		</div>
	);
};

export default QuotationPage;
