import { useState } from "react";

export const useOCR = () => {
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState("");

  const performOCR = async (file) => {
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:8000/ocr", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setOcrText(data.text);
    setLoading(false);
  };

  return { ocrText, performOCR, loading };
};
