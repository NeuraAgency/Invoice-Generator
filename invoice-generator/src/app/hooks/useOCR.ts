import { useState } from 'react';

export const useOCR = () => {
  const [ocrText, setOcrText] = useState('');
  const [loading, setLoading] = useState(false);

  const performOCR = async (file: File) => {
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/ocr', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    setOcrText(data.text);
    setLoading(false);
  };

  return { ocrText, performOCR, loading };
};
