"use client";
import React, { useEffect, useMemo, useState } from "react";
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
};
const ChallanInquiryPage = () => {
  const [challanQuery, setChallanQuery] = useState("");
  const [results, setResults] = useState<ChallanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (challanQuery.trim()) params.set("challan", challanQuery.trim());
    params.set("limit", "50");
    return params.toString();
  }, [challanQuery]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/challan?${qs}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (e?.name !== "AbortError")
          setError(e?.message || "Failed to load challans");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [qs]);
  const toItems = (desc: unknown): any[] => {
    if (Array.isArray(desc)) return desc;
    if (!desc) return [];
    return [desc];
  };
  const renderLines = (raw: unknown) => {
    const arr = toItems(raw);
    if (arr.length === 0)
      return <div className="text-xs text-gray-500">No items</div>;
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
            const desc =
              d?.description ?? d?.materialDescription ?? d?.desc ?? "";
            const ind = d?.indNo ?? d?.indno ?? "";
            return (
              <div
                key={i}
                className="grid grid-cols-12 bg-black/80 text-white text-xs border-t border-white/10"
              >
                <div className="col-span-2 px-3 py-2">{String(qty)}</div>
                <div className="col-span-8 py-2 break-words whitespace-normal">
                  {String(desc)}
                </div>
                <div
                  className="col-span-2 py-2 tabular-nums"
                  title={String(ind)}
                >
                  {String(ind)}
                </div>
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
      description: String(
        d?.description ?? d?.materialDescription ?? d?.desc ?? ""
      ),
      indno: String(d?.indNo ?? d?.indno ?? ""),
    }));
  };

  const generatePdfBytes = async (
    rows: { qty: string; description: string; indno: string }[],
    options: { gp?: string; po?: string | null; challan?: string | null }
  ) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const measure = (text: string, size: number, bold = false) =>
      (bold ? fontBold : font).widthOfTextAtSize(text, size);
    const drawText = (
      text: string,
      x: number,
      y: number,
      size = 12,
      bold = false,
      color = rgb(0, 0, 0),
      extra?: { opacity?: number; rotateDeg?: number }
    ) => {
      page.drawText(text, {
        x,
        y,
        size,
        font: bold ? fontBold : font,
        color,
        opacity: extra?.opacity,
        rotate: extra?.rotateDeg ? degrees(extra.rotateDeg) : undefined,
      });
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
      drawText(r.qty, tableLeft + 10, cursorY, 11);
      const descLines: string[] = [];
      for (let start = 0; start < r.description.length; start += maxDescriptionCharsPerLine) {
        descLines.push(r.description.slice(start, start + maxDescriptionCharsPerLine));
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
      });
      const blob = new Blob([bytes.slice(0)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      // Attempt to trigger print in the new tab
      if (win) {
        // Some browsers allow focusing then printing; if blocked, user can print manually
        setTimeout(() => {
          try {
            win.focus();
          } catch {}
        }, 500);
      }
      // Revoke later
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
      });
      const blob = new Blob([bytes.slice(0)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = `Challan_${row.challanno != null ? String(row.challanno).padStart(5, "0") : "unknown"}.pdf`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
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
            <Nav
              href1="/Challan"
              name1="Generate"
              href2="/Challan/inquery"
              name2="Inquery"
            />
          </div>
          <h1 className="text-base lg:text-lg font-semibold mb-3">
            Challan Inquiry
          </h1>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[11px] font-medium text-white">
                Challan Number
              </label>
              <input
                type="text"
                value={challanQuery}
                onChange={(e) => setChallanQuery(e.target.value)}
                className="mt-1 w-40 text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/60"
                placeholder="e.g. 34 or 00034"
              />
            </div>
          </div>
          <div className="mt-4 text-xs text-white/70">
            {loading
              ? "Loading..."
              : error
              ? `Error: ${error}`
              : `${results.length} result(s)`}
          </div>
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
                const challanStr =
                  row.challanno != null
                    ? String(row.challanno).padStart(5, "0")
                    : "-";
                const dateStr = row.Date
                  ? String(row.Date)
                  : row.created_at
                  ? new Date(row.created_at).toLocaleString()
                  : "-";
                const poStr = row.PO ?? "-";
                const gpStr = row.GP ?? "-";
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-[var(--accent)] overflow-hidden mb-4 bg-black"
                  >
                    <div className="grid grid-cols-12 gap-2 items-start text-white p-3">
                      <div className="col-span-6 md:col-span-2 px-2">
                        <div className="text-[11px] uppercase text-white/60">
                          Challan no
                        </div>
                        <div className="text-sm font-semibold">
                          {challanStr}
                        </div>
                      </div>
                      <div className="col-span-6 md:col-span-2 px-2">
                        <div className="text-[11px] uppercase text-white/60">
                          Date
                        </div>
                        <div className="text-sm font-semibold whitespace-nowrap">
                          {dateStr}
                        </div>
                      </div>
                      <div className="col-span-6 md:col-span-1 px-2">
                        <div className="text-[11px] uppercase text-white/60">
                          PO
                        </div>
                        <div className="text-sm font-semibold whitespace-nowrap">
                          {poStr}
                        </div>
                      </div>
                      <div className="col-span-6 md:col-span-2 px-2">
                        <div className="text-[11px] uppercase text-white/60">
                          GP
                        </div>
                        <div className="text-sm font-semibold whitespace-nowrap">
                          {gpStr}
                        </div>
                      </div>
                      <div className="col-span-12 md:col-span-5 min-w-0">
                        {renderLines(row.Description)}
                      </div>
                      <div className="col-span-12 md:col-span-12 mt-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            onClick={() => handleReprint(row)}
                            className="px-3 py-1 text-xs bg-[var(--accent)] text-white rounded-md hover:opacity-90"
                            title="Open challan PDF for printing"
                          >
                            Reprint
                          </button>
                          <button
                            onClick={() => handleRedownload(row)}
                            className="px-3 py-1 text-xs bg-white/10 text-white rounded-md hover:bg-white/20"
                            title="Download challan PDF"
                          >
                            Download PDF
                          </button>
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
    </div>
  );
};
export default ChallanInquiryPage;
