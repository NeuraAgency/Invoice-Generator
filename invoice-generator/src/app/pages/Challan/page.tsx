'use client';
import React, { useState } from "react";
import Generate from "./components/generate";
import dynamic from 'next/dynamic';

// Dynamically import Preview with SSR disabled to prevent server rendering of PDFViewer
const Preview = dynamic(() => import('./components/preview'), { ssr: false });

const Page = () => {
  const [rows, setRows] = useState(
    Array(7)
      .fill(0)
      .map(() => ({ qty: "", description: "", indno: "", gpno: "" }))
  );
  const [confirmedRows, setConfirmedRows] = useState(rows);
  const [selectedGpNo, setSelectedGpNo] = useState<string>("");

  const handleConfirm = () => {
    setConfirmedRows([...rows]);
  };

  return (
    <div className="flex h-screen items-center justify-around gap-8">
      <Generate
        rows={rows}
        setRows={setRows}
        onConfirm={handleConfirm}
        setGpNo={setSelectedGpNo}
      />
      <Preview rows={confirmedRows} gpno={selectedGpNo} />
    </div>
  );
};

export default Page;
