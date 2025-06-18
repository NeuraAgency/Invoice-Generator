"use client";
import React, { useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const preview = () => {
  const date = new Date().toLocaleDateString();
  const PO = "00001";
  const challan = "00001";
  const GP = "00001";
  const bill = "00001";
  const Company_Name = "Kassim Textile Mills Limited";

  // Ref for the Preview div
  const previewRef = useRef<HTMLDivElement>(null);

  const handleSaveAsPDF = async () => {
    if (previewRef.current) {
      const scale = 2;
      const canvas = await html2canvas(previewRef.current, { scale });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

      pdf.save(`Invoice-${bill}.pdf`);
    }
  };

  return (
    <div className="flex flex-col items-start justify-around">
      <div
        ref={previewRef}
        className="Preview w-[794px] h-[950px] bg-white flex flex-col items-center p-8 rounded-xl shadow-lg overflow-hidden"
      >
        <img src="/zumech.png" alt="Z.U Mechanical Works" />

        <div className="flex items-start justify-between w-full mt-4">
          <div className="text-black font-bold text-sm">
            <p className="leading-[1]">Email: z.ushahid@gmail.com</p>
            <p className="leading-[1]">Contact: 03092308078</p>
            <p className="leading-[1]">Bill No: 00001</p>
            <p className="leading-[1]">Challan No: 00001</p>
            <p className="leading-[1]">Date: {date}</p>
          </div>
          <div className="text-black font-bold text-sm mt-4">
            <p className="font-bold">P.O. No: {PO}</p>
            <p className="font-bold">G.P. No: {GP}</p>
          </div>
        </div>
        <div className="text-black font-extrabold text-xl my-6">
          <p>Company Name: {Company_Name}</p>
        </div>
        <div className="text-black font-extrabold text-3xl">
          <p>Invoice</p>
        </div>

        <table className="text-left rounded-xl overflow-hidden mt-4 w-full">
          <thead className="bg-black text-white ">
            <tr>
              <th className="px-4 py-1 border-r-2 border-white w-[10%]">Qty</th>
              <th className="px-4 py-1 border-r-2 border-white w-[60%]">
                Description
              </th>
              <th className="px-4 py-1 border-x-2 border-white w-[15%]">Rate</th>
              <th className="px-4 py-1 w-[15%]">Amount</th>
            </tr>
          </thead>
          <tbody className="border-b-2 border-black">
            {[...Array(12)].map((_, idx) => (
              <tr key={idx} className="bg-white border-b-2 border-black h-6">
                <td className="px-4 py-1 border-x-2 border-black"></td>
                <td className="px-4 py-1"></td>
                <td className="px-4 py-1 border-x-2 border-black"></td>
                <td className="px-4 py-1 border-r-2 border-black"></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between w-full mt-4">
          <div className="text-black font-bold text-sm">
            <p>Total: </p>
          </div>
          <div className="text-black font-bold text-sm">
            <p>Rs. 0.00</p>
          </div>
        </div>
        <div className="">
          <p className="text-black font-bold text-sm mt-4 ">
            Note: This is a computer-generated document and does not require a
            signature.
          </p>
        </div>
      </div>

      <div className="flex gap-4 mt-8">
        <button
          className="bg-[#ff6c31] py-2 px-4 rounded-xl cursor-pointer"
          onClick={handleSaveAsPDF}
        >
          Save As
        </button>
        <button
          className="bg-[#ff6c31] py-2 px-4 rounded-xl"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>
    </div>
  );
};

export default preview;
