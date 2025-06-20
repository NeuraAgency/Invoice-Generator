'use client';
import { useState, ChangeEvent } from "react";
import { useOCR } from "../../hooks/useOCR";

const Datacenter = () => {
  const [file, setFile] = useState<File | null>(null);
  const { ocrText, performOCR, loading } = useOCR();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (file) {
      performOCR(file);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">📊 DataCenter — Gate Pass OCR</h1>

      <div className="flex flex-col gap-4">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          className="border p-2 rounded"
        />

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className={`p-2 text-white rounded ${
            loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Processing…" : "Upload & OCR"}
        </button>

        {ocrText && (
          <div className="mt-6 bg-gray-100 p-4 rounded shadow-sm">
            <h2 className="text-xl font-semibold mb-2">📄 Extracted Text:</h2>
            <pre className="whitespace-pre-wrap">{ocrText}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default Datacenter;
