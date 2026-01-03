'use client';
import React, { useEffect, useMemo, useState } from "react";
import Generate, { mapChallanToRows } from "./components/generate";
import dynamic from 'next/dynamic';
import { useSearchParams } from "next/navigation";

// Dynamically import Preview with SSR disabled to prevent server rendering of PDFViewer
const Preview = dynamic(() => import('./components/preview'), { ssr: false });

const Page = () => {
  const searchParams = useSearchParams();
  const editId = searchParams.get('editId');
  const editChallan = searchParams.get('editChallan');

  const [rows, setRows] = useState(
    Array(7)
      .fill(0)
      .map(() => ({ qty: "", description: "", indno: "", gpno: "" }))
  );
  const [confirmedRows, setConfirmedRows] = useState(rows);
  const [selectedGpNo, setSelectedGpNo] = useState<string>("");
  const [initialMeta, setInitialMeta] = useState<{
    challanId?: number;
    challanno?: number | null;
    poNo?: string | null;
    gp?: string | null;
    companyName?: string | null;
    date?: string | null;
    sampleReturned?: boolean | null;
  } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const numericEditId = useMemo(() => {
    if (!editId) return null;
    const parsed = Number(String(editId).replace(/\D/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }, [editId]);

  const numericEditChallan = useMemo(() => {
    if (!editChallan) return null;
    const parsed = Number(String(editChallan).replace(/\D/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }, [editChallan]);

  useEffect(() => {
    if (!numericEditId && !numericEditChallan) {
      setInitialMeta(null);
      setEditError(null);
      setEditLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        setEditLoading(true);
        setEditError(null);
        const res = numericEditId
          ? await fetch(`/api/challan?id=${encodeURIComponent(String(numericEditId))}`)
          : await fetch(`/api/challan?challan=${encodeURIComponent(String(numericEditChallan))}&exact=true&limit=1`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rec = Array.isArray(json) ? json[0] : json;
        if (!rec) throw new Error('Not found');

        const gp = rec?.GP ?? "";
        const mapped = mapChallanToRows(rec).map((r) => ({ ...r, gpno: String(gp) }));

        if (!active) return;
        setRows(mapped);
        setConfirmedRows(mapped);
        setSelectedGpNo(String(gp));
        setInitialMeta({
          challanId: rec?.id,
          challanno: rec?.challanno ?? null,
          poNo: rec?.PO ?? "",
          gp: rec?.GP ?? "",
          companyName: rec?.Industry ?? "Kassim Textile Mills Limited",
          date: rec?.Date ?? null,
          sampleReturned: rec?.Sample_returned ?? null,
        });
      } catch (e: any) {
        if (!active) return;
        setEditError(e?.message || 'Failed to load challan');
      } finally {
        if (active) setEditLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [numericEditId, numericEditChallan]);

  const handleConfirm = () => {
    setConfirmedRows([...rows]);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full items-start gap-5 lg:gap-7 p-4 lg:p-6 pt-20 lg:pt-6 overflow-y-auto lg:overflow-hidden bg-black text-white">
      <div className="shrink-0 w-full lg:w-[560px] xl:w-[620px]">
        {editLoading && (
          <div className="mb-3 text-xs text-white/70">Loading challan for edit…</div>
        )}
        {editError && (
          <div className="mb-3 text-xs text-red-400">{editError}</div>
        )}
        <Generate
          rows={rows}
          setRows={setRows}
          onConfirm={handleConfirm}
          setGpNo={setSelectedGpNo}
          initialMeta={initialMeta ?? undefined}
        />
      </div>
      <div className="w-full lg:flex-1 min-w-0">
        <Preview rows={confirmedRows} gpno={selectedGpNo} />
      </div>
    </div>
  );
};

export default Page;
