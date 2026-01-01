"use client";
import React, { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Nav from "@/app/components/nav";

type InvoiceRow = {
	id?: any;
	billno: number | string | null;
	challanno: number | null;
	created_at: string;
	Description: any;
	status?: boolean;
	DeliveryChallan?: {
		Industry?: string;
		GP?: string;
	};
};

const InvoiceInqueryPage = () => {
	const [billQuery, setBillQuery] = useState("");
	const [challanQuery, setChallanQuery] = useState("");
	const [results, setResults] = useState<InvoiceRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pendingBills, setPendingBills] = useState<Set<string | number>>(new Set());
	const [showPrintModal, setShowPrintModal] = useState(false);
	const [selectionRange, setSelectionRange] = useState({ from: "", to: "" });
	const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());
	const [newDate, setNewDate] = useState("");

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
			// Return both rate (per-piece) and original amount when available
			return { qty, description, rate: perPiece, amount: d?.amount ?? "" };
		});
	};

	const generateInvoicePdfBytes = async (
		rows: {
			rate: string; qty: string; description: string; amount: string 
}[],
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
			colRateW = 90,
			colAmtW = 90,
			colDescW = tableWidth - colQtyW - colRateW - colAmtW;
		page.drawRectangle({ x: tableLeft, y: tableTop - headerH, width: tableWidth, height: headerH, color: rgb(0, 0, 0) });
		const headerY = tableTop - headerH + 7;
		drawText("Qty", tableLeft + 10, headerY, 11, true, rgb(1, 1, 1));
		drawText("Description", tableLeft + colQtyW + 10, headerY, 11, true, rgb(1, 1, 1));
		drawText("Rate", tableLeft + colQtyW + colDescW + 10, headerY, 11, true, rgb(1, 1, 1));
		drawText("Amount", tableLeft + colQtyW + colDescW + colRateW + 10, headerY, 11, true, rgb(1, 1, 1));
		const totalRows = Math.max(rows.length, 6);
		const tableHeight = headerH + totalRows * rowH;
		const tableBottom = tableTop - tableHeight;
		page.drawRectangle({ x: tableLeft, y: tableBottom, width: tableWidth, height: tableHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
		const xCol1 = tableLeft + colQtyW;
		const xCol2 = tableLeft + colQtyW + colDescW;
		const xCol3 = tableLeft + colQtyW + colDescW + colRateW;
		page.drawLine({ start: { x: xCol1, y: tableBottom }, end: { x: xCol1, y: tableTop }, color: rgb(0, 0, 0), thickness: 1 });
		page.drawLine({ start: { x: xCol2, y: tableBottom }, end: { x: xCol2, y: tableTop }, color: rgb(0, 0, 0), thickness: 1 });
		page.drawLine({ start: { x: xCol3, y: tableBottom }, end: { x: xCol3, y: tableTop }, color: rgb(0, 0, 0), thickness: 1 });
		page.drawLine({ start: { x: tableLeft, y: tableTop - headerH }, end: { x: tableRight, y: tableTop - headerH }, color: rgb(0, 0, 0), thickness: 1 });
		const toNum = (v: string) => { if (!v) return 0; const n = parseFloat(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
		let cursorY = tableTop - headerH - 15;
		for (let i = 0; i < totalRows; i++) {
			const r = rows[i];
			if (r) {
				const qtyNum = toNum(r.qty);
				const rateNum = toNum(r.rate ?? r.amount ?? "");
				const lineTotal = qtyNum * rateNum;
				drawText(r.qty || "", tableLeft + 10, cursorY, 10);
				drawText(r.description || "", tableLeft + colQtyW + 10, cursorY, 10);
				// Rate column
				drawText(rateNum ? rateNum.toFixed(2) : r.rate ?? r.amount ?? "", tableLeft + colQtyW + colDescW + 10, cursorY, 10);
				// Amount column (qty * rate)
				drawText(lineTotal ? lineTotal.toFixed(2) : "", tableLeft + colQtyW + colDescW + colRateW + 10, cursorY, 10);
			}
			page.drawLine({ start: { x: tableLeft, y: cursorY - 6 }, end: { x: tableRight, y: cursorY - 6 }, color: rgb(0, 0, 0), thickness: 0.5 });
			cursorY -= rowH;
		}
		const total = rows.reduce((sum, r) => { const qtyNum = toNum(r.qty); const rateNum = toNum(r.rate ?? r.amount ?? ""); return sum + qtyNum * rateNum; }, 0);
		drawText(`Total: Rs. ${total.toFixed(2)}`, tableLeft, tableBottom - 20, 12, true);
		drawText("Note: This is a computer-generated document and does not require a signature.", marginLeft, 40, 9);
		const pdfBytes = await pdfDoc.save();
		return pdfBytes;
	};

	const generateBillListSummaryPdf = async (selectedRows: InvoiceRow[]) => {
		const pdfDoc = await PDFDocument.create();
		const page = pdfDoc.addPage([595.28, 841.89]);
		const { width, height } = page.getSize();
		const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
		const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
		const drawText = (t: string, x: number, y: number, s = 12, b = false, c = rgb(0, 0, 0)) => {
			page.drawText(t, { x, y, size: s, font: b ? fontBold : font, color: c });
		};

		// Helper to center text
		const drawCenteredText = (t: string, y: number, s = 12, b = false, c = rgb(0, 0, 0)) => {
			const usedFont = b ? fontBold : font;
			const textWidth = usedFont.widthOfTextAtSize(t, s);
			const x = (width - textWidth) / 2;
			drawText(t, x, y, s, b, c);
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

		const topAfterLogo = height - 120; // Moved higher from 160
		const gap = 14;
		const small = 10;
		// Centered and Bolded Header Info - Moved Higher
		drawCenteredText("Email: z.ushahid@gmail.com", topAfterLogo, small, true);
		drawCenteredText("Contact: 03092308078", topAfterLogo - gap, small, true);
		drawCenteredText(`Date: 12/27/2025`, topAfterLogo - 2 * gap, small, true);

		// Map prefixes to company names
		const prefixMap: Record<string, string> = {
			"KTML": "Kassim Textile Mills Limited",
			"MDM": "Meko Demam Mills",
			"UFPL": "Union Fabrics Private Limited"
		};

		// Detect prefix from the first bill
		const getPrefix = (s: any) => {
			const match = String(s).match(/^([A-Za-z]+)/);
			return match ? match[1].toUpperCase() : "";
		};
		const firstPrefix = selectedRows.length > 0 ? getPrefix(selectedRows[0].billno) : "";
		const companyName = prefixMap[firstPrefix] || selectedRows[0]?.DeliveryChallan?.Industry || "Valued Customer";

		drawCenteredText(companyName, topAfterLogo - 60, 24, true); // Company Name
		drawCenteredText("Bill List Summary", topAfterLogo - 105, 20, true); // Increased gap (was -90)

		const tableTop = topAfterLogo - 145; // Adjusted table position (was -125)
		const tableLeft = marginLeft;
		const tableRight = width - marginRight;
		const tableWidth = tableRight - tableLeft;
		
		const colSNoW = 40, colBillW = 100, colChallanW = 100, colGPW = 100;
		const colAmtW = tableWidth - colSNoW - colBillW - colChallanW - colGPW;
		const headerH = 26, rowH = 24;

		// Header Background
		page.drawRectangle({ x: tableLeft, y: tableTop - headerH, width: tableWidth, height: headerH, color: rgb(0, 0, 0) });
		const headerY = tableTop - headerH + 8;
		drawText("S.No", tableLeft + 5, headerY, 11, true, rgb(1, 1, 1));
		drawText("Bill No", tableLeft + colSNoW + 10, headerY, 11, true, rgb(1, 1, 1));
		drawText("Challan No", tableLeft + colSNoW + colBillW + 10, headerY, 11, true, rgb(1, 1, 1));
		drawText("Gatepass (GP)", tableLeft + colSNoW + colBillW + colChallanW + 10, headerY, 11, true, rgb(1, 1, 1));
		drawText("Amount", tableLeft + colSNoW + colBillW + colChallanW + colGPW + 10, headerY, 11, true, rgb(1, 1, 1));

		// Sort rows in ascending order
		const sortedRows = [...selectedRows].sort((a, b) => {
			const getNum = (s: any) => {
				const n = String(s).match(/\d+$/);
				return n ? parseInt(n[0]) : 0;
			};
			return getNum(a.billno) - getNum(b.billno);
		});

		const totalRows = sortedRows.length;
		const tableHeight = headerH + totalRows * rowH;
		const tableBottom = tableTop - tableHeight;

		// Table Border
		page.drawRectangle({ x: tableLeft, y: tableBottom, width: tableWidth, height: tableHeight, borderColor: rgb(0, 0, 0), borderWidth: 1.5 });

		// Vertical lines
		[tableLeft + colSNoW, tableLeft + colSNoW + colBillW, tableLeft + colSNoW + colBillW + colChallanW, tableLeft + colSNoW + colBillW + colChallanW + colGPW].forEach((x) => {
			page.drawLine({ start: { x, y: tableBottom }, end: { x, y: tableTop }, color: rgb(0, 0, 0), thickness: 1 });
		});

		const toNum = (v: string) => { if (!v) return 0; const n = parseFloat(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
		let cursorY = tableTop - headerH - 17;
		let grandTotal = 0;

		for (let i = 0; i < totalRows; i++) {
			const row = sortedRows[i];
			const billStr = String(row.billno).includes('-') ? String(row.billno) : String(row.billno).padStart(5, "0");
			const challanStr = row.challanno != null ? String(row.challanno).padStart(5, "0") : "-";
			const gpStr = row.DeliveryChallan?.GP || "-";
			const lineItems = toRowData(row.Description);
			const billTotal = lineItems.reduce((sum, item) => {
				const a = toNum(item.amount);
				if (a > 0) return sum + a;
				const q = toNum(item.qty);
				const r = toNum(item.rate);
				return sum + q * r;
			}, 0);
			grandTotal += billTotal;

			drawText(String(i + 1), tableLeft + 10, cursorY, 10);
			drawText(billStr, tableLeft + colSNoW + 10, cursorY, 10);
			drawText(challanStr, tableLeft + colSNoW + colBillW + 10, cursorY, 10);
			drawText(gpStr, tableLeft + colSNoW + colBillW + colChallanW + 10, cursorY, 10);
			drawText(billTotal.toFixed(2), tableLeft + colSNoW + colBillW + colChallanW + colGPW + 10, cursorY, 10);

			// Row separator
			page.drawLine({ start: { x: tableLeft, y: cursorY - 7 }, end: { x: tableRight, y: cursorY - 7 }, color: rgb(0.8, 0.8, 0.8), thickness: 0.5 });
			cursorY -= rowH;
		}

		drawText(`Grand Total: Rs. ${grandTotal.toFixed(2)}`, tableLeft, tableBottom - 35, 14, true);
		
		// Receiver Signature Line
		const sigLineY = 70;
		page.drawLine({
			start: { x: width - marginRight - 150, y: sigLineY },
			end: { x: width - marginRight, y: sigLineY },
			color: rgb(0, 0, 0),
			thickness: 1,
		});
		drawText("Receiver's Signature", width - marginRight - 140, sigLineY - 15, 10, true);

		drawText("Note: This is a summary report of generated bills.", marginLeft, 40, 9);
		return await pdfDoc.save();
	};

	const applyRange = () => {
		if (!selectionRange.from || !selectionRange.to) return;
		const parseBill = (s: string) => {
			const match = s.trim().match(/^([A-Za-z]+)?-?(\d+)$/);
			if (!match) return null;
			return { prefix: match[1] || "", num: parseInt(match[2]) };
		};
		const from = parseBill(selectionRange.from);
		const to = parseBill(selectionRange.to);
		if (!from || !to) return;
		const newSelected = new Set(selectedBillIds);
		results.forEach((row) => {
			const current = parseBill(String(row.billno));
			if (current && current.prefix === from.prefix && current.num >= from.num && current.num <= to.num) {
				newSelected.add(String(row.billno));
			}
		});
		setSelectedBillIds(newSelected);
	};

	const handlePrintSelected = async () => {
		const toPrint = results.filter((r) => selectedBillIds.has(String(r.billno)));
		if (toPrint.length === 0) return alert("Please select at least one bill");
		
		// Sort to find range for filename
		const sorted = [...toPrint].sort((a, b) => {
			const getNum = (s: any) => {
				const n = String(s).match(/\d+$/);
				return n ? parseInt(n[0]) : 0;
			};
			return getNum(a.billno) - getNum(b.billno);
		});

		try {
			const bytes = await generateBillListSummaryPdf(sorted);
			const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
			const url = URL.createObjectURL(blob);
			
			// Generate Filename: Date_Start_to_End.pdf
			const dateStr = new Date().toISOString().split('T')[0];
			const startBill = String(sorted[0].billno).includes('-') ? String(sorted[0].billno) : String(sorted[0].billno).padStart(5, "0");
			const endBill = String(sorted[sorted.length - 1].billno).includes('-') ? String(sorted[sorted.length - 1].billno) : String(sorted[sorted.length - 1].billno).padStart(5, "0");
			const fileName = `${dateStr}_${startBill}_to_${endBill}.pdf`;

			const link = document.createElement("a");
			link.href = url;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			
			setTimeout(() => URL.revokeObjectURL(url), 60000);
		} catch (e) {
			console.error(e);
			alert("Failed to generate bill list PDF");
		}
	};

	const handleUpdateDates = async () => {
		if (selectedBillIds.size === 0) return alert("Please select at least one bill to update");
		if (!newDate) return alert("Please choose a date");
		const billnos = Array.from(selectedBillIds);
		try {
			const res = await fetch('/api/invoice-date', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ billnos, date: newDate }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			// Update local UI with returned updated rows if available
			if (Array.isArray(data)) {
				const updatedSet = new Set(data.map((r: any) => String(r.billno)));
				setResults((prev) => prev.map((r) => (updatedSet.has(String(r.billno)) ? { ...r, created_at: data.find((x: any) => String(x.billno) === String(r.billno))?.created_at || newDate } : r)));
			} else {
				// Fallback: map selected IDs to new date string
				setResults((prev) => prev.map((r) => (selectedBillIds.has(String(r.billno)) ? { ...r, created_at: new Date(newDate).toISOString() } : r)));
			}
			alert('Updated dates for selected bills');
			setShowPrintModal(false);
		} catch (e: any) {
			console.error('Failed to update invoice dates:', e);
			alert('Failed to update invoice dates');
		}
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

	const handleDownloadSelectedInvoices = async () => {
		const toDownload = results.filter((r) => selectedBillIds.has(String(r.billno)));
		if (toDownload.length === 0) return alert("Please select at least one bill");
		try {
			// Sort by bill number numeric part
			const sorted = [...toDownload].sort((a, b) => {
				const getNum = (s: any) => {
					const n = String(s).match(/\d+$/);
					return n ? parseInt(n[0]) : 0;
				};
				return getNum(a.billno) - getNum(b.billno);
			});

			// Create ZIP containing individual PDFs named by billno
			const zip = new JSZip();
			for (const row of sorted) {
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
					} catch {}
				}
				const bytes = await generateInvoicePdfBytes(rows, {
					bill: row.billno ? String(row.billno).padStart(5, "0") : undefined,
					challan: row.challanno ? String(row.challanno).padStart(5, "0") : undefined,
					gp,
				});
				const billStr = String(row.billno).includes('-') ? String(row.billno) : String(row.billno).padStart(5, "0");
				zip.file(`${billStr}.pdf`, bytes);
			}

			const zipBlob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(zipBlob);
			const dateStr = new Date().toISOString().split('T')[0];
			const firstBill = String(sorted[0].billno).includes('-') ? String(sorted[0].billno) : String(sorted[0].billno).padStart(5, "0");
			const lastBill = String(sorted[sorted.length - 1].billno).includes('-') ? String(sorted[sorted.length - 1].billno) : String(sorted[sorted.length - 1].billno).padStart(5, "0");
			const fileName = `${dateStr}_Invoices_${firstBill}_to_${lastBill}.zip`;
			const link = document.createElement("a");
			link.href = url;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			setTimeout(() => URL.revokeObjectURL(url), 60000);
		} catch (e) {
			console.error("Failed to download selected invoices:", e);
			alert("Failed to generate ZIP of selected invoices.");
		}
	};

	const renderLines = (desc: any) => {
		const arr: any[] = Array.isArray(desc) ? desc : desc ? [desc] : [];
		if (arr.length === 0) return <div className="text-xs text-gray-500">No items</div>;
		return (
			<div className="w-full min-w-0">
				<div className="grid grid-cols-12 bg-[var(--accent)] text-white text-[11px] uppercase rounded-t-md min-w-0">
					<div className="col-span-1 px-3 py-2 text-center">QTY</div>
					<div className="col-span-6 px-3 py-2">Description</div>
					<div className="col-span-2 px-3 py-2 text-right">Rate</div>
					<div className="col-span-3 px-3 py-2 text-right">Amount</div>
				</div>
				<div className="border border-[var(--accent)] border-t-0 rounded-b-md overflow-hidden">
					{arr.map((d, i) => (
						<div key={i} className="grid grid-cols-12 bg-black/80 text-white text-xs border-t border-white/10">
							<div className="col-span-1 px-3 py-2 text-center">{String(d?.qty ?? d?.quantity ?? "")}</div>
							<div className="col-span-6 px-3 py-2 break-words whitespace-normal">{String(d?.description ?? d?.materialDescription ?? "")}</div>
							<div className="col-span-2 px-3 py-2 text-right">{String(d?.rate ?? d?.amount ?? "")}</div>
							<div className="col-span-3 px-3 py-2 text-right">{String(d?.amount ?? "")}</div>
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
						<div className="flex flex-col">
							<label className="block text-[11px] font-medium text-white">Challan Number</label>
							<input type="text" value={challanQuery} onChange={(e) => setChallanQuery(e.target.value)} className="mt-1 w-40 text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/60" placeholder="e.g. 34 or 00034" />
						</div>
						<button onClick={() => setShowPrintModal(true)} className="bg-[var(--accent)] text-black px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition shadow-lg flex items-center gap-2">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
							</svg>
							Print Bill List
						</button>
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
			{showPrintModal && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
					<div className="w-full max-w-4xl bg-[#1e1e1e] border border-[var(--accent)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
						<div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
							<div>
								<h2 className="text-xl font-bold text-white">Select Bills for List</h2>
								<p className="text-xs text-white/50 mt-1">Select a range or individual bills to print</p>
							</div>
							<button onClick={() => setShowPrintModal(false)} className="text-white/50 hover:text-white transition">
								<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>
						<div className="p-6 flex-1 overflow-auto space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white/5 rounded-xl border border-white/5 items-end">
								<div className="space-y-2">
									<label className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider">From Bill</label>
									<input type="text" value={selectionRange.from} onChange={e => setSelectionRange(prev => ({ ...prev, from: e.target.value }))} className="w-full bg-black/40 border-b-2 border-white/20 focus:border-[var(--accent)] outline-none text-sm py-2 px-1 text-white transition-colors" placeholder="e.g. KTML-0001" />
								</div>
								<div className="space-y-2">
									<label className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider">To Bill</label>
									<input type="text" value={selectionRange.to} onChange={e => setSelectionRange(prev => ({ ...prev, to: e.target.value }))} className="w-full bg-black/40 border-b-2 border-white/20 focus:border-[var(--accent)] outline-none text-sm py-2 px-1 text-white transition-colors" placeholder="e.g. KTML-0010" />
								</div>
								<button onClick={applyRange} className="bg-[var(--accent)] text-black px-6 py-2.5 rounded-lg text-xs font-bold hover:opacity-90 transition active:scale-95">Apply Range</button>
							</div>

							<div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white/5 rounded-xl border border-white/5 items-end">
								<div className="space-y-2">
									<label className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider">New Date</label>
									<input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black/40 border-b-2 border-white/20 focus:border-[var(--accent)] outline-none text-sm py-2 px-1 text-white transition-colors" />
								</div>
								<div className="col-span-2 flex items-center gap-3">
									<button onClick={handleUpdateDates} className="bg-[var(--accent)] text-black px-6 py-2.5 rounded-lg text-xs font-bold hover:opacity-90 transition active:scale-95">Update Dates</button>
									<div className="text-xs text-white/60">This will update the created date for all selected invoices.</div>
								</div>
							</div>
							<div className="rounded-xl border border-white/10 overflow-hidden">
								<table className="w-full text-left text-xs">
									<thead className="bg-[var(--accent)] text-black font-bold">
										<tr>
											<th className="px-4 py-3 w-10">
												<input type="checkbox" onChange={e => setSelectedBillIds(e.target.checked ? new Set(results.map(r => String(r.billno))) : new Set())} checked={selectedBillIds.size === results.length && results.length > 0} className="rounded accent-black" />
											</th>
											<th className="px-4 py-3 w-12">S.No</th>
											<th className="px-4 py-3">Bill No</th>
											<th className="px-4 py-3">Challan No</th>
											<th className="px-4 py-3">Gatepass (GP)</th>
											<th className="px-4 py-3 text-right">Amount</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-white/5 bg-black/20">
										{results.map((row, idx) => {
											const items = toRowData(row.Description);
											const toNum = (v: string) => { if (!v) return 0; const n = parseFloat(String(v).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
											const total = items.reduce((sum, item) => {
												const a = toNum(item.amount);
												if (a > 0) return sum + a;
												return sum + (toNum(item.qty) * toNum(item.rate));
											}, 0);
											const id = String(row.billno);
											return (
												<tr key={id} className={`hover:bg-white/5 transition-colors ${selectedBillIds.has(id) ? 'bg-[var(--accent)]/10' : ''}`}>
													<td className="px-4 py-3">
														<input type="checkbox" checked={selectedBillIds.has(id)} onChange={() => setSelectedBillIds(prev => {
															const n = new Set(prev);
															if (n.has(id)) n.delete(id); else n.add(id);
															return n;
														})} className="rounded accent-[var(--accent)]" />
													</td>
													<td className="px-4 py-3 text-white/50">{idx + 1}</td>
													<td className="px-4 py-3 font-medium text-white">{String(row.billno).padStart(5, '0')}</td>
													<td className="px-4 py-3 text-white/70">{row.challanno != null ? String(row.challanno).padStart(5, '0') : '-'}</td>
													<td className="px-4 py-3 text-white/70">{row.DeliveryChallan?.GP || '-'}</td>
													<td className="px-4 py-3 text-right font-mono text-[var(--accent)]">{total.toFixed(2)}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
						<div className="p-6 border-t border-white/10 flex justify-between items-center bg-black/40">
							<div className="text-xs text-white/50">
								<span className="text-[var(--accent)] font-bold">{selectedBillIds.size}</span> bills selected
							</div>
							<div className="flex gap-3">
								<button onClick={() => setShowPrintModal(false)} className="px-5 py-2 rounded-lg text-xs font-bold text-white/70 hover:text-white transition">Cancel</button>
								<button onClick={handlePrintSelected} className="bg-[var(--accent)] text-black px-8 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition shadow-lg flex items-center gap-2">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
									Print Bill List
								</button>
								<button onClick={handleDownloadSelectedInvoices} className="bg-white text-black px-8 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition shadow-lg flex items-center gap-2 border border-[var(--accent)]">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
									Download Selected (ZIP)
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default InvoiceInqueryPage;
