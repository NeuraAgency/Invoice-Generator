  "use client";
  import React, { useEffect, useMemo, useState } from "react";
  import Link from "next/link";
  import DatePicker from "@/app/components/DatePicker";
  import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
  import Nav from "@/app/components/nav";

  type ChallanRow = {
    id: number;
    challanno: number | null;
    created_at?: string;
    Date?: string | null;
    PO?: string | null;
    GP?: string | null;
    Description: unknown;
    Sample_returned?: boolean | null;
  };

  const ChallanInquiryPage = () => {
    const [challanQuery, setChallanQuery] = useState("");
    const [companyQuery, setCompanyQuery] = useState("");
    const [companyOptions, setCompanyOptions] = useState<string[]>([]);
    const [filterCompanyDropdownOpen, setFilterCompanyDropdownOpen] = useState(false);
    const [itemQuery, setItemQuery] = useState("");
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [tempFilters, setTempFilters] = useState<{ challan: string; company: string; item: string; from: Date | null; to: Date | null }>({ challan: "", company: "", item: "", from: null, to: null });
    const [dateFrom, setDateFrom] = useState<Date | null>(null);
    const [dateTo, setDateTo] = useState<Date | null>(null);
    const [results, setResults] = useState<ChallanRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const qs = useMemo(() => {
      const params = new URLSearchParams();
      if (challanQuery.trim()) params.set("challan", challanQuery.trim());
      if (companyQuery.trim()) params.set("industry", companyQuery.trim());
      if (itemQuery.trim()) params.set("item", itemQuery.trim());
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      if (dateFrom) params.set("from", fmt(dateFrom));
      if (dateTo) params.set("to", fmt(dateTo));
      params.set("limit", "50");
      return params.toString();
    }, [challanQuery, companyQuery, itemQuery, dateFrom, dateTo]);

    useEffect(() => {
      const controller = new AbortController();
      const timer = setTimeout(async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await fetch(`/api/challan?${qs}`, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
        } catch (e: any) {
          if (e?.name !== "AbortError") setError(e?.message || "Failed to load challans");
        } finally {
          setLoading(false);
        }
      }, 250);
      return () => { controller.abort(); clearTimeout(timer); };
    }, [qs]);

    // Load company options (Industry list)
    useEffect(() => {
      let active = true;
      (async () => {
        try {
          const res = await fetch('/api/challan-companies');
          if (!res.ok) return;
          const list = await res.json();
          if (active && Array.isArray(list)) setCompanyOptions(list);
        } catch {}
      })();
      return () => { active = false; };
    }, []);

    const openFilterModal = () => {
      setTempFilters({ challan: challanQuery, company: companyQuery, item: itemQuery, from: dateFrom, to: dateTo });
      setShowFilterModal(true);
    };
    const applyFilters = () => {
      setChallanQuery(tempFilters.challan);
      setCompanyQuery(tempFilters.company);
      setItemQuery(tempFilters.item);
      setDateFrom(tempFilters.from);
      setDateTo(tempFilters.to);
      setShowFilterModal(false);
    };

    const toItems = (desc: unknown): any[] => {
      if (Array.isArray(desc)) return desc;
      if (!desc) return [];
      return [desc];
    };
    const renderLines = (raw: unknown) => {
      const arr = toItems(raw);
      if (arr.length === 0) return <div className="text-xs text-gray-500">No items</div>;
      return (
        <div className="w-full min-w-0">
          <div className="grid grid-cols-12 bg-[var(--accent)] text-white text-[11px] uppercase rounded-t-md min-w-0">
            <div className="col-span-2 px-3 py-2">QTY</div>
            <div className="col-span-8 px-3 py-2">Description</div>
            <div className="col-span-2 py-2 text-left">Indent</div>
          </div>
          <div className="border border-[var(--accent)] border-t-0 rounded-b-md overflow-hidden">
            {arr.map((d: any, i: number) => {
              const qty = d?.qty ?? d?.quantity ?? d?.quantityFromRemarks ?? "";
              const desc = d?.description ?? d?.materialDescription ?? d?.desc ?? "";
              const ind = d?.indNo ?? d?.indno ?? "";
              return (
                <div key={i} className="grid grid-cols-12 bg-black/80 text-white text-xs border-t border-white/10">
                  <div className="col-span-2 px-3 py-2">{String(qty)}</div>
                  <div className="col-span-8 py-2 break-words whitespace-normal">{String(desc)}</div>
                  <div className="col-span-2 py-2 tabular-nums" title={String(ind)}>{String(ind)}</div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };
    const toRowData = (raw: unknown) => {
      const arr = toItems(raw);
      return arr.map((d: any) => ({
        qty: String(d?.qty ?? d?.quantity ?? d?.quantityFromRemarks ?? ""),
        description: String(d?.description ?? d?.materialDescription ?? d?.desc ?? ""),
        indno: String(d?.indNo ?? d?.indno ?? ""),
      }));
    };

    const generatePdfBytes = async (
      rows: { qty: string; description: string; indno: string }[],
      options: { gp?: string; po?: string | null; challan?: string | null; sampleReturned?: boolean }
    ) => {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const measure = (text: string, size: number, bold = false) => (bold ? fontBold : font).widthOfTextAtSize(text, size);
      const drawText = (text: string, x: number, y: number, size = 12, bold = false, color = rgb(0, 0, 0), extra?: { opacity?: number; rotateDeg?: number }) => {
        page.drawText(text, { x, y, size, font: bold ? fontBold : font, color, opacity: extra?.opacity, rotate: extra?.rotateDeg ? degrees(extra.rotateDeg) : undefined });
      };
      const drawLabelValue = (label: string, value: string, x: number, y: number, size = 10) => {
        const gap = 4;
        drawText(label.toUpperCase(), x, y, size - 1, true);
        const labelW = measure(label.toUpperCase(), size - 1, true) + gap + 2;
        drawText(value, x + labelW, y, size, true);
      };
      const lightGray = rgb(0.86, 0.86, 0.86);
      const midGray = rgb(0.6, 0.6, 0.6);
      const marginLeft = 40;
      const marginRight = 40;
      const contentWidth = width - marginLeft - marginRight;
      try {
        const logoBytes = await fetch("/zumech.png").then((r) => r.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const targetLogoWidth = Math.min(420, contentWidth);
        const targetLogoHeight = (logoImage.height / logoImage.width) * targetLogoWidth;
        const logoX = marginLeft + (contentWidth - targetLogoWidth) / 2;
        const logoY = height - 20 - targetLogoHeight;
        page.drawImage(logoImage, { x: logoX, y: logoY, width: targetLogoWidth, height: targetLogoHeight });
      } catch {}
      const topAfterLogo = height - 160;
      const leftColX = marginLeft;
      const rightColX = width - marginRight - 90;
      const lineGap = 13;
      const smallSize = 10;
      const date = new Date().toLocaleDateString();
      const PO = options.po || "";
      const challan = options.challan || "";
      const Company_Name = "Kassim Textile Mills Limited";
      drawLabelValue("Email", "z.ushahid@gmail.com", leftColX, topAfterLogo, smallSize);
      drawLabelValue("Contact", "03092308078", leftColX, topAfterLogo - lineGap, smallSize);
      drawLabelValue("Challan No", challan, leftColX, topAfterLogo - 2 * lineGap, smallSize);
      drawLabelValue("Date", date, leftColX, topAfterLogo - 3 * lineGap, smallSize);
      drawLabelValue("P.O. No", PO, rightColX, topAfterLogo, smallSize);
      drawLabelValue("G.P. No", options.gp || "", rightColX, topAfterLogo - lineGap, smallSize);
      const companySize = 28;
      const titleSize = 22;
      const companyText = `${Company_Name}`;
      const companyTextWidth = measure(companyText, companySize, true);
      const companyX = marginLeft + (contentWidth - companyTextWidth) / 2;
      let companyY = topAfterLogo - 120;
      drawText(companyText, companyX, companyY, companySize, true);
      const titleText = "Delivery Challan";
      const titleWidth = measure(titleText, titleSize, true);
      const titleX = marginLeft + (contentWidth - titleWidth) / 2;
      const titleY = companyY - 40;
      drawText(titleText, titleX, titleY, titleSize, true);
      const tableTop = titleY - 30;
      const tableLeft = marginLeft;
      const tableRight = width - marginRight;
      const tableWidth = tableRight - tableLeft;
      const headerHeight = 28;
      const rowHeight = 26;
      const colQtyW = 60;
      const colIndW = 100;
      const colDescW = tableWidth - colQtyW - colIndW;
      page.drawRectangle({ x: tableLeft, y: tableTop - headerHeight, width: tableWidth, height: headerHeight, color: rgb(0, 0, 0) });
      const headerTextY = tableTop - headerHeight + 8;
      drawText("Qty", tableLeft + 10, headerTextY, 12, true, rgb(1, 1, 1));
      drawText("Description", tableLeft + colQtyW + 10, headerTextY, 12, true, rgb(1, 1, 1));
      drawText("Indent No", tableLeft + colQtyW + colDescW + 10, headerTextY, 12, true, rgb(1, 1, 1));
      const totalRows = Math.max(rows.length, 6);
      const tableHeight = headerHeight + totalRows * rowHeight;
      const tableBottom = tableTop - tableHeight;
      page.drawRectangle({ x: tableLeft, y: tableBottom, width: tableWidth, height: tableHeight, borderColor: rgb(0, 0, 0), borderWidth: 1 });
      const xCol1 = tableLeft + colQtyW;
      const xCol2 = tableLeft + colQtyW + colDescW;
      page.drawLine({ start: { x: xCol1, y: tableBottom }, end: { x: xCol1, y: tableTop }, color: rgb(0, 0, 0), thickness: 1 });
      page.drawLine({ start: { x: xCol2, y: tableBottom }, end: { x: xCol2, y: tableTop }, color: rgb(0, 0, 0), thickness: 1 });
      page.drawLine({ start: { x: tableLeft, y: tableTop - headerHeight }, end: { x: tableRight, y: tableTop - headerHeight }, color: rgb(0, 0, 0), thickness: 1 });
      let cursorY = tableTop - headerHeight - 15;
      const maxDescriptionCharsPerLine = 60;
      for (let i = 0; i < Math.min(rows.length, totalRows); i++) {
        const r = rows[i];
        const isLastActualRow = i === rows.length - 1;
        const note = "Note: Sample have been returned";
        const descriptionText =
          isLastActualRow && options.sampleReturned
            ? (r.description ? `${r.description} | ${note}` : note)
            : r.description;
        drawText(r.qty, tableLeft + 10, cursorY, 11);
        const descLines: string[] = [];
        for (let start = 0; start < descriptionText.length; start += maxDescriptionCharsPerLine) {
          descLines.push(descriptionText.slice(start, start + maxDescriptionCharsPerLine));
        }
        for (let li = 0; li < Math.min(2, descLines.length); li++) {
          const line = descLines[li];
          drawText(line, tableLeft + colQtyW + 8, cursorY - li * 12, 11);
        }
        drawText(r.indno, tableLeft + colQtyW + colDescW + 10, cursorY, 11);
        cursorY -= rowHeight;
      }
      const sigY = tableBottom - 50;
      page.drawLine({ start: { x: marginLeft, y: sigY }, end: { x: marginLeft + 180, y: sigY }, color: midGray, thickness: 1 });
      drawText("Prepared By", marginLeft, sigY - 12, 10, true);
      page.drawLine({ start: { x: width - marginRight - 180, y: sigY }, end: { x: width - marginRight, y: sigY }, color: midGray, thickness: 1 });
      drawText("Received By", width - marginRight - 160, sigY - 12, 10, true);
      const noteText = "Note: This is a computer-generated document and does not require a signature.";
      const noteSize = 10;
      const noteWidth = measure(noteText, noteSize, true);
      const noteX = marginLeft + (contentWidth - noteWidth) / 2;
      drawText(noteText, noteX, 50, noteSize, true);
      drawText("Thank you for your business.", marginLeft, 32, 9, true);
      drawText("Page 1 of 1", width - marginRight - measure("Page 1 of 1", 9, true), 32, 9, true);
      drawText("ZUMECH", width / 2 - 140, height / 2 + 40, 80, true, lightGray, { opacity: 0.08, rotateDeg: -25 });
      const pdfBytes = await pdfDoc.save();
      return pdfBytes;
    };

    const handleReprint = async (row: ChallanRow) => {
      try {
        const rows = toRowData(row.Description);
        const bytes = await generatePdfBytes(rows, {
          gp: row.GP ?? undefined,
          po: row.PO ?? null,
          challan: row.challanno != null ? String(row.challanno).padStart(5, "0") : null,
          sampleReturned: Boolean(row.Sample_returned),
        });
        const blob = new Blob([bytes.slice(0)], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank");
        if (win) setTimeout(() => { try { win.focus(); } catch {} }, 500);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        console.error("Reprint failed:", e);
        alert("Failed to generate PDF for reprint.");
      }
    };
    const handleRedownload = async (row: ChallanRow) => {
      try {
        const rows = toRowData(row.Description);
        const bytes = await generatePdfBytes(rows, {
          gp: row.GP ?? undefined,
          po: row.PO ?? null,
          challan: row.challanno != null ? String(row.challanno).padStart(5, "0") : null,
          sampleReturned: Boolean(row.Sample_returned),
        });
        const blob = new Blob([bytes.slice(0)], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const filename = `Challan_${row.challanno != null ? String(row.challanno).padStart(5, "0") : "unknown"}.pdf`;
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        console.error("Redownload failed:", e);
        alert("Failed to generate PDF for download.");
      }
    };

    return (
      <div className="flex min-h-screen w-full items-start gap-5 lg:gap-7 p-4 lg:p-6 overflow-hidden">
        <div className="flex-1 min-w-0">
          <div className="rounded-xl bg-black p-4 lg:p-6 shadow text-white">
            <div className="mb-4">
              <Nav href1="/Challan" name1="Generate" href2="/Challan/inquery" name2="Inquery" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-base lg:text-lg font-semibold">Challan Inquiry</h1>
              <button onClick={openFilterModal} className="px-3 py-1.5 text-xs bg-[var(--accent)] text-black rounded-md hover:opacity-90">Filters</button>
            </div>
            <div className="mt-4 text-xs text-white/70">{loading ? "Loading..." : error ? `Error: ${error}` : `${results.length} result(s)`}</div>
            <div className="mt-4 overflow-auto rounded-xl border border-white/10 h-[70vh] max-h-[70vh] bg-black p-2">
              <div className="hidden md:grid grid-cols-12 bg-[var(--accent)] text-white text-xs rounded-md mb-2">
                <div className="col-span-2 px-2 py-2">Challan no</div>
                <div className="col-span-2 px-2 py-2">Date</div>
                <div className="col-span-2 px-2 py-2">PO</div>
                <div className="col-span-2 px-2 py-2">GP</div>
                <div className="col-span-4 px-2 py-2">Description</div>
              </div>
              <div className="space-y-4">
                {results.map((row) => {
                  const challanStr = row.challanno != null ? String(row.challanno).padStart(5, "0") : "-";
                  const dateStr = row.Date ? String(row.Date) : row.created_at ? new Date(row.created_at).toLocaleString() : "-";
                  const poStr = row.PO ?? "-";
                  const gpStr = row.GP ?? "-";
                  return (
                    <div key={row.id} className="rounded-xl border border-[var(--accent)] overflow-hidden mb-4 bg-black">
                      <div className="grid grid-cols-12 gap-2 items-start text-white p-3">
                        <div className="col-span-6 md:col-span-2 px-2">
                          <div className="text-[11px] uppercase text-white/60">Challan no</div>
                          <div className="text-sm font-semibold">{challanStr}</div>
                        </div>
                        <div className="col-span-6 md:col-span-2 px-2">
                          <div className="text-[11px] uppercase text-white/60">Date</div>
                          <div className="text-sm font-semibold whitespace-nowrap">{dateStr}</div>
                        </div>
                        <div className="col-span-6 md:col-span-1 px-2">
                          <div className="text-[11px] uppercase text-white/60">PO</div>
                          <div className="text-sm font-semibold whitespace-nowrap">{poStr}</div>
                        </div>
                        <div className="col-span-6 md:col-span-2 px-2">
                          <div className="text-[11px] uppercase text-white/60">GP</div>
                          <div className="text-sm font-semibold whitespace-nowrap">{gpStr}</div>
                        </div>
                        <div className="col-span-12 md:col-span-5 min-w-0">{renderLines(row.Description)}</div>
                        <div className="col-span-12 md:col-span-12 mt-2">
                          <div className="flex flex-wrap gap-2 items-center">
                            <Link
                              href={
                                row.id != null
                                  ? `/Challan?editId=${encodeURIComponent(String(row.id))}`
                                  : `/Challan?editChallan=${encodeURIComponent(String(row.challanno ?? ""))}`
                              }
                              className="px-3 py-1 text-xs bg-white/10 text-white rounded-md hover:bg-white/20"
                              title={row.id != null ? "Edit this challan" : "Edit this challan (by challan number)"}
                            >
                              Edit
                            </Link>
                            <button onClick={() => handleReprint(row)} className="px-3 py-1 text-xs bg-[var(--accent)] text-white rounded-md hover:opacity-90" title="Open challan PDF for printing">Reprint</button>
                            <button onClick={() => handleRedownload(row)} className="px-3 py-1 text-xs bg-white/10 text-white rounded-md hover:bg-white/20" title="Download challan PDF">Download PDF</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {showFilterModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-4xl bg-[#1e1e1e] border border-[var(--accent)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40">
                <div>
                  <h2 className="text-xl font-bold text-white">Filter Challans</h2>
                  <p className="text-xs text-white/50 mt-1">Set filter options and apply to the list</p>
                </div>
                <button onClick={() => setShowFilterModal(false)} className="text-white/50 hover:text-white transition">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-6 flex-1 overflow-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white/5 rounded-xl border border-white/5 items-end">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider">Challan Number</label>
                    <input type="text" value={tempFilters.challan} onChange={(e) => setTempFilters(f => ({ ...f, challan: e.target.value }))} className="w-full bg-black/40 border-b-2 border-white/20 focus:border-[var(--accent)] outline-none text-sm py-2 px-1 text-white transition-colors" placeholder="e.g. 34 or 00034" />
                  </div>
                  <div className="relative space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider">Company</label>
                    <input type="text" value={tempFilters.company} onFocus={() => setFilterCompanyDropdownOpen(true)} onChange={(e) => { setTempFilters(f => ({ ...f, company: e.target.value })); setFilterCompanyDropdownOpen(true); }} className="w-full bg-black/40 border-b-2 border-white/20 focus:border-[var(--accent)] outline-none text-sm py-2 px-1 text-white transition-colors" placeholder="Type to search company" />
                    {filterCompanyDropdownOpen && (
                      <div className="absolute left-0 right-0 z-30 mt-2 max-h-48 overflow-auto bg-black border border-white/10 rounded-md shadow-xl">
                        {companyOptions.filter(opt => opt.toLowerCase().includes((tempFilters.company || "").toLowerCase())).slice(0, 50).map(opt => (
                          <button key={opt} className="block w-full text-left px-3 py-2 text-xs hover:bg-white/10" onClick={() => { setTempFilters(f => ({ ...f, company: opt })); setFilterCompanyDropdownOpen(false); }}>{opt}</button>
                        ))}
                        {companyOptions.length === 0 && (<div className="px-3 py-2 text-xs text-white/60">No companies</div>)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider">Item Name</label>
                    <input type="text" value={tempFilters.item} onChange={(e) => setTempFilters(f => ({ ...f, item: e.target.value }))} className="w-full bg-black/40 border-b-2 border-white/20 focus:border-[var(--accent)] outline-none text-sm py-2 px-1 text-white transition-colors" placeholder="Smart search: words and typos OK" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/5 rounded-xl border border-white/5 items-end">
                  <DatePicker label="From" value={tempFilters.from} onChange={(d) => setTempFilters(f => ({ ...f, from: d }))} className="w-full" />
                  <DatePicker label="To" value={tempFilters.to} onChange={(d) => setTempFilters(f => ({ ...f, to: d }))} className="w-full" />
                </div>
              </div>
              <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-black/40">
                <button onClick={() => setShowFilterModal(false)} className="px-5 py-2 rounded-lg text-xs font-bold text-white/70 hover:text-white transition">Cancel</button>
                <button onClick={applyFilters} className="bg-[var(--accent)] text-black px-8 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition shadow-lg">Apply Filters</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  export default ChallanInquiryPage;
  
