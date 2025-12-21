"use client";
import Nav from "@/app/components/nav";
import React, { useEffect, useState } from "react";

interface RowData {
  qty: string;
  description: string;
  indno: string;
  gpno: string;
}

interface GenerateProps {
  rows: RowData[];
  setRows: React.Dispatch<React.SetStateAction<RowData[]>>;
  onConfirm: () => void;
  setGpNo: React.Dispatch<React.SetStateAction<string>>;
}

// Helper to map a record (DeliveryChallan or extraction) into table rows
function mapChallanToRows(rec: any): RowData[] {
  const desc = rec?.Description ?? rec?.description ?? rec?.items ?? [];
  const qty = rec?.Qty ?? rec?.qty;

  // Prefer explicit items array (supports extractions schema)
  if (Array.isArray(rec?.items)) {
    return rec.items.map((it: any) => ({
      qty: String(it?.quantityFromRemarks ?? it?.qty ?? it?.quantity ?? ""),
      description: String(it?.materialDescription ?? it?.description ?? it?.desc ?? ""),
      indno: String(it?.indNo ?? it?.indno ?? ""),
      gpno: "",
    }));
  }

  // If Description is an array of objects or strings
  if (Array.isArray(desc)) {
    return desc.map((d: any) => {
      if (typeof d === "string") {
        return { qty: "", description: d, indno: "", gpno: "" };
      }
      return {
        qty: String(d?.quantityFromRemarks ?? d?.qty ?? d?.quantity ?? ""),
        description: String(d?.materialDescription ?? d?.description ?? d?.desc ?? ""),
        indno: String(d?.indNo ?? d?.indno ?? ""),
        gpno: "",
      };
    });
  }

  // Fallback: single row
  return [
    {
      qty: qty != null ? String(qty) : "",
      description: desc != null ? String(desc) : "",
      indno: "",
      gpno: "",
    },
  ];
}

const Generate: React.FC<GenerateProps> = ({ rows, setRows, onConfirm, setGpNo }) => {
  // GatePass search state
  const [gpQuery, setGpQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // ----- NEW STATE -----
  const [poNo, setPoNo] = useState<string>(""); // controlled Purchase Order input
  const [generating, setGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // NEW: manual GatePass and Company Name
  const [manualGp, setManualGp] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("Kassim Textile Mills Limited");
  // NEW: sample returned flag (shared with preview via localStorage)
  const [sampleReturned, setSampleReturned] = useState<boolean>(false);
  // ----- END NEW STATE -----

  useEffect(() => {
    if (!gpQuery) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/extractions?gp=${encodeURIComponent(gpQuery)}&limit=10`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch suggestions");
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch (e) {
        if ((e as any)?.name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250); // debounce
    return () => {
      controller.abort();
      clearTimeout(id);
    };
  }, [gpQuery]);

  // Load initial sampleReturned from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sampleReturned");
      if (stored === "true") setSampleReturned(true);
    } catch {}
  }, []);

  const handleSelectSuggestion = (item: any) => {
    const gp = item?.document_no ?? item?.GP ?? item?.gp ?? "";
    setGpQuery(String(gp));
    setShowSuggestions(false);

    // Map selected record into display rows and attach GP No to each row
    const mapped = mapChallanToRows(item).map((r) => ({ ...r, gpno: String(gp) }));
    setRows(mapped);
    setGpNo(String(gp));

    // OPTIONAL: pre-fill manual GP with selected GP
    setManualGp(String(gp));
  };

  // NEW: direct row update (auto-save)
  const handleRowChange = (idx: number, field: keyof RowData, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleDelete = (idx: number) => {
    const updatedRows = rows.filter((_, i) => i !== idx);
    setRows(updatedRows);
    onConfirm();
  };

  // ----- NEW: handleGenerate sends POST to /api/challan -----
  const handleGenerate = async () => {
    setErrorMsg(null);
    setGenerating(true);

    try {
      const payload = {
        Date: new Date().toISOString().split("T")[0],
        PO: poNo || "00000",
        // use manual gate pass if provided, otherwise fall back
        GP: manualGp || gpQuery || rows?.[0]?.gpno || "",
        Industry: companyName || "Kassim Textile Mills Limited",
        Description: rows.map((r) => ({
          qty: r.qty,
          description: r.description,
          indNo: r.indno,
        })),
      };

      const res = await fetch("/api/challan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `HTTP ${res.status}`);
      }

      const body = await res.json();
      // challan string now always comes from API as `body.challan`
      const returnedChallan =
        body?.challan ??
        (Array.isArray(body?.data)
          ? body.data[0]?.id
            ? String(body.data[0].id).padStart(5, "0")
            : null
          : body?.data?.id
          ? String(body.data.id).padStart(5, "0")
          : null);

      try {
        localStorage.setItem("latestPO", String(payload.PO ?? ""));
        if (returnedChallan) {
          localStorage.setItem("latestChallan", returnedChallan);
          try {
            window.dispatchEvent(
              new CustomEvent("latestChallanUpdated", { detail: { challan: returnedChallan } })
            );
          } catch (e) {}
        }
        // store sampleReturned so preview can use it
        localStorage.setItem("sampleReturned", sampleReturned ? "true" : "false");
      } catch (e) {}
      onConfirm();
    } catch (err: any) {
      console.error("Generate failed:", err);
      setErrorMsg(err?.message || "Failed to generate challan");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-start px-6 py-4">
      <Nav href1="/Challan" name1="Generate" href2="/Challan/inquery" name2="Inquery" />

      <div className="w-full mt-8">
        {/* ROW 1: Search GP + Purchase Number */}
        <div className="flex gap-8 items-start mb-4">
          {/* SEARCHABLE GATEPASS (for lookup only) */}
          <div className="relative w-64">
            <div className="bg-white/5 border-[1px] border-white/10 rounded-md p-3 w-64 h-20 flex flex-col justify-start transition-all duration-150 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] focus-within:ring-opacity-20 focus-within:shadow-[0_6px_18px_rgba(255,165,0,0.12)]">
              <h2 className="font-semibold text-xs text-white">Search GatePass Number</h2>
              <input
                type="text"
                value={gpQuery}
                onChange={(e) => setGpQuery(e.target.value)}
                onFocus={() => gpQuery && setShowSuggestions(true)}
                className="my-2 w-full text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/50"
                placeholder="Search GP"
              />
            </div>
            {showSuggestions && (
              <div className="absolute left-0 z-10 mt-1 w-64 max-h-60 overflow-auto bg-white text-black rounded-md shadow border border-gray-200">
                {loading ? (
                  <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>
                ) : suggestions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-500">No results</div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {suggestions.map((sug: any, i: number) => (
                      <li key={i}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectSuggestion(sug)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100"
                        >
                          <div className="text-xs font-medium">
                            Document No: {String(sug?.document_no ?? "-")}
                          </div>
                          {sug?.document_date && (
                            <div className="text-[11px] text-gray-600">
                              Date: {String(sug.document_date)}
                            </div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* PURCHASE NUMBER */}
          <div className="relative w-64">
            <div className="bg-white/5 border-[1px] border-white/10 rounded-md p-3 w-64 h-20 flex flex-col justify-start transition-all duration-150 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] focus-within:ring-opacity-20 focus-within:shadow-[0_6px_18px_rgba(255,165,0,0.12)]">
            <h2 className="font-semibold text-xs text-white">Enter Purchase Number</h2>
            <input
              type="text"
              value={poNo}
              onChange={(e) => setPoNo(e.target.value)}
              className="my-2 w-full text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white"
              placeholder="P.O. No"
            />
            </div>
          </div>
        </div>

        {/* ROW 2: Manual GP + Company Name on same line */}
        <div className="flex flex-wrap gap-8 items-start">
          {/* MANUAL GATEPASS INPUT USED FOR GENERATE */}
          <div className="bg-white/5 border-[1px] border-white/10 rounded-md p-3 w-64 h-20 flex flex-col justify-start transition-all duration-150 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] focus-within:ring-opacity-20 focus-within:shadow-[0_6px_18px_rgba(255,165,0,0.12)]">
            <h2 className="font-semibold text-xs text-white">Enter GatePass Number (Manual)</h2>
            <input
              type="text"
              value={manualGp}
              onChange={(e) => {
                const val = e.target.value;
                setManualGp(val);
                setGpNo(val); // keep preview in sync with manual GP entry
                setRows((prev) => prev.map((r) => ({ ...r, gpno: val })));
              }}
              className="my-2 w-full text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white"
              placeholder="GP No"
            />
          </div>

          {/* COMPANY NAME */}
          <div className="bg-white/5 border-[1px] border-white/10 rounded-md p-3 w-64 h-20 flex flex-col justify-start transition-all duration-150 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] focus-within:ring-opacity-20 focus-within:shadow-[0_6px_18px_rgba(255,165,0,0.12)]">
            <h2 className="font-semibold text-xs text-white">Enter Company Name</h2>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="my-2 w-full text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white"
              placeholder="Company Name"
            />
          </div>
        </div>

        <div className="flex flex-col items-center mt-8">
          {/* MAIN EDITABLE TABLE */}
          <table className="generate w-full max-w-[720px] min-w-[520px] border border-black text-left rounded-xl overflow-hidden text-xs">
            <thead className="bg-[var(--accent)] text-white text-[11px] uppercase">
              <tr>
                <th className="px-2.5 py-1 border-b-2 border-r-2 border-black w-[15%]">Qty</th>
                <th className="px-2.5 py-1 border-b-2 border-r-2 border-black w-[55%]">Description</th>
                {/* NEW: Indent No column before Actions */}
                <th className="px-2.5 py-1 border-b-2 border-r-2 border-black w-[15%]">Indent No</th>
                <th className="px-2.5 py-1 border-b-2 border-black text-center w-[15%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="bg-[#f2d3be] text-black border-b-2 border-black h-6">
                  <td className="px-2.5 py-1 border-r-2 border-black text-center">
                    <input
                      type="text"
                      value={row.qty}
                      onChange={(e) => handleRowChange(idx, "qty", e.target.value)}
                      className="w-full text-xs outline-none bg-transparent text-center"
                    />
                  </td>
                  <td className="px-2.5 py-1 border-r-2 border-black">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => handleRowChange(idx, "description", e.target.value)}
                      className="w-full text-xs outline-none bg-transparent"
                    />
                  </td>
                  {/* NEW: editable Indent No cell */}
                  <td className="px-2.5 py-1 border-r-2 border-black text-center">
                    <input
                      type="text"
                      value={row.indno}
                      onChange={(e) => handleRowChange(idx, "indno", e.target.value)}
                      className="w-full text-xs outline-none bg-transparent text-center"
                    />
                  </td>
                  <td className="px-2 py-1 flex justify-center gap-2">
                    <button onClick={() => handleDelete(idx)}>
                      <img src="/delete.png" alt="Delete" className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {/* Custom orange checkbox */}
        <label className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10 transition cursor-pointer">
          {/* visually hidden native checkbox */}
          <input
            type="checkbox"
            checked={sampleReturned}
            onChange={(e) => {
              const val = e.target.checked;
              setSampleReturned(val);
              try {
                localStorage.setItem("sampleReturned", val ? "true" : "false");
              } catch {}
            }}
            className="sr-only peer"
          />
          {/* custom box */}
          <span className="flex h-4 w-4 items-center justify-center rounded-[3px] border border-[var(--accent)] bg-transparent peer-checked:bg-[var(--accent)] peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-0 transition-colors">
            {/* check mark */}
            <svg
              className="h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8.5 6.5 12 13 4" />
            </svg>
          </span>
          <span className="select-none">Sample have been returned</span>
        </label>

        <button
          className="bg-[var(--accent)] py-2 px-5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-60"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? "Generating…" : "Generate"}
        </button>
        {errorMsg && <div className="text-red-400 text-xs mt-2">{errorMsg}</div>}
      </div>
    </div>
  );
};

export default Generate;
