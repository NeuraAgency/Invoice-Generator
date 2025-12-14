"use client";
import Nav from "@/app/components/nav";
import React from "react";

interface RowData {
	description: string;
	rate: string;
	isNote?: boolean;
}

interface GenerateProps {
	rows: RowData[];
	setRows: React.Dispatch<React.SetStateAction<RowData[]>>;
	industryName: string;
	setIndustryName: React.Dispatch<React.SetStateAction<string>>;
	onConfirm: () => void;
}

const Generate: React.FC<GenerateProps> = ({
	rows,
	setRows,
	industryName,
	setIndustryName,
	onConfirm,
}) => {
	const handleRowChange = (
		idx: number,
		field: keyof RowData,
		value: string
	) => {
		setRows((prev) => {
			const next = [...prev];
			next[idx] = { ...next[idx], [field]: value };
			return next;
		});
	};

	const handleAddRow = () => {
		setRows((prev) => [...prev, { description: "", rate: "" }]);
	};

	const [noteText, setNoteText] = React.useState("");

	const handleAddNote = () => {
		const text = (noteText || "").toString();
		if (!text.trim()) return;
		setRows((prev) => [...prev, { description: text, rate: "", isNote: true }]);
		setNoteText("");
	};

	const handleDeleteRow = (idx: number) => {
		setRows((prev) => prev.filter((_, i) => i !== idx));
	};

	return (
		<div className="flex flex-col items-start px-6 py-4">
			<Nav href1="/Quotation" name1="Generate" href2="/Quotation" name2="Preview" />

			<div className="w-full mt-6 space-y-4">
				<div>
					<h2 className="font-semibold text-sm text-white">Industry Name</h2>
					<input
						type="text"
						value={industryName}
						onChange={(e) => setIndustryName(e.target.value)}
						className="mt-1 w-full max-w-sm text-sm border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white"
					/>
				</div>

				<div className="flex flex-col items-center">
					<table className="w-full max-w-[720px] min-w-[520px] border border-black text-left rounded-xl overflow-hidden text-xs">
						<thead className="bg-[var(--accent)] text-white text-sm ">
							<tr>
								<th className="px-2.5 py-2 border-b-2 border-r-2 border-black w-[12%]">
									S. No
								</th>
								<th className="px-2.5 py-2 border-b-2 border-r-2 border-black w-[68%]">
									Description
								</th>
								<th className="px-2.5 py-2 border-b-2 border-black w-[20%]">
									Rate
								</th>
								<th className="px-2.5 py-2 border-b-2 border-black text-center w-[12%]">
									Actions
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row, idx) => (
								<tr
									key={idx}
									className="bg-[#e9c6b1] text-black border-b-2 border-black h-7"
								>
									<td className="px-2.5 py-1 border-r-2 border-black text-center font-semibold">
										{idx + 1}
									</td>
									<td className="px-2.5 py-1 border-r-2 border-black">
										<input
											type="text"
											value={row.description}
											onChange={(e) =>
												handleRowChange(idx, "description", e.target.value)
											}
											className="w-full text-xs outline-none bg-transparent"
										/>
									</td>
									<td className="px-2.5 py-1 border-r-2 border-black">
										<input
											type="text"
											value={row.rate}
											onChange={(e) => handleRowChange(idx, "rate", e.target.value)}
											className="w-full text-xs outline-none bg-transparent"
										/>
									</td>
									<td className="px-2 py-1 flex justify-center gap-2">
										<button onClick={() => handleDeleteRow(idx)}>
											<img src="/delete.png" alt="Delete" className="w-4 h-4" />
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="mt-4 flex items-center gap-3">
				<button
					className="bg-[var(--accent)] py-2 px-4 rounded-lg text-xs font-medium text-white hover:opacity-90 transition"
					onClick={handleAddRow}
				>
					Add Row
				</button>
				<button
					className="bg-[var(--accent)] py-2 px-5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition"
					onClick={onConfirm}
				>
					Update Preview
				</button>
			</div>

			{/* Note input - adds a note row (renders with NOTE heading in preview) */}
			<div className="mt-4 flex items-start gap-3">
				<textarea
					value={noteText}
					onChange={(e) => setNoteText(e.target.value)}
					rows={2}
					placeholder="Add note here..."
					className="mt-1 w-full max-w-sm text-sm border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white"
				/>
				<button
					className="bg-[var(--accent)] py-2 px-4 rounded-lg text-xs font-medium text-white hover:opacity-90 transition h-[40px] self-end"
					onClick={handleAddNote}
				>
					Add Note
				</button>
			</div>
		</div>
	);
};

export default Generate;
