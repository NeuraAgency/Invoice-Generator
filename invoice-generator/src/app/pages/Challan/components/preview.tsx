"use client";
import dynamic from "next/dynamic";
import React from "react";

const PDFPreview = dynamic(() => import("./PDFPreview"), { ssr: false });

type PreviewProps = {
  rows: any[];
  gpno?: string;
};

export default function PreviewWrapper(props: PreviewProps) {
  const { rows, gpno } = props;

  const effectiveGpNo = gpno ?? rows?.[0]?.gpno ?? "";

  return (
    <div className="flex justify-center">
      <PDFPreview rows={rows} gpno={effectiveGpNo} />
    </div>
  );
}
