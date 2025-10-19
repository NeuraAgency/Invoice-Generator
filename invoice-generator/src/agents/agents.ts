// src/agents/agents.ts
export interface DocumentExtraction {
  documentNo?: string | null;
  date?: string | null;
  materialNo?: string | null;
  materialDescription?: string | null;
  IND?: string | null;
  quantityFromRemarks?: string | null;
  raw?: string;
}

export async function runAgent(file: File): Promise<DocumentExtraction> {
  const base64 = await fileToBase64(file);

  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base64Image: base64,
      mimeType: file.type || "image/png",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  return (await response.json()) as DocumentExtraction;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
