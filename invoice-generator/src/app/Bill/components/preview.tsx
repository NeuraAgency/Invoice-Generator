"use client";
import React, { useEffect, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
interface RowData {
  qty: string;
  description: string;
  rate?: string;
  amount?: string;
}
const Preview: React.FC<{ rows: RowData[] }> = ({ rows }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [bill, setBill] = useState<string>("00000");
  const [invoiceChallan, setInvoiceChallan] = useState<string>("00000");
  const [invoiceGP, setInvoiceGP] = useState<string>("");
  const date = new Date().toLocaleDateString();
  const PO = "00000";
  const challan = invoiceChallan;
  const GP = invoiceGP || "";
  useEffect(() => {
    try {
      const storedBill = localStorage.getItem("latestBill");
      if (storedBill) setBill(storedBill);
      const storedChallan = localStorage.getItem("latestInvoiceChallan");
      if (storedChallan) setInvoiceChallan(storedChallan);
      const storedGP = localStorage.getItem("latestInvoiceGP");
      if (storedGP) setInvoiceGP(storedGP);
    } catch {}
    async function generatePDF() {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const drawText = (
        t: string,
        x: number,
        y: number,
        s = 12,
        b = false,
        c = rgb(0, 0, 0)
      ) => {
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
        const logoBytes = await fetch("/zumech.png").then((r) =>
          r.arrayBuffer()
        );
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
      drawText(`Bill No: ${bill}`, leftColX, topAfterLogo - 2 * gap, small);
      drawText(
        `Challan No: ${challan}`,
        leftColX,
        topAfterLogo - 3 * gap,
        small
      );
      drawText(`Date: ${date}`, leftColX, topAfterLogo - 4 * gap, small);
      drawText(`P.O. No: ${PO}`, rightColX, topAfterLogo, small);
      drawText(`G.P. No: ${GP}`, rightColX, topAfterLogo - gap, small);
      const storedCompany = typeof window !== 'undefined' ? localStorage.getItem('invoiceCompanyName') : null;
      const Company_Name = storedCompany || "Mekotex P.V.T Limited";
      const companySize = 24,
        titleSize = 25;
      drawText(
        `Company Name: ${Company_Name}`,
        marginLeft,
        topAfterLogo - 110,
        companySize,
        true
      );
      drawText(
        "Invoice",
        marginLeft + contentWidth / 2 - 40,
        topAfterLogo - 160,
        titleSize,
        true
      );
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
      page.drawRectangle({
        x: tableLeft,
        y: tableTop - headerH,
        width: tableWidth,
        height: headerH,
        color: rgb(0, 0, 0),
      });
      const headerY = tableTop - headerH + 7;
      drawText("Qty", tableLeft + 10, headerY, 11, true, rgb(1, 1, 1));
      drawText(
        "Description",
        tableLeft + colQtyW + 10,
        headerY,
        11,
        true,
        rgb(1, 1, 1)
      );
      drawText(
        "Rate",
        tableLeft + colQtyW + colDescW + 10,
        headerY,
        11,
        true,
        rgb(1, 1, 1)
      );
      drawText(
        "Amount",
        tableLeft + colQtyW + colDescW + colRateW + 10,
        headerY,
        11,
        true,
        rgb(1, 1, 1)
      );
      const totalRows = Math.max(rows.length, 6);
      const tableHeight = headerH + totalRows * rowH;
      const tableBottom = tableTop - tableHeight;
      page.drawRectangle({
        x: tableLeft,
        y: tableBottom,
        width: tableWidth,
        height: tableHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
      const xCol1 = tableLeft + colQtyW;
      const xCol2 = tableLeft + colQtyW + colDescW;
      const xCol3 = tableLeft + colQtyW + colDescW + colRateW;
      page.drawLine({
        start: { x: xCol1, y: tableBottom },
        end: { x: xCol1, y: tableTop },
        color: rgb(0, 0, 0),
        thickness: 1,
      });
      page.drawLine({
        start: { x: xCol2, y: tableBottom },
        end: { x: xCol2, y: tableTop },
        color: rgb(0, 0, 0),
        thickness: 1,
      });
      // vertical separator between Rate and Amount
      page.drawLine({
        start: { x: xCol3, y: tableBottom },
        end: { x: xCol3, y: tableTop },
        color: rgb(0, 0, 0),
        thickness: 1,
      });
      page.drawLine({
        start: { x: tableLeft, y: tableTop - headerH },
        end: { x: tableRight, y: tableTop - headerH },
        color: rgb(0, 0, 0),
        thickness: 1,
      });
      const toNum = (v: string) => {
        if (!v) return 0;
        const n = parseFloat(String(v).replace(/,/g, ""));
        return Number.isFinite(n) ? n : 0;
      };
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
          drawText(
            rateNum ? rateNum.toFixed(2) : r.rate || r.amount || "",
            tableLeft + colQtyW + colDescW + 10,
            cursorY,
            10
          );
          // Amount column (qty * rate)
          drawText(
            lineTotal ? lineTotal.toFixed(2) : "",
            tableLeft + colQtyW + colDescW + colRateW + 10,
            cursorY,
            10
          );
        }
        page.drawLine({
          start: { x: tableLeft, y: cursorY - 6 },
          end: { x: tableRight, y: cursorY - 6 },
          color: rgb(0, 0, 0),
          thickness: 0.5,
        });
        cursorY -= rowH;
      }
      const total = rows.reduce((sum, r) => {
        const qtyNum = toNum(r.qty);
        const rateNum = toNum(r.rate ?? r.amount ?? "");
        return sum + qtyNum * rateNum;
      }, 0);
      drawText(
        `Total: Rs. ${total.toFixed(2)}`,
        tableLeft,
        tableBottom - 20,
        12,
        true
      );
      drawText(
        "Note: This is a computer-generated document and does not require a signature.",
        marginLeft,
        40,
        9
      );
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      setPdfUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    }
    generatePDF();
    return () => {
      setPdfUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
    };
  }, [rows, bill, invoiceChallan, invoiceGP]);
  return (
    <div className="w-full h-screen flex flex-col items-start gap-4">
      <div className="w-full h-[580px] rounded-xl shadow-lg overflow-hidden bg-white">
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Invoice Preview"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
            Generating preview...
          </div>
        )}
      </div>
      {pdfUrl && (
        <a
          href={pdfUrl}
          download={`Invoice-${bill}.pdf`}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition"
        >
          Download Invoice
        </a>
      )}
    </div>
  );
};
export default Preview;
