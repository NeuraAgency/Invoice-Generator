'use client';
import React, { useState } from "react";
import Generate from "../components/generate";
import dynamic from 'next/dynamic';

// Dynamically import Preview with SSR disabled to prevent server rendering of PDFViewer
const Preview = dynamic(() => import('../components/preview'), { ssr: false });

const Page = () => {
  const [rows, setRows] = useState(
    Array(7)
      .fill(0)
      .map(() => ({ qty: "", description: "", amount: "" }))
  );
  const [confirmedRows, setConfirmedRows] = useState(rows);

  const handleConfirm = () => {
    setConfirmedRows([...rows]);
  };

  return (
    <div className="flex h-screen w-full items-start gap-5 lg:gap-7 p-4 lg:p-6 overflow-hidden">
      <div className=" w-[560px] xl:w-[620px]">
        <Generate
          rows={rows}
          setRows={setRows}
          onConfirm={handleConfirm}
        />
      </div>
      <div className="flex-1">
        <Preview rows={confirmedRows} />
      </div>
    </div>
  );
};

export default Page;
