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
  // 1) Upload file to storage to get a durable URL
  const fileUrl = await uploadToStorage(file);

  // 2) Convert the file to base64 for vision extraction
  const base64 = await fileToBase64(file);

  // 3) Call extract with fileUrl so server inserts URL with the extracted data
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base64Image: base64,
      mimeType: file.type || "image/png",
      fileUrl,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  return (await response.json()) as DocumentExtraction;
}

async function uploadToStorage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed ${res.status}: ${err}`);
  }

  const json = (await res.json()) as { fileUrl?: string };
  if (!json.fileUrl) {
    throw new Error("Upload did not return fileUrl");
  }
  return json.fileUrl;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
