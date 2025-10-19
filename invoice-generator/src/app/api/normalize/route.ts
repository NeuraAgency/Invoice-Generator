import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { promises as fs } from "fs";
import path from "path";

interface CleanItem {
  indNo: string | null;
  materialNo: string | null;
  materialDescription: string | null;
  quantityFromRemarks: string | null;
}

interface CleanExtraction {
  documentNo: string | null;
  date: string | null;
  items: CleanItem[];
  raw?: string;
}

const prompt = `You are a data transformer. Convert the provided raw OCR/LLM output into a single JSON object with EXACTLY this schema:
{
  "documentNo": string|null,
  "date": string|null,          // Use YYYY-MM-DD when possible
  "items": [
    {
      "indNo": string|null,     // Map labels like "IND #", "IND No", "Indent No"
      "materialNo": string|null,
      "materialDescription": string|null,
      "quantityFromRemarks": string|null // A numeric-like string (e.g., "50", "08") if present
    }
  ]
}
Rules:
- Output MUST be pure JSON only (no markdown, no code fences, no comments).
- Normalize label variants (e.g., IND # -> indNo).
- If values are missing, set to null.
- Do not add extra top-level keys.
`;

export async function POST(request: Request) {
  try {
    const { raw } = await request.json();
    if (typeof raw !== "string" || raw.trim() === "") {
      return NextResponse.json({ error: "raw (string) is required" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
    }

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0,
      max_completion_tokens: 1024,
      top_p: 1,
      stream: false,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: [{ type: "text", text: raw }] },
      ],
    });

    const text: string = completion?.choices?.[0]?.message?.content ?? "";

    const coerceJson = (s: string): any | null => {
      let t = (s || "").trim();
      t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").replace(/```/g, "").trim();
      try { return JSON.parse(t); } catch {}
      const start = t.indexOf("{");
      const end = t.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        const candidate = t.slice(start, end + 1);
        try { return JSON.parse(candidate); } catch {}
      }
      return null;
    };

    const parsed = coerceJson(text) as CleanExtraction | null;
    if (!parsed || !Array.isArray(parsed.items)) {
      return NextResponse.json({ error: "Normalization failed", raw: text }, { status: 422 });
    }

    // Persist normalized file alongside extract route outputs
    try {
      const outDir = path.join(process.cwd(), "src", "app", "api", "extract", "extractions");
      await fs.mkdir(outDir, { recursive: true });
      const fileName = `normalized-${Date.now()}.json`;
      const filePath = path.join(outDir, fileName);
      await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to persist normalized JSON:", err);
      // Non-fatal
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Normalize API error", error);
    const message = error instanceof Error ? error.message : "Failed to normalize";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
