"use client";
import React, { useEffect, useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface RowData {
	description: string;
	rate: string;
	isNote?: boolean;
}

const Preview: React.FC<{ rows: RowData[]; industryName: string }> = ({
	rows,
	industryName,
}) => {
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);
	const [today, setToday] = useState<string>("");

	useEffect(() => {
		setToday(new Date().toLocaleDateString());
	}, []);

	useEffect(() => {
		async function generatePDF() {
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
				const logoBytes = await fetch("/zumech.png").then((r) => r.arrayBuffer());
				const logoImage = await pdfDoc.embedPng(logoBytes);
				// Make logo as large as fits the content width (max 420) and center it
				const logoWidth = Math.min(420, contentWidth);
				const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
				const logoX = marginX + (contentWidth - logoWidth) / 2; // Center within margins
				page.drawImage(logoImage, {
					x: logoX,
					y: height - logoHeight - 10,
					width: logoWidth,
					height: logoHeight,
				});

				// Contact info below logo, centered and slightly closer
				const contactText = "Contact#: 0309 2308078";
				const emailText = "Email: z.ushahid@gmail.com";
				const textWidthContact = fontBold.widthOfTextAtSize(contactText, 10);
				const textWidthEmail = fontBold.widthOfTextAtSize(emailText, 10);

				drawText(contactText, (width - textWidthContact) / 2, height - logoHeight - 30, 10, true);
				drawText(emailText, (width - textWidthEmail) / 2, height - logoHeight - 46, 10, true);

			} catch {
				drawText("Z.U MECHANICAL WORKS", marginX, height - 60, 22, true);
			}

			// Removed old contact info placement
			// drawText("Contact#: 0309 2308078", marginX + 180, height - 40, 10, true);
			// drawText("Email: z.ushahid@gmail.com", marginX + 180, height - 55, 10, true);

			// Move date slightly lower to sit closer to the title
			drawText(`DATE: ${today || "__________"}`, marginX, height - 190, 12);
			
			const quoteTitle = "QUOTATION";
			const quoteSize = 32; // Larger font
			const quoteWidth = fontBold.widthOfTextAtSize(quoteTitle, quoteSize);
			const quoteX = (width - quoteWidth) / 2;
			const quoteY = height - 240;

			drawText(quoteTitle, quoteX, quoteY, quoteSize, true);
			

			drawText(
				`Industry Name: ${industryName || "_______________________"}`,
				marginX,
				height - 300, // moved lower
				25, // Increased font
				true
			);

			const tableTop = height - 350; // moved lower
			const tableLeft = marginX;
			const tableRight = width - marginX;
			const tableWidth = tableRight - tableLeft;
			const headerHeight = 24;
			const rowHeight = 22;
			const totalRows = Math.max(rows.length, 9);
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

			drawText("S#", tableLeft + 15, tableTop - headerHeight + 7, 12, true, rgb(1, 1, 1));
			drawText(
				"Description",
				tableLeft + colSNo + (colDesc / 2) - 30,
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
				const r = rows[i];
				const hasDescription = !!(r && (r.description || "").toString().trim());
				const isNote = !!(r && r.isNote);
				if (isNote) {
					// show NOTE in S# column and render the note text in description column
					drawText("NOTE", tableLeft + 14, cursorY, 11, true);
					drawText(r.description || "", tableLeft + colSNo + 10, cursorY, 11);
				} else if (hasDescription) {
					displayIdx += 1;
					drawText(String(displayIdx), tableLeft + 14, cursorY, 11, true);
					if (r) {
						drawText(r.description || "", tableLeft + colSNo + 10, cursorY, 11);
						drawText(r.rate || "", tableLeft + colSNo + colDesc + 12, cursorY, 11);
					}
				} else {
					// leave S# blank for empty rows
				}
				page.drawLine({
					start: { x: tableLeft, y: cursorY - 6 },
					end: { x: tableRight, y: cursorY - 6 },
					color: rgb(0, 0, 0),
					thickness: 0.7,
				});
				cursorY -= rowHeight;
			}

			// Signature area moved to bottom-right of the page - draw label and image on same row
			const signX = width - marginX - 220; // leave extra room for label + image
			const signY = 60; // baseline distance from bottom
			const label = "Signature:";
			const labelSize = 10;
			const labelWidth = font.widthOfTextAtSize(label, labelSize);
			try {
				const sigBytes = await fetch("/sign.png").then((r) => r.arrayBuffer());
				const sigImage = await pdfDoc.embedPng(sigBytes);
				const maxSigWidth = 140;
				const sigHeight = (sigImage.height / sigImage.width) * maxSigWidth;
				// draw label then image to its right on same baseline
				drawText(label, signX, signY, labelSize);
				const imgX = signX + labelWidth + 8;
				// position image so its vertical center roughly aligns with text baseline
				const imgY = signY - sigHeight / 2 + (labelSize / 2);
				page.drawImage(sigImage, {
					x: imgX,
					y: imgY,
					width: maxSigWidth,
					height: sigHeight,
				});
			} catch {
				// fallback: draw label then a line for signature to the right
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
			setPdfUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return url;
			});
		}

		generatePDF();

		return () => {
			setPdfUrl((prev) => {
				if (prev) URL.revokeObjectURL(prev);
				return null;
			});
		};
	}, [rows, industryName, today]);

	return (
		<div className="w-full h-screen flex flex-col items-start gap-4">
			<div className="w-full h-[580px] rounded-xl shadow-lg overflow-hidden bg-white">
				{pdfUrl ? (
					<iframe
						src={pdfUrl}
						className="w-full h-full border-0"
						title="Quotation Preview"
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
					download="Quotation.pdf"
					className="inline-flex items-center px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition"
				>
					Download Quotation
				</a>
			)}
		</div>
	);
};

export default Preview;
