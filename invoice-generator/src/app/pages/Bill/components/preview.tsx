"use client";
import React, { useEffect, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface RowData {
  qty: string;
  description: string;
  amount: string;
}

const Preview: React.FC<{ rows: RowData[] }> = ({ rows }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [bill, setBill] = useState<string>("00000");
  const [invoiceChallan, setInvoiceChallan] = useState<string>("00000");
  const [invoiceGP, setInvoiceGP] = useState<string>("");
  const date = new Date().toLocaleDateString();
  const PO = "00001";
  // challan and GP are read from localStorage values saved on selection
  const challan = invoiceChallan;
  const GP = invoiceGP || "";
  const Company_Name = "Kassim Textile Mills Limited";

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
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
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
          color,
        });
      };

      const marginLeft = 40;
      const marginRight = 40;
      const contentWidth = width - marginLeft - marginRight;

      // Logo
      try {
        const logoBytes = await fetch("/zumech.png").then((r) => r.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const targetLogoWidth = Math.min(420, contentWidth);
        const targetLogoHeight = (logoImage.height / logoImage.width) * targetLogoWidth;
        const logoX = marginLeft + (contentWidth - targetLogoWidth) / 2;
        const logoY = height - 20 - targetLogoHeight;
        page.drawImage(logoImage, {
          x: logoX,
          y: logoY,
          width: targetLogoWidth,
          height: targetLogoHeight,
        });
      } catch (err) {
        // ignore logo errors
      }

      const topAfterLogo = height - 160;

      // Header info
      const leftColX = marginLeft;
      const rightColX = width - marginRight - 90;
      const lineGap = 13;
      const smallSize = 10;

      drawText("Email: z.ushahid@gmail.com", leftColX, topAfterLogo, smallSize);
      drawText("Contact: 03092308078", leftColX, topAfterLogo - lineGap, smallSize);
      drawText(`Bill No: ${bill}`, leftColX, topAfterLogo - 2 * lineGap, smallSize);
      drawText(`Challan No: ${challan}`, leftColX, topAfterLogo - 3 * lineGap, smallSize);
      drawText(`Date: ${date}`, leftColX, topAfterLogo - 4 * lineGap, smallSize);

      drawText(`P.O. No: ${PO}`, rightColX, topAfterLogo, smallSize);
      drawText(`G.P. No: ${GP}`, rightColX, topAfterLogo - lineGap, smallSize);

      // Titles
      const companySize = 24;
      const titleSize = 20;
      const companyText = `Company Name: ${Company_Name}`;
      const companyX = marginLeft;
      const companyY = topAfterLogo - 110; // add more space above company name
      drawText(companyText, companyX, companyY, companySize, true);

      const titleText = "Invoice";
      const titleX = marginLeft + contentWidth / 2 - 40;
      const titleY = companyY - 30;
      drawText(titleText, titleX, titleY, titleSize, true);

      // Table
      const tableTop = titleY - 20;
      const tableLeft = marginLeft;
      const tableRight = width - marginRight;
      const tableWidth = tableRight - tableLeft;
      const headerHeight = 24;
      const rowHeight = 22;
      const colQtyW = 60;
      const colAmtW = 90;
      const colDescW = tableWidth - colQtyW - colAmtW;

      // Header background
      page.drawRectangle({
        x: tableLeft,
        y: tableTop - headerHeight,
        width: tableWidth,
        height: headerHeight,
        color: rgb(0, 0, 0),
      });

      const headerTextY = tableTop - headerHeight + 7;
      drawText("Qty", tableLeft + 10, headerTextY, 11, true, rgb(1, 1, 1));
      drawText("Description", tableLeft + colQtyW + 10, headerTextY, 11, true, rgb(1, 1, 1));
      drawText("Amount", tableLeft + colQtyW + colDescW + 10, headerTextY, 11, true, rgb(1, 1, 1));

      const totalRows = Math.max(rows.length, 6);
      const tableHeight = headerHeight + totalRows * rowHeight;
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

      page.drawLine({
        start: { x: tableLeft, y: tableTop - headerHeight },
        end: { x: tableRight, y: tableTop - headerHeight },
        color: rgb(0, 0, 0),
        thickness: 1,
      });

      // Helper to parse numbers safely (handles commas)
      const toNum = (v: string) => {
        if (!v) return 0;
        const n = parseFloat(String(v).replace(/,/g, ''));
        return Number.isFinite(n) ? n : 0;
      };

      // Render rows and compute line totals (Amount = Qty × Rate)
      let cursorY = tableTop - headerHeight - 15;
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
        page.drawLine({
          start: { x: tableLeft, y: cursorY - 6 },
          end: { x: tableRight, y: cursorY - 6 },
          color: rgb(0, 0, 0),
          thickness: 0.5,
        });
        cursorY -= rowHeight;
      }

      // Total row
      const total = rows.reduce((sum, r) => {
        const qtyNum = toNum(r.qty);
        const rateNum = toNum(r.amount);
        return sum + qtyNum * rateNum;
      }, 0);
      drawText(`Total: Rs. ${total.toFixed(2)}`, tableLeft, tableBottom - 20, 12, true);

      // Note
      drawText(
        "Note: This is a computer-generated document and does not require a signature.",
        marginLeft,
        40,
        9
      );

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
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
