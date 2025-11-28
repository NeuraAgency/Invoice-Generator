"use client";
import React, { useEffect, useState } from "react";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

interface RowData {
  qty: string;
  description: string;
  indno: string;
  gpno?: string;
}

type PDFPreviewProps = {
  rows: RowData[];
  gpno?: string;
  po?: string | null;
  challan?: string | null;
};

export default function Preview(props: PDFPreviewProps) {
  const { rows } = props;
  const effectiveGpNo = props.gpno ?? rows?.[0]?.gpno ?? "";
  const [effectivePo, setEffectivePo] = useState<string>(props.po ?? "");
  const [effectiveChallan, setEffectiveChallan] = useState<string>(props?.challan ?? "");

  // NEW: track whether sample has been returned
  const [sampleReturned, setSampleReturned] = useState<boolean>(false);

  useEffect(() => {
    if (props?.po) {
      setEffectivePo(props.po);
    } else {
      try {
        setEffectivePo(localStorage.getItem("latestPO") ?? "");
      } catch {
        setEffectivePo("");
      }
    }
    if (props?.challan) {
      setEffectiveChallan(props.challan);
    } else {
      try {
        setEffectiveChallan(localStorage.getItem("latestChallan") ?? "");
      } catch {
        setEffectiveChallan("");
      }
    }
    // load sampleReturned flag
    try {
      const stored = localStorage.getItem("sampleReturned");
      setSampleReturned(stored === "true");
    } catch {
      setSampleReturned(false);
    }
  }, [props.po, props.challan, rows]);

  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent)?.detail;
        if (detail?.challan) setEffectiveChallan(String(detail.challan));
      } catch {}
    };
    window.addEventListener("latestChallanUpdated", handler as EventListener);
    return () => window.removeEventListener("latestChallanUpdated", handler as EventListener);
  }, []);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    async function generatePDF() {
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
      } catch (err) {
        console.warn("Logo load error:", err);
      }
      const topAfterLogo = height - 160;
      const leftColX = marginLeft;
      const rightColX = width - marginRight - 90;
      const lineGap = 13;
      const smallSize = 10;
      const date = new Date().toLocaleDateString();
      const PO = effectivePo || "";
      const challan = effectiveChallan || "";
      const Company_Name = "Kassim Textile Mills Limited";

      drawLabelValue("Email", "z.ushahid@gmail.com", leftColX, topAfterLogo, smallSize);
      drawLabelValue("Contact", "03092308078", leftColX, topAfterLogo - lineGap, smallSize);
      drawLabelValue("Challan No", challan, leftColX, topAfterLogo - 2 * lineGap, smallSize);
      drawLabelValue("Date", date, leftColX, topAfterLogo - 3 * lineGap, smallSize);

      drawLabelValue("P.O. No", PO, rightColX, topAfterLogo, smallSize);
      drawLabelValue("G.P. No", effectiveGpNo, rightColX, topAfterLogo - lineGap, smallSize);
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

        // Base description
        let desc = r.description || "";

        // If this is the last actual row and sampleReturned is true, append the note
        const isLastActualRow = i === rows.length - 1;
        if (isLastActualRow && sampleReturned) {
          const note = "Note: Sample have been returned";
          desc = desc ? `${desc} | ${note}` : note;
        }

        drawText(r.qty, tableLeft + 10, cursorY, 11);

        const descLines: string[] = [];
        for (let start = 0; start < desc.length; start += maxDescriptionCharsPerLine) {
          descLines.push(desc.slice(start, start + maxDescriptionCharsPerLine));
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
      const ab = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(ab).set(pdfBytes);
      const blob = new Blob([ab], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    }

    generatePDF();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [rows, effectiveChallan, effectivePo, sampleReturned]);

  return (
    <div className="w-full h-full flex items-start justify-start">
      {pdfUrl ? (
        <iframe src={pdfUrl} className="w-full h-full border shadow-lg" title="PDF Preview" />
      ) : (
        <div>Generating PDF...</div>
      )}
    </div>
  );
}
