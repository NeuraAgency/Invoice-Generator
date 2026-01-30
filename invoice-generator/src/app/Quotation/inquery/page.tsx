"use client";
import React, { useEffect, useMemo, useState } from "react";
import DatePicker from "@/app/components/DatePicker";
import Nav from "@/app/components/nav";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

type QuotationRow = {
	id: string;
	quotation_no: string | null;
	industry_name: string | null;
	description: any;
	quotation_date: string | null;
	created_at: string;
};

const QuotationInqueryPage = () => {
	const [quotationQuery, setQuotationQuery] = useState("");
	const [industryQuery, setIndustryQuery] = useState("");
	const [dateFrom, setDateFrom] = useState<Date | null>(null);
	const [dateTo, setDateTo] = useState<Date | null>(null);
	const [results, setResults] = useState<QuotationRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showFilterModal, setShowFilterModal] = useState(false);
	const [tempFilters, setTempFilters] = useState<{
		quotation: string;
		industry: string;
		from: Date | null;
		to: Date | null;
	}>({ quotation: "", industry: "", from: null, to: null });

	const qs = useMemo(() => {
		const params = new URLSearchParams();
		if (quotationQuery.trim()) params.set("quotation", quotationQuery.trim());
		if (industryQuery.trim()) params.set("industry", industryQuery.trim());
		const fmt = (d: Date) => d.toISOString().split("T")[0];
		if (dateFrom) params.set("from", fmt(dateFrom));
		if (dateTo) params.set("to", fmt(dateTo));
		params.set("limit", "50");
		return params.toString();
	}, [quotationQuery, industryQuery, dateFrom, dateTo]);

	const openFilterModal = () => {
		setTempFilters({
			quotation: quotationQuery,
			industry: industryQuery,
			from: dateFrom,
			to: dateTo,
		});
		setShowFilterModal(true);
	};

	const applyFilters = () => {
		setQuotationQuery(tempFilters.quotation);
		setIndustryQuery(tempFilters.industry);
		setDateFrom(tempFilters.from);
		setDateTo(tempFilters.to);
		setShowFilterModal(false);
	};

	useEffect(() => {
		const controller = new AbortController();
		const id = setTimeout(async () => {
			try {
				setLoading(true);
				setError(null);
				const res = await fetch(`/api/quotation?${qs}`, {
					signal: controller.signal,
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				setResults(Array.isArray(data) ? data : []);
			} catch (e: any) {
				if (e?.name !== "AbortError")
					setError(e?.message || "Failed to load quotations");
			} finally {
				setLoading(false);
			}
		}, 250);
		return () => {
			controller.abort();
			clearTimeout(id);
		};
	}, [qs]);

	const toItems = (desc: any) => {
		if (Array.isArray(desc)) return desc;
		if (!desc) return [];
		return [desc];
	};

	const downloadPdf = async (row: QuotationRow) => {
		const items = toItems(row.description);
		const pdfDoc = await PDFDocument.create();
		const page = pdfDoc.addPage([595.28, 841.89]);
		const { width, height } = page.getSize();
		const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
		const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

		const drawText = (
			text: string,
			x: number,
			y: number,
			size = 12,
			bold = false,
			color = rgb(0, 0, 0)
		) => {
			page.drawText(text, {
				x,
				y,
				size,
				font: bold ? fontBold : font,
				color: color,
			});
		};

		const marginX = 40;
		const contentWidth = width - marginX * 2;

		try {
			const logoBytes = await fetch("/zumech.png").then((r) =>
				r.arrayBuffer()
			);
			const logoImage = await pdfDoc.embedPng(logoBytes);
			const logoWidth = Math.min(420, contentWidth);
			const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
			const logoX = marginX + (contentWidth - logoWidth) / 2;
			page.drawImage(logoImage, {
				x: logoX,
				y: height - logoHeight - 10,
				width: logoWidth,
				height: logoHeight,
			});

			const contactText = "Contact#: 0309 2308078";
			const emailText = "Email: z.ushahid@gmail.com";
			const textWidthContact = fontBold.widthOfTextAtSize(contactText, 10);
			const textWidthEmail = fontBold.widthOfTextAtSize(emailText, 10);

			drawText(
				contactText,
				(width - textWidthContact) / 2,
				height - logoHeight - 30,
				10,
				true
			);
			drawText(
				emailText,
				(width - textWidthEmail) / 2,
				height - logoHeight - 46,
				10,
				true
			);
		} catch {
			drawText("Z.U MECHANICAL WORKS", marginX, height - 60, 22, true);
		}

		const dateStr = row.quotation_date
			? new Date(row.quotation_date).toLocaleDateString()
			: new Date(row.created_at).toLocaleDateString();
		drawText(`DATE: ${dateStr}`, marginX, height - 190, 12);

		const quoteTitle = "QUOTATION";
		const quoteSize = 32;
		const quoteWidth = fontBold.widthOfTextAtSize(quoteTitle, quoteSize);
		const quoteX = (width - quoteWidth) / 2;
		const quoteY = height - 240;
		drawText(quoteTitle, quoteX, quoteY, quoteSize, true);

		drawText(
			`Industry Name: ${row.industry_name || "_______________________"}`,
			marginX,
			height - 300,
			25,
			true
		);

		const tableTop = height - 350;
		const tableLeft = marginX;
		const tableRight = width - marginX;
		const tableWidth = tableRight - tableLeft;
		const headerHeight = 24;
		const rowHeight = 22;
		const totalRows = Math.max(items.length, 9);
		const tableHeight = headerHeight + totalRows * rowHeight;
		const colSNo = 50;
		const colDesc = tableWidth - colSNo - 110;
		const colRate = 110;

		page.drawRectangle({
			x: tableLeft,
			y: tableTop - tableHeight,
			width: tableWidth,
			height: tableHeight,
			borderColor: rgb(0, 0, 0),
			borderWidth: 1,
			color: rgb(1, 1, 1),
		});
		page.drawRectangle({
			x: tableLeft,
			y: tableTop - headerHeight,
			width: tableWidth,
			height: headerHeight,
			color: rgb(0, 0, 0),
		});

		drawText(
			"S#",
			tableLeft + 15,
			tableTop - headerHeight + 7,
			12,
			true,
			rgb(1, 1, 1)
		);
		drawText(
			"Description",
			tableLeft + colSNo + colDesc / 2 - 30,
			tableTop - headerHeight + 7,
			12,
			true,
			rgb(1, 1, 1)
		);
		drawText(
			"Rate per peace",
			tableLeft + colSNo + colDesc + 15,
			tableTop - headerHeight + 7,
			12,
			true,
			rgb(1, 1, 1)
		);

		const xCol1 = tableLeft + colSNo;
		const xCol2 = tableLeft + colSNo + colDesc;

		page.drawLine({
			start: { x: xCol1, y: tableTop - tableHeight },
			end: { x: xCol1, y: tableTop },
			color: rgb(0, 0, 0),
			thickness: 1,
		});
		page.drawLine({
			start: { x: xCol2, y: tableTop - tableHeight },
			end: { x: xCol2, y: tableTop },
			color: rgb(0, 0, 0),
			thickness: 1,
		});
		page.drawLine({
			start: { x: tableLeft, y: tableTop - headerHeight },
			end: { x: tableRight, y: tableTop - headerHeight },
			color: rgb(0, 0, 0),
			thickness: 1,
		});

		let cursorY = tableTop - headerHeight - 15;
		let displayIdx = 0;
		for (let i = 0; i < totalRows; i++) {
			const r = items[i];
			const hasDescription = !!(r && (r.description || "").toString().trim());
			const isNote = !!(r && r.isNote);
			if (isNote) {
				drawText("NOTE", tableLeft + 14, cursorY, 11, true);
				drawText(r.description || "", tableLeft + colSNo + 10, cursorY, 11);
			} else if (hasDescription) {
				displayIdx += 1;
				drawText(String(displayIdx), tableLeft + 14, cursorY, 11, true);
				if (r) {
					drawText(r.description || "", tableLeft + colSNo + 10, cursorY, 11);
					drawText(
						r.rate || "",
						tableLeft + colSNo + colDesc + 12,
						cursorY,
						11
					);
				}
			}
			page.drawLine({
				start: { x: tableLeft, y: cursorY - 6 },
				end: { x: tableRight, y: cursorY - 6 },
				color: rgb(0, 0, 0),
				thickness: 0.7,
			});
			cursorY -= rowHeight;
		}

		const signX = width - marginX - 220;
		const signY = 60;
		const label = "Signature:";
		const labelSize = 10;
		const labelWidth = font.widthOfTextAtSize(label, labelSize);
		try {
			const sigBytes = await fetch("/sign.png").then((r) => r.arrayBuffer());
			const sigImage = await pdfDoc.embedPng(sigBytes);
			const maxSigWidth = 140;
			const sigHeight = (sigImage.height / sigImage.width) * maxSigWidth;
			drawText(label, signX, signY, labelSize);
			const imgX = signX + labelWidth + 8;
			const imgY = signY - sigHeight / 2 + labelSize / 2;
			page.drawImage(sigImage, {
				x: imgX,
				y: imgY,
				width: maxSigWidth,
				height: sigHeight,
			});
		} catch {
			drawText(label, signX, signY, labelSize);
			const lineStartX = signX + labelWidth + 8;
			page.drawLine({
				start: { x: lineStartX, y: signY + 4 },
				end: { x: lineStartX + 140, y: signY + 4 },
				color: rgb(0, 0, 0),
				thickness: 0.8,
			});
		}

		const pdfBytes = await pdfDoc.save();
		const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `Quotation_${row.quotation_no || row.id}.pdf`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="flex flex-col min-h-screen w-full items-start p-4 lg:p-6 pt-20 lg:pt-6 bg-black text-white overflow-y-auto">
			<Nav href1="/Quotation" name1="Generate" href2="/Quotation/inquery" name2="Inquiry" />

			<div className="w-full mt-6">
				<div className="flex items-center gap-3 mb-6">
					<button
						onClick={openFilterModal}
						className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white px-6 py-2 rounded-lg font-semibold transition-all"
					>
						Filters
					</button>
					{(quotationQuery || industryQuery || dateFrom || dateTo) && (
						<button
							onClick={() => {
								setQuotationQuery("");
								setIndustryQuery("");
								setDateFrom(null);
								setDateTo(null);
							}}
							className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-all"
						>
							Clear
						</button>
					)}
				</div>

				{loading && (
					<div className="text-center py-8 text-white/60">Loading...</div>
				)}
				{error && <div className="text-center py-8 text-red-500">{error}</div>}

				{!loading && !error && results.length === 0 && (
					<div className="text-center py-12 text-white/40">
						No quotations found
					</div>
				)}

				{!loading && !error && results.length > 0 && (
					<div className="overflow-x-auto">
						<table className="w-full border-collapse bg-white/5 border border-white/10 rounded-xl overflow-hidden">
							<thead className="bg-[var(--accent)] text-white">
								<tr>
									<th className="px-4 py-3 text-left">Quotation #</th>
									<th className="px-4 py-3 text-left">Industry</th>
									<th className="px-4 py-3 text-left">Date</th>
									<th className="px-4 py-3 text-left">Items</th>
									<th className="px-4 py-3 text-center">Actions</th>
								</tr>
							</thead>
							<tbody>
								{results.map((row) => {
									const items = toItems(row.description);
									const dateStr = row.quotation_date
										? new Date(row.quotation_date).toLocaleDateString()
										: new Date(row.created_at).toLocaleDateString();
									return (
										<tr
											key={row.id}
											className="border-b border-white/10 hover:bg-white/5 transition-colors"
										>
											<td className="px-4 py-3 font-mono">
												{row.quotation_no || "—"}
											</td>
											<td className="px-4 py-3">{row.industry_name || "—"}</td>
											<td className="px-4 py-3 text-sm text-white/70">
												{dateStr}
											</td>
											<td className="px-4 py-3 text-sm text-white/70">
												{items.length} item{items.length !== 1 ? "s" : ""}
											</td>
											<td className="px-4 py-3 text-center">
												<button
													onClick={() => downloadPdf(row)}
													className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white px-4 py-1.5 rounded text-sm font-medium transition-all"
												>
													Download PDF
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Filter Modal */}
			{showFilterModal && (
				<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
						<h2 className="text-xl font-bold text-white">Filter Quotations</h2>

						<div>
							<label className="block text-sm font-semibold text-white/60 mb-2">
								Quotation Number
							</label>
							<input
								type="text"
								value={tempFilters.quotation}
								onChange={(e) =>
									setTempFilters({ ...tempFilters, quotation: e.target.value })
								}
								className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
								placeholder="Enter quotation number"
							/>
						</div>

						<div>
							<label className="block text-sm font-semibold text-white/60 mb-2">
								Industry Name
							</label>
							<input
								type="text"
								value={tempFilters.industry}
								onChange={(e) =>
									setTempFilters({ ...tempFilters, industry: e.target.value })
								}
								className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
								placeholder="Enter industry name"
							/>
						</div>

						<div>
							<label className="block text-sm font-semibold text-white/60 mb-2">
								Date From
							</label>
							<DatePicker
								value={tempFilters.from}
								onChange={(d) => setTempFilters({ ...tempFilters, from: d })}
							/>
						</div>

						<div>
							<label className="block text-sm font-semibold text-white/60 mb-2">
								Date To
							</label>
							<DatePicker
								value={tempFilters.to}
								onChange={(d) => setTempFilters({ ...tempFilters, to: d })}
							/>
						</div>

						<div className="flex gap-3 pt-4">
							<button
								onClick={() => setShowFilterModal(false)}
								className="flex-1 px-4 py-2 border border-white/10 text-white/70 rounded-lg hover:bg-white/5 transition-all font-semibold"
							>
								Cancel
							</button>
							<button
								onClick={applyFilters}
								className="flex-1 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-white rounded-lg transition-all font-semibold"
							>
								Apply
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default QuotationInqueryPage;
