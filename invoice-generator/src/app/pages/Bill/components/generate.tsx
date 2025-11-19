"use client";
import Nav from "@/app/components/nav";
import React, { useEffect, useState } from "react";

interface RowData {
  qty: string;
  description: string;
  amount: string;
}

interface GenerateProps {
  rows: RowData[];
  setRows: React.Dispatch<React.SetStateAction<RowData[]>>;
  onConfirm: () => void;
}

const Generate: React.FC<GenerateProps> = ({ rows, setRows, onConfirm }) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<RowData>({
    qty: "",
    description: "",
    amount: "",
  });

  // Challan search state
  const [challanQuery, setChallanQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

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
      onConfirm(); // if you want immediate preview update
    }
  };

  const handleDelete = (idx: number) => {
    const updatedRows = rows.filter((_, i) => i !== idx);
    setRows(updatedRows);
    setEditIdx(null);
    onConfirm(); // if you want preview update on delete
  };

  const handleGenerate = async () => {
    try {
      const challanNoNumeric = Number(challanQuery.replace(/\D/g, ""));
      if (!challanNoNumeric) return;

      const payload = {
        challanno: challanNoNumeric,
        lines: rows.map((r) => ({
          qty: r.qty,
          description: r.description,
          amount: r.amount,
        })),
      };

      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("Invoice save failed", await res.json().catch(() => ({})));
        return;
      }

      const body = await res.json();
      const billStr = body?.bill;
      if (billStr) {
        try {
          localStorage.setItem("latestBill", String(billStr));
        } catch {}
      }

      onConfirm();
    } catch (e) {
      console.error(e);
    }
  };

  // Debounced search of challan database by challan number (challanno)
  useEffect(() => {
    if (!challanQuery) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/challan?challan=${encodeURIComponent(challanQuery)}&limit=10`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Failed to fetch challans");
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(id);
    };
  }, [challanQuery]);

  const handleSelectChallan = (item: any) => {
    const challanNo = item?.challanno ?? item?.challan ?? "";
    const challanStr = String(challanNo);
    setChallanQuery(challanStr);
    setShowSuggestions(false);

    // Persist selected challan and GP for preview
    try {
      const padded = challanStr && /\d/.test(challanStr)
        ? String(Number(challanStr)).padStart(5, '0')
        : challanStr;
      localStorage.setItem('latestInvoiceChallan', padded);
      if (item?.GP) {
        localStorage.setItem('latestInvoiceGP', String(item.GP));
      }
    } catch {}

    const desc = item?.Description ?? item?.description ?? [];
    let mapped: RowData[] = [];

    if (Array.isArray(desc)) {
      mapped = desc.map((d: any) => {
        if (typeof d === "string") {
          return { qty: "", description: d, amount: "" };
        }
        return {
          qty: String(d?.qty ?? d?.quantity ?? ""),
          description: String(d?.description ?? d?.materialDescription ?? ""),
          amount: String(d?.amount ?? ""),
        };
      });
    } else if (desc) {
      mapped = [
        {
          qty: String((desc as any)?.qty ?? (desc as any)?.quantity ?? ""),
          description: String((desc as any)?.description ?? ""),
          amount: String((desc as any)?.amount ?? ""),
        },
      ];
    }

    if (mapped.length === 0) {
      mapped = rows;
    }

    setRows(mapped);
    onConfirm();
  };

  return (
    <div className="flex flex-col items-start px-6 py-4">
      <Nav
        href1="/pages/Bill"
        name1="Generate"
        href2="/pages/Bill/inquery"
        name2="Inquery"
      />

      <div className="w-full mt-8">
        <div className="flex flex-wrap gap-8 items-center">
          <div className="relative">
            <h2 className="font-semibold text-xs text-white">Enter Challan Number</h2>
            <input
              type="text"
              value={challanQuery}
              onChange={(e) => setChallanQuery(e.target.value)}
              onFocus={() => challanQuery && setShowSuggestions(true)}
              className="my-2 w-36 text-xs border-b-2 border-[var(--accent)] focus:outline-none bg-transparent text-white placeholder:text-white/50"
              placeholder="Search Challan"
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
                          onClick={() => handleSelectChallan(sug)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100"
                        >
                          <div className="text-xs font-medium">
                            Challan No: {String(sug?.challanno ?? "-")}
                          </div>
                          {sug?.GP && (
                            <div className="text-[11px] text-gray-600">GP: {String(sug.GP)}</div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center mt-8">
          <table className="w-full max-w-[720px] min-w-[520px] border border-black text-left rounded-xl overflow-hidden text-xs">
            <thead className="bg-[var(--accent)] text-white text-[11px] uppercase">
              <tr>
                <th className="px-2.5 py-1 border-b-2 border-r-2 border-black w-[15%]">
                  Qty
                </th>
                <th className="px-2.5 py-1 border-b-2 border-r-2 border-black w-[65%]">
                  Description
                </th>
                <th className="px-2.5 py-1 border-b-2 border-r-2 border-black w-[20%]">
                  Amount
                </th>
                <th className="px-2.5 py-1 border-b-2 border-black text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="bg-[#e9c6b1] text-black border-b-2 border-black h-6"
                >
                  <td className="px-2.5 py-1 border-r-2 border-black">
                    {editIdx === idx ? (
                      <input
                        type="text"
                        value={editValues.qty}
                        onChange={(e) =>
                          handleInputChange("qty", e.target.value)
                        }
                        className="w-full text-xs outline-none bg-transparent"
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
                  <td className="px-2.5 py-1 border-r-2 border-black">
                    {editIdx === idx ? (
                        <input
                        type="text"
                        value={editValues.amount}
                        onChange={(e) => handleInputChange("amount", e.target.value)}
                        className="w-full text-xs outline-none bg-transparent"
                    />
                    
                    ) : (
                      row.amount
                    )}
                  </td>
                  <td className="px-2 py-1 flex justify-center gap-2">
                    {editIdx === idx ? (
                      <button onClick={handleSave}>
                        <img
                          src="/save.png"
                          alt="Save"
                          className="w-6 h-6 bg-center"
                        />
                      </button>
                    ) : (
                      <button onClick={() => handleEdit(idx)}>
                        <img
                          src="/edit.png"
                          alt="Edit"
                          className="w-6 h-6 bg-center"
                        />
                      </button>
                    )}
                    <button onClick={() => handleDelete(idx)}>
                      <img src="/delete.png" alt="Delete" className="w-6 h-6" />
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
          className="bg-[var(--accent)] py-2 px-5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition"
          onClick={handleGenerate}
        >
          Generate
        </button>
      </div>
    </div>
  );
};

export default Generate;
