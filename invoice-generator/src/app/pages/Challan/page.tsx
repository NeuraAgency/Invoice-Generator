'use client';
import React, { useState } from "react";
import Generate from "./components/generate";
import Preview from "./components/preview";

const Page = () => {
  const [rows, setRows] = useState(
    Array(7)
      .fill(0)
      .map(() => ({ qty: "", description: ""}))
  );
  const [confirmedRows, setConfirmedRows] = useState(rows);

  const handleConfirm = () => {
    setConfirmedRows([...rows]);
  };

  return (
    <div className="flex w-full h-screen items-center mx-14 gap-24">
      <Generate
        rows={rows}
        setRows={setRows}
        onConfirm={handleConfirm}
      />
      <Preview rows={confirmedRows} />
    </div>
  );
};

export default Page;
