"use client";
import Nav from "@/app/components/nav";
import React, { useState } from "react";

interface RowData {
  qty: string;
  description: string;
  indno: string;
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
    indno: "",
  });

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

  return (
    <div className="flex flex-col items-start px-8 py-6">
      <Nav href1="./generate" name1="Generate" href2="./inquery" name2="Inquery" />

      <div className="w-full mt-8">
        <div className="flex flex-wrap gap-12 items-center">
          <div>
            <h2 className="font-semibold text-sm text-white">Enter GatePass Number</h2>
            <input
              type="text"
              className="my-2 w-40 text-sm border-b-2 border-[#ff6c31] focus:outline-none"
            />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-white">Enter Purchase Number</h2>
            <input
              type="text"
              className="my-2 w-40 text-sm border-b-2 border-[#ff6c31] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col items-center mt-8 space-y-8">
          {/* Display Table (Uneditable, cleaner version) */}
          <table className="display min-w-[620px] border border-black text-left rounded-xl overflow-hidden text-sm">
            <thead className="bg-[#ff6c31] text-white text-xs uppercase">
              <tr>
                <th className="px-3 py-1.5 border-b-2 border-r-2 border-black w-[20%]">
                  Qty
                </th>
                <th className="px-3 py-1.5 border-b-2 border-black w-[80%]">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="bg-[#f2d3be] text-black border-b-2 border-black h-7"
                >
                  <td className="px-3 py-1.5 border-r-2 border-black text-center">
                    {row.qty}
                  </td>
                  <td className="px-3 py-1.5">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Generate Table (Editable with actions) */}
          <table className="generate min-w-[620px] border border-black text-left rounded-xl overflow-hidden text-sm">
            <thead className="bg-[#ff6c31] text-white text-xs uppercase">
              <tr>
                <th className="px-3 py-1.5 border-b-2 border-r-2 border-black w-[20%]">
                  Qty
                </th>
                <th className="px-3 py-1.5 border-b-2 border-r-2 border-black w-[65%]">
                  Description
                </th>
                <th className="px-3 py-1.5 border-b-2 border-black text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="bg-[#f2d3be] text-black border-b-2 border-black h-7">
                  <td className="px-3 py-1.5 border-r-2 border-black text-center">
                    {editIdx === idx ? (
                      <input
                        type="text"
                        value={editValues.qty}
                        onChange={(e) => handleInputChange("qty", e.target.value)}
                        className="w-full text-sm outline-none bg-transparent text-center"
                      />
                    ) : (
                      row.qty
                    )}
                  </td>
                  <td className="px-3 py-1.5 border-r-2 border-black">
                    {editIdx === idx ? (
                      <input
                        type="text"
                        value={editValues.description}
                        onChange={(e) =>
                          handleInputChange("description", e.target.value)
                        }
                        className="w-full text-sm outline-none bg-transparent"
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
          className="bg-[#ff6c24] py-2 px-6 rounded-lg text-sm font-medium text-white hover:opacity-90 transition"
          onClick={onConfirm}
        >
          Generate
        </button>
      </div>
    </div>
  );
};

export default Generate;
