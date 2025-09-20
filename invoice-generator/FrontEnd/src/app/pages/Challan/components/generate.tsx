"use client";
import Nav from "@/app/components/nav";
import React, { useState } from "react";

interface RowData {
  qty: string;
  description: string;
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
    <div className="flex flex-col items-start justify-around w-full h-screen">
      <Nav
        href1="./generate"
        name1="Generate"
        href2="./inquery"
        name2="Inquery"
      />
      <div>
        <div className="flex items-center gap-8">
          <div>
            <h2 className="font-bold">Enter GatePass Number</h2>
            <input
              type="text"
              className="my-4 w-44 text-xl font-bold border-b-2 border-[#ff6c31] focus:outline-none transition-colors"
            />
          </div>
          <div>
            <h2 className="font-bold">Enter Purchase Number</h2>
            <input
              type="text"
              className="my-4 w-44 text-xl font-bold border-b-2 border-[#ff6c31] focus:outline-none transition-colors"
            />
          </div> 
        </div>
        <div className="flex flex-col items-center">
          <table className="display min-w-[624px] border border-black text-left rounded-xl overflow-hidden my-12">
            <thead className="bg-[#ff6c31] text-white ">
              <tr>
                <th className="px-4 py-2 border-b-4 border-r-4 border-black w-[20%]">
                  Qty
                </th>
                <th className="px-4 py-2 border-b-4 border-r-4 border-black w-[80%]">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="bg-[#e9c6b1] text-black border-b-4 h-9 border-black"
                >
                  <td className="px-4 py-2 border-r-4 border-black">
                    {editIdx === idx ? (
                      <input
                        type="text"
                        value={editValues.qty}
                        onChange={(e) =>
                          handleInputChange("qty", e.target.value)
                        }
                        className="w-full outline-none focus:ring-0 focus:border-transparent"
                      />
                    ) : (
                      row.qty
                    )}
                  </td>
                  <td className="px-4 py-2 border-r-4 border-black">
                    {editIdx === idx ? (
                      <input
                        type="text"
                        value={editValues.description}
                        onChange={(e) =>
                          handleInputChange("description", e.target.value)
                        }
                        className="w-full outline-none focus:ring-0 focus:border-transparent"
                      />
                    ) : (
                      row.description
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
          <table className="generate min-w-[624px] border border-black text-left rounded-xl overflow-hidden">
            <thead className="bg-[#ff6c31] text-white ">
              <tr>
                <th className="px-4 py-2 border-b-4 border-r-4 border-black w-[20%]">
                  Qty
                </th>
                <th className="px-4 py-2 border-b-4 border-r-4 border-black w-[80%]">
                  Description
                </th>
                <th className="px-4 py-2 border-b-4 border-black">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="bg-[#e9c6b1] text-black border-b-4 h-9 border-black"
                >
                  <td className="px-4 py-2 border-r-4 border-black">
                    {editIdx === idx ? (
                      <input
                        type="text"
                        value={editValues.qty}
                        onChange={(e) =>
                          handleInputChange("qty", e.target.value)
                        }
                        className="w-full outline-none focus:ring-0 focus:border-transparent"
                      />
                    ) : (
                      row.qty
                    )}
                  </td>
                  <td className="px-4 py-2 border-r-4 border-black">
                    {editIdx === idx ? (
                      <input
                        type="text"
                        value={editValues.description}
                        onChange={(e) =>
                          handleInputChange("description", e.target.value)
                        }
                        className="w-full outline-none focus:ring-0 focus:border-transparent"
                      />
                    ) : (
                      row.description
                    )}
                  </td>
                  <td className="px-4 py-1 flex gap-2">
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
      <div>
        <button
          className="bg-[#ff6c24] py-3 px-8 rounded-xl"
          onClick={onConfirm}
        >
          Generate
        </button>
      </div>
    </div>
  );
};

export default Generate;
   