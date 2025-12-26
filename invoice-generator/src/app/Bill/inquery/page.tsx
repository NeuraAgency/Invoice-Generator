"use client";
import React, { useEffect, useMemo, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Nav from "@/app/components/nav";

type InvoiceRow = {
	id?: any;
	billno: number | string | null;
	challanno: number | null;
	created_at: string;
	Description: any;
	status?: boolean;
};

const InvoiceInqueryPage = () => {
	const [billQuery, setBillQuery] = useState("");
	const [challanQuery, setChallanQuery] = useState("");
	const [results, setResults] = useState<InvoiceRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pendingBills, setPendingBills] = useState<Set<string | number>>(new Set());

	const qs = useMemo(() => {
		const params = new URLSearchParams();
		if (billQuery.trim()) params.set("bill", billQuery.trim());
		if (challanQuery.trim()) params.set("challan", challanQuery.trim());
		params.set("limit", "50");
		return params.toString();
	}, [billQuery, challanQuery]);

	useEffect(() => {
		const controller = new AbortController();
		const id = setTimeout(async () => {
			try {
				setLoading(true);
				setError(null);
				const res = await fetch(`/api/invoice?${qs}`, { signal: controller.signal });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				setResults(Array.isArray(data) ? data : []);
			} catch (e: any) {
				if (e?.name !== "AbortError") setError(e?.message || "Failed to load invoices");
			} finally {
				setLoading(false);
			}
		}, 250);
		return () => {
			controller.abort();
			clearTimeout(id);
		};
	}, [qs]);

	const togglePaid = async (row: InvoiceRow) => {
		if (row?.billno == null) return;
		const next = !Boolean(row.status);
		const key = String(row.billno);
		setPendingBills((prev) => new Set(prev).add(key));
		try {
			const res = await fetch("/api/invoice", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ billno: row.billno, status: next }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const updated = await res.json();
			setResults((prev) => prev.map((r) => (String(r.billno) === key ? { ...r, status: updated?.status ?? next } : r)));
		} catch (e) {
		} finally {
			setPendingBills((prev) => {
				const n = new Set(prev);
				n.delete(key);
				return n;
			});
		}
	};

	const toItems = (desc: any) => {
		if (Array.isArray(desc)) return desc;
		if (!desc) return [];
		return [desc];
	};

	const toRowData = (raw: any) => {
		const arr = toItems(raw);
		return arr.map((d: any) => {
			const qty = String(d?.qty ?? d?.quantity ?? "");
			const description = String(d?.description ?? d?.materialDescription ?? "");
			let perPiece = "";
			if (d?.rate != null) perPiece = String(d.rate);
			else if (d?.amount != null && (d?.qty ?? d?.quantity)) {
				const q = Number((d?.qty ?? d?.quantity) || 0);
				const a = Number(d?.amount || 0);
				perPiece = q ? String((a / q).toFixed(2)) : String(a);
			}
			return { qty, description, amount: perPiece };
		});
	};

	const generateInvoicePdfBytes = async (
		rows: { qty: string; description: string; amount: string }[],
		meta: { bill?: string; challan?: string; gp?: string }
	) => {
		const pdfDoc = await PDFDocument.create();
		const page = pdfDoc.addPage([595.28, 841.89]);
		const { width, height } = page.getSize();
		const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
		const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
		const drawText = (t: string, x: number, y: number, s = 12, b = false, c = rgb(0, 0, 0)) => {
			page.drawText(t, {
				x,
				y,
				size: s,
				font: b ? fontBold : font,
				color: c,
			});
		};
		const marginLeft = 40,
			marginRight = 40,
			contentWidth = width - marginLeft - marginRight;
		try {
			const logoBytes = await fetch("/zumech.png").then((r) => r.arrayBuffer());
			const logoImage = await pdfDoc.embedPng(logoBytes);
			const w = Math.min(420, contentWidth);
			const h = (logoImage.height / logoImage.width) * w;
			const lx = marginLeft + (contentWidth - w) / 2;
			const ly = height - 20 - h;
			page.drawImage(logoImage, { x: lx, y: ly, width: w, height: h });
		} catch {}
		const topAfterLogo = height - 160;
		const leftColX = marginLeft;
		const rightColX = width - marginRight - 90;
		const gap = 13;
		const small = 10;
		drawText("Email: z.ushahid@gmail.com", leftColX, topAfterLogo, small);
		drawText("Contact: 03092308078", leftColX, topAfterLogo - gap, small);
		drawText(`Bill No: ${meta.bill ?? ""}`, leftColX, topAfterLogo - 2 * gap, small);
		drawText(`Challan No: ${meta.challan ?? ""}`, leftColX, topAfterLogo - 3 * gap, small);
		drawText(`Date: ${new Date().toLocaleDateString()}`, leftColX, topAfterLogo - 4 * gap, small);
		drawText(`P.O. No: ${"00000"}`, rightColX, topAfterLogo, small);
		drawText(`G.P. No: ${meta.gp ?? ""}`, rightColX, topAfterLogo - gap, small);
		const storedCompany = typeof window !== "undefined" ? localStorage.getItem("invoiceCompanyName") : null;
		const Company_Name = storedCompany || "Mekotex P.V.T Limited";
		const companySize = 24,
			titleSize = 25;
		drawText(`Company Name: ${Company_Name}`, marginLeft, topAfterLogo - 110, companySize, true);
		drawText("Invoice", marginLeft + contentWidth / 2 - 40, topAfterLogo - 160, titleSize, true);
		const tableTop = topAfterLogo - 180;
		const tableLeft = marginLeft;
		const tableRight = width - marginRight;
		const tableWidth = tableRight - tableLeft;
		const headerH = 24,
			rowH = 22,
			colQtyW = 60,
			colAmtW = 90,
			colDescW = tableWidth - colQtyW - colAmtW;
		page.drawRectangle({ x: tableLeft, y: tableTop - headerH, width: tableWidth, height: headerH, color: rgb(0, 0, 0) });
		const headerY = tableTop - headerH + 7;
		drawText("Qty", tableLeft + 10, headerY, 11, true, rgb(1, 1, 1));
		drawText("Description", tableLeft + colQtyW + 10, headerY, 11, true, rgb(1, 1, 1));
		drawText("Amount", tableLeft + colQtyW + colDescW + 10, headerY, 11, true, rgb(1, 1, 1));
		const totalRows = Math.max(rows.length, 6);
		const tableHeight = headerH + totalRows * rowH;
		const tableBottom = tableTop - tableHeight;
		page.drawRectangle({ x: tableLeft, y: tableBottom, width: tableWidth, height: tableHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
		const xCol1 = tableLeft + colQtyW;
		const xCol2 = tableLeft + colQtyW + colDescW;
		page.drawLine({ start: { x: xCol1, y: tableBottom }, end: { x: xCol1, y: tableTop }, color: rgb(0, 0, 0), thickness: 1 });
		page.drawLine({ start: { x: xCol2, y: tableBottom }, end: { x: xCol2, y: tableTop }, color: rgb(0, 0, 0), thickness: 1 });
		page.drawLine({ start: { x: tableLeft, y: tableTop - headerH }, end: { x: tableRight, y: tableTop - headerH }, color: rgb(0, 0, 0), thickness: 1 });
		const toNum = (v: string) => { if (!v) return 0; const n = parseFloat(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
		let cursorY = tableTop - headerH - 15;
		for (let i = 0; i < totalRows; i++) {
			const r = rows[i];
			if (r) {
				const qtyNum = toNum(r.qty);
				const rateNum = toNum(r.amount);
				const lineTotal = qtyNum * rateNum;
				drawText(r.qty || "", tableLeft + 10, cursorY, 10);
				drawText(r.description || "", tableLeft + colQtyW + 10, cursorY, 10);
				drawText(lineTotal ? lineTotal.toFixed(2) : "", tableLeft + colQtyW + colDescW + 10, cursorY, 10);
			}
			page.drawLine({ start: { x: tableLeft, y: cursorY - 6 }, end: { x: tableRight, y: cursorY - 6 }, color: rgb(0, 0, 0), thickness: 0.5 });
			cursorY -= rowH;
		}
		const total = rows.reduce((sum, r) => { const qtyNum = toNum(r.qty); const rateNum = toNum(r.amount); return sum + qtyNum * rateNum; }, 0);
		drawText(`Total: Rs. ${total.toFixed(2)}`, tableLeft, tableBottom - 20, 12, true);
		drawText("Note: This is a computer-generated document and does not require a signature.", marginLeft, 40, 9);
		const pdfBytes = await pdfDoc.save();
		return pdfBytes;
	};

	const handleReprint = async (row: InvoiceRow) => {
		try {
			const rows = toRowData(row.Description);
			let gp: string | undefined = undefined;
			if (row.challanno != null) {
				try {
					const ch = encodeURIComponent(String(row.challanno));
					const res = await fetch(`/api/challan?challan=${ch}&limit=1&exact=1`);
					if (res.ok) {
						const data = await res.json();
						if (Array.isArray(data) && data.length > 0) {
							gp = data[0]?.GP ?? data[0]?.gp ?? undefined;
						}
					}
				} catch (e) {
					console.error('Failed to fetch challan for GP:', e);
				}
			}
			const bytes = await generateInvoicePdfBytes(rows, {
				bill: row.billno ? String(row.billno).padStart(5, "0") : undefined,
				challan: row.challanno ? String(row.challanno).padStart(5, "0") : undefined,
				gp,
			});
			const blob = new Blob([bytes.slice(0)], { type: "application/pdf" });
			const url = URL.createObjectURL(blob);
			const win = window.open(url, "_blank");
			if (win) setTimeout(() => {
				try { win.focus(); } catch {}
			}, 500);
			setTimeout(() => URL.revokeObjectURL(url), 60_000);
		} catch (e) {
			console.error("Invoice reprint failed:", e);
			alert("Failed to generate invoice PDF for reprint.");
		}
	};

	const renderLines = (desc: any) => {
		const arr: any[] = Array.isArray(desc) ? desc : desc ? [desc] : [];
		if (arr.length === 0) return <div className="text-xs text-gray-500">No items</div>;
		return (
			<div className="w-full min-w-0">
				<div className="grid grid-cols-12 bg-[var(--accent)] text-white text-[11px] uppercase rounded-t-md min-w-0">
					<div className="col-span-2 px-3 py-2">QTY</div>
					<div className="col-span-8 px-3 py-2">Description</div>
					<div className="col-span-2 px-3 py-2">Amount</div>
				</div>
				<div className="border border-[var(--accent)] border-t-0 rounded-b-md overflow-hidden">
					{arr.map((d, i) => (
						<div key={i} className="grid grid-cols-12 bg-black/80 text-white text-xs border-t border-white/10">
							<div className="col-span-2 px-3 py-2">{String(d?.qty ?? d?.quantity ?? "")}</div>
							<div className="col-span-8 px-3 py-2 break-words whitespace-normal">{String(d?.description ?? d?.materialDescription ?? "")}</div>
							<div className="col-span-2 px-3 py-2">{String(d?.amount ?? "")}</div>
						</div>
					))}
				</div>
			</div>
		);
	};

	return (
		<div className="flex min-h-screen w-full items-start gap-5 lg:gap-7 p-4 lg:p-6 overflow-hidden">
			<div className="flex-1 min-w-0">
				<div className="rounded-xl bg-black p-4 lg:p-6 shadow text-white">
					<div className="mb-4">
						<Nav href1="/Bill" name1="Generate" href2="/Bill/inquery" name2="Inquery" />
					</div>
					<h1 className="text-base lg:text-lg font-semibold mb-3">Invoice Inquiry</h1>
					<div className="flex flex-wrap items-end gap-4">
						<div>
							<label className="block text-[11px] font-medium text-white">Bill Number</label>
							<input type="text" value={billQuery} onChange={(e) => setBillQuery(e.target.value)} className="mt-1 w-40 text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/60" placeholder="e.g. 12 or 00012" />
						</div>
						<div>
							<label className="block text-[11px] font-medium text-white">Challan Number</label>
							<input type="text" value={challanQuery} onChange={(e) => setChallanQuery(e.target.value)} className="mt-1 w-40 text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/60" placeholder="e.g. 34 or 00034" />
						</div>
					</div>
					<div className="mt-4 text-xs text-white/70">{loading ? "Loading..." : error ? `Error: ${error}` : `${results.length} result(s)`}</div>
					<div className="mt-4 overflow-auto rounded-xl border border-white/10 h-[70vh] max-h-[70vh] bg-black p-2">
						<div className="hidden md:grid grid-cols-12 bg-[var(--accent)] text-white text-xs rounded-md mb-2">
							<div className="col-span-2 px-2 py-2">Bill no</div>
							<div className="col-span-2 px-2 py-2">Challan no</div>
							<div className="col-span-2 px-2 py-2">Date</div>
							<div className="col-span-5 px-2 py-2">Description</div>
							<div className="col-span-1 px-2 py-2 text-center">Action</div>
						</div>
						<div className="space-y-4">
							{results.map((row) => {
								const billStr = row.billno != null ? String(row.billno).padStart(5, "0") : "-";
								const challanStr = row.challanno != null ? String(row.challanno).padStart(5, "0") : "-";
								const created = new Date(row.created_at).toLocaleString();
								const key = String(row.billno ?? Math.random());
								return (
									<div key={key} className="rounded-xl border border-[var(--accent)] overflow-hidden mb-4 bg-black">
										<div className="grid grid-cols-12 gap-2 items-start text-white p-3">
											<div className="col-span-12 md:col-span-2 px-2">
												<div className="text-[11px] uppercase text-white/60">Bill no</div>
												<div className="text-sm font-semibold">{billStr}</div>
											</div>
											<div className="col-span-12 md:col-span-2 px-2">
												<div className="text-[11px] uppercase text-white/60">Challan no</div>
												<div className="text-sm font-semibold">{challanStr}</div>
											</div>
											<div className="col-span-12 md:col-span-2 px-2">
												<div className="text-[11px] uppercase text-white/60">Date</div>
												<div className="text-sm font-semibold whitespace-nowrap">{created}</div>
											</div>
											<div className="col-span-12 md:col-span-5 min-w-0">{renderLines(row.Description)}</div>
											<div className="col-span-12 md:col-span-1 flex md:flex-col items-stretch md:items-end gap-2">
												<button onClick={() => togglePaid(row)} disabled={pendingBills.has(String(row.billno))} className={`${row.status ? "bg-green-500" : "bg-[var(--accent)]"} px-4 py-1.5 rounded-md text-black text-xs font-semibold w-full md:w-auto disabled:opacity-60 disabled:cursor-not-allowed`} aria-pressed={row.status ? true : false} title={row.status ? "Paid (click to mark Unpaid)" : "Unpaid (click to mark Paid)"}>
													{row.status ? "Paid" : "Unpaid"}
												</button>
												<button onClick={() => handleReprint(row)} className="px-4 py-1.5 rounded-md bg-[var(--accent)] text-black text-xs font-semibold w-full md:w-auto">Reprint</button>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default InvoiceInqueryPage;
