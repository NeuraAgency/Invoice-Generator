import { useState } from "react";
import { useOCR } from "@/hooks/useOCR";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const { ocrText, performOCR, loading } = useOCR();

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleUpload = () => {
    if (file) performOCR(file);
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Upload Gate Pass</h1>
      <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} className="mt-3 p-2 bg-blue-500 text-white rounded">Upload & OCR</button>

      {loading && <p className="mt-4">Processing…</p>}
      {ocrText && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <h2 className="font-semibold">Extracted Text:</h2>
          <pre>{ocrText}</pre>
        </div>
      )}
    </div>
  );
}
