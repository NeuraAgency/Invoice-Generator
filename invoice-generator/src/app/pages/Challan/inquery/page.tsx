"use client";
import React, { useEffect, useMemo, useState } from "react";
import Nav from "@/app/components/nav";

// Row shape from DeliveryChallan (we select *)
type ChallanRow = {
  id: number;
  challanno: number | null;
  created_at?: string;
  Date?: string | null;
  PO?: string | null;
  GP?: string | null;
  Description: unknown;
};

const ChallanInquiryPage = () => {
  const [challanQuery, setChallanQuery] = useState("");
  const [results, setResults] = useState<ChallanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build query string similar to invoice inquery (prefix search)
  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (challanQuery.trim()) params.set("challan", challanQuery.trim());
    params.set("limit", "50");
    return params.toString();
  }, [challanQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/challan?${qs}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (e?.name !== "AbortError") setError(e?.message || "Failed to load challans");
      } finally {
        setLoading(false);
      }
    }, 250); // debounce
    return () => { controller.abort(); clearTimeout(timer); };
  }, [qs]);

  // Normalize Description into an array for rendering
  const toItems = (desc: unknown): any[] => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (Array.isArray(desc)) return desc;
    if (!desc) return [];
    return [desc];
  };

  const renderLines = (raw: unknown) => {
    const arr = toItems(raw);
    if (arr.length === 0) return <div className="text-xs text-gray-500">No items</div>;
    return (
      <div className="w-full min-w-0">
        {/* Expanded description width; ensure indent not cropped by reserving right-aligned 1 span */}
        <div className="grid grid-cols-12 bg-[var(--accent)] text-white text-[11px] uppercase rounded-t-md min-w-0">
          <div className="col-span-2 px-3 py-2">QTY</div>
          {/* Reduce description span by 1 to give Indent more space */}
          <div className="col-span-8 px-3 py-2">Description</div>
          {/* Indent widened from col-span-1 to col-span-2 to avoid truncation */}
          {/* Standardize padding; modest right padding without crowding rounded corner */}
          <div className="col-span-2 py-2 text-left">Indent</div>
        </div>
        <div className="border border-[var(--accent)] border-t-0 rounded-b-md overflow-hidden">
          {arr.map((d: any, i: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const qty = d?.qty ?? d?.quantity ?? d?.quantityFromRemarks ?? "";
            const desc = d?.description ?? d?.materialDescription ?? d?.desc ?? "";
            const ind = d?.indNo ?? d?.indno ?? "";
            return (
              <div key={i} className="grid grid-cols-12 bg-black/80 text-white text-xs border-t border-white/10">
                <div className="col-span-2 px-3 py-2">{String(qty)}</div>
                <div className="col-span-8 py-2 break-words whitespace-normal">{String(desc)}</div>
                {/* Remove truncate now that we have additional width */}
                <div className="col-span-2 py-2 tabular-nums" title={String(ind)}>{String(ind)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full items-start gap-5 lg:gap-7 p-4 lg:p-6 overflow-hidden">
      <div className="flex-1 min-w-0">
        <div className="rounded-xl bg-black p-4 lg:p-6 shadow text-white">
          <div className="mb-4">
            <Nav href1="/Challan" name1="Generate" href2="/Challan/inquery" name2="Inquery" />
          </div>
          <h1 className="text-base lg:text-lg font-semibold mb-3">Challan Inquiry</h1>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-[11px] font-medium text-white">Challan Number</label>
              <input
                type="text"
                value={challanQuery}
                onChange={(e) => setChallanQuery(e.target.value)}
                className="mt-1 w-40 text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/60"
                placeholder="e.g. 34 or 00034"
              />
            </div>
          </div>
          <div className="mt-4 text-xs text-white/70">
            {loading ? "Loading..." : error ? `Error: ${error}` : `${results.length} result(s)`}
          </div>
          <div className="mt-4 overflow-auto rounded-xl border border-white/10 h-[70vh] max-h-[70vh] bg-black p-2">
            <div className="hidden md:grid grid-cols-12 bg-[var(--accent)] text-white text-xs rounded-md mb-2">
              <div className="col-span-2 px-2 py-2">Challan no</div>
              <div className="col-span-2 px-2 py-2">Date</div>
              <div className="col-span-2 px-2 py-2">PO</div>
              <div className="col-span-2 px-2 py-2">GP</div>
              <div className="col-span-4 px-2 py-2">Description</div>
            </div>
            <div className="space-y-4">
              {results.map((row) => {
                const challanStr = row.challanno != null ? String(row.challanno).padStart(5, "0") : "-";
                const dateStr = row.Date ? String(row.Date) : (row.created_at ? new Date(row.created_at).toLocaleString() : "-");
                const poStr = row.PO ?? "-";
                const gpStr = row.GP ?? "-";
                return (
                  <div key={row.id} className="rounded-xl border border-[var(--accent)] overflow-hidden mb-4 bg-black">
                    <div className="grid grid-cols-12 gap-2 items-start text-white p-3">
                      <div className="col-span-6 md:col-span-2 px-2">
                        <div className="text-[11px] uppercase text-white/60">Challan no</div>
                        <div className="text-sm font-semibold">{challanStr}</div>
                      </div>
                      <div className="col-span-6 md:col-span-2 px-2">
                        <div className="text-[11px] uppercase text-white/60">Date</div>
                        <div className="text-sm font-semibold whitespace-nowrap">{dateStr}</div>
                      </div>
                      {/* PO is short; shrink to 1 column to free space */}
                      <div className="col-span-6 md:col-span-1 px-2">
                        <div className="text-[11px] uppercase text-white/60">PO</div>
                        <div className="text-sm font-semibold whitespace-nowrap">{poStr}</div>
                      </div>
                      <div className="col-span-6 md:col-span-2 px-2">
                        <div className="text-[11px] uppercase text-white/60">GP</div>
                        <div className="text-sm font-semibold whitespace-nowrap">{gpStr}</div>
                      </div>
                      {/* Slightly wider items table (from 4 to 5 cols) */}
                      <div className="col-span-12 md:col-span-5 min-w-0">
                        {renderLines(row.Description)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallanInquiryPage;
