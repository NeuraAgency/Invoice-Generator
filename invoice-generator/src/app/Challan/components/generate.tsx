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
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<RowData>({
    qty: "",
    description: "",
    indno: "",
    gpno: "",
  });

  // GatePass search state
  const [gpQuery, setGpQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // ----- NEW STATE -----
  const [poNo, setPoNo] = useState<string>(""); // controlled Purchase Order input
  const [generating, setGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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

  const handleSelectSuggestion = (item: any) => {
    const gp = item?.document_no ?? item?.GP ?? item?.gp ?? "";
    setGpQuery(String(gp));
    setShowSuggestions(false);

    // Map selected record into display rows and attach GP No to each row
    const mapped = mapChallanToRows(item).map((r) => ({ ...r, gpno: String(gp) }));
    setRows(mapped);
    setGpNo(String(gp));
  };

  const handleEdit = (idx: number) => {
    setEditIdx(idx);
    setEditValues(rows[idx]);
  };

  const handleInputChange = (field: keyof RowData, value: string) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (editIdx !== null) {
      const updatedRows = [...rows];
      updatedRows[editIdx] = editValues;
      setRows(updatedRows);
      setEditIdx(null);
    }
  };

  const handleDelete = (idx: number) => {
    const updatedRows = rows.filter((_, i) => i !== idx);
    setRows(updatedRows);
    setEditIdx(null);
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
        GP: gpQuery || rows?.[0]?.gpno || "",
        Industry: "", // adjust if you add an Industry input
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
      const returnedChallan = body?.challan ?? (Array.isArray(body?.data) ? (body.data[0]?.id ? String(body.data[0].id).padStart(5,'0') : null) : (body?.data?.id ? String(body.data.id).padStart(5,'0') : null));
      try {
        localStorage.setItem("latestPO", String(payload.PO ?? ""));
        if (returnedChallan) {
          localStorage.setItem("latestChallan", returnedChallan);
          try {
            window.dispatchEvent(new CustomEvent("latestChallanUpdated", { detail: { challan: returnedChallan } }));
          } catch (e) {}
        }
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
        <div className="flex flex-wrap gap-8 items-center">
          <div className="relative">
            <h2 className="font-semibold text-xs text-white">Enter GatePass Number</h2>
            <input
              type="text"
              value={gpQuery}
              onChange={(e) => setGpQuery(e.target.value)}
              onFocus={() => gpQuery && setShowSuggestions(true)}
              className="my-2 w-36 text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/50"
              placeholder="Search GP"
            />
            {showSuggestions && (
              <div className="absolute z-10 mt-1 w-64 max-h-60 overflow-auto bg-white text-black rounded-md shadow border border-gray-200">
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
                            <div className="text-[11px] text-gray-600">Date: {String(sug.document_date)}</div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div>
            <h2 className="font-semibold text-xs text-white">Enter Purchase Number</h2>
            <input
              type="text"
              value={poNo}
              onChange={(e) => setPoNo(e.target.value)}
              className="my-2 w-36 text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white"
              placeholder="P.O. No"
            />
          </div>
        </div>

        <div className="flex flex-col items-center mt-8 space-y-8">
          <table className="display w-full max-w-[720px] min-w-[520px] border border-black text-left rounded-xl overflow-hidden text-xs">
            <thead className="bg-[var(--accent)] text-white text-[11px] uppercase">
              <tr>
                <th className="px-2.5 py-1 border-b-2 border-r-2 border-black w-[20%]">Qty</th>
                <th className="px-2.5 py-1 border-b-2 border-black w-[80%]">Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="bg-[#f2d3be] text-black border-b-2 border-black h-6">
                  <td className="px-2.5 py-1 border-r-2 border-black text-center">{row.qty}</td>
                  <td className="px-2.5 py-1">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className="generate w-full max-w-[720px] min-w-[520px] border border-black text-left rounded-xl overflow-hidden text-xs">
            <thead className="bg-[var(--accent)] text-white text-[11px] uppercase">
              <tr>
                <th className="px-2.5 py-1 border-b-2 border-r-2 border-black w-[20%]">Qty</th>
                <th className="px-2.5 py-1 border-b-2 border-r-2 border-black w-[65%]">Description</th>
                <th className="px-2.5 py-1 border-b-2 border-black text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="bg-[#f2d3be] text-black border-b-2 border-black h-6">
                  <td className="px-2.5 py-1 border-r-2 border-black text-center">
                    {editIdx === idx ? (
                      <input
                        type="text"
                        value={editValues.qty}
                        onChange={(e) => handleInputChange("qty", e.target.value)}
                        className="w-full text-xs outline-none bg-transparent text-center"
                      />
                    ) : (
                      row.qty
                    )}
                  </td>
                  <td className="px-2.5 py-1 border-r-2 border-black">
                    {editIdx === idx ? (
                      <input
                        type="text"
                        value={editValues.description}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                        className="w-full text-xs outline-none bg-transparent"
                      />
                    ) : (
                      row.description
                    )}
                  </td>
                  <td className="px-2 py-1 flex justify-center gap-2">
                    {editIdx === idx ? (
                      <button onClick={handleSave}>
                        <img src="/save.png" alt="Save" className="w-5 h-5" />
                      </button>
                    ) : (
                      <button onClick={() => handleEdit(idx)}>
                        <img src="/edit.png" alt="Edit" className="w-5 h-5" />
                      </button>
                    )}
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

      <div className="mt-6">
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
