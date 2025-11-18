import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { normalizeExtraction } from "../../../agents/normalize";
import { getSupabaseAdminClient } from "../../../lib/supabaseServer";

interface DocumentExtraction {
  documentNo?: string | null;
  date?: string | null;
  fileUrl?: string | null;
  items?: Array<{
    indNo: string | null;
    materialNo: string | null;
    materialDescription: string | null;
    quantityFromRemarks: string | null;
  }>;
}

const prompt = `You are a precise data extractor. Look at the provided document image and return JSON that matches this exact schema:
{
  "documentNo": string | null,
  "date": string | null,
  "items": [
    {
      "indNo": string | null,
      "materialNo": string | null,
      "materialDescription": string | null,
      "quantityFromRemarks": string | null
    }
  ]
}
Rules:
- Output MUST be valid JSON only — no markdown, fences, or prose.
- If any value is missing or unreadable, set it to null.
- Dates must be formatted as YYYY-MM-DD when possible.
- Use these label synonyms when extracting:
  • documentNo: "Document No", "Doc No", "Challan No", "Invoice No"
  • date: "Date", "Challan Date", "Invoice Date"
  • indNo: "IND #", "IND No", "Indent No", "Requisition No"
  • materialNo: "Material No", "Item Code", "Part No", "SKU"
  • materialDescription: "Material Description", "Item Description", "Description"
  • quantityFromRemarks: Numeric quantity mentioned near "Remarks", "Remark", "Notes", or labeled "Qty"
- When multiple rows/items exist, include them all in the items array.
- Do not invent data; extract only what is present.`;



export async function POST(request: Request) {
  try {
  const { base64Image, mimeType, fileUrl } = await request.json();

    if (!base64Image || typeof base64Image !== "string") {
      return NextResponse.json(
        { error: "base64Image is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY not configured" },
        { status: 500 }
      );
    }

    const cleanedBase64 = base64Image.replace(/^data:[^;]+;base64,/, "");
    const effectiveMime =
      typeof mimeType === "string" && mimeType.length > 0
        ? mimeType
        : "image/png";

    const groq = new Groq({ apiKey });
    const chatCompletion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0,
      max_completion_tokens: 1024,
      top_p: 1,
      stream: false,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the fields as specified." },
            {
              type: "image_url",
              image_url: {
                url: `data:${effectiveMime};base64,${cleanedBase64}`,
              },
            },
          ],
        },
      ],
    });

    const text: string = chatCompletion?.choices?.[0]?.message?.content ?? "";

    // Attempt to coerce JSON from potential code-fenced or prefixed content
  const coerceJson = (s: string): Record<string, unknown> | null => {
      if (!s) return null;
      let t = s.trim();
      // Remove common code fences and language hints
      t = t.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
      t = t.replace(/```/g, "").trim();
      // Try direct parse first
      try { return JSON.parse(t); } catch {}
      // Fallback: slice between first { and last }
      const start = t.indexOf("{");
      const end = t.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        const candidate = t.slice(start, end + 1);
        try { return JSON.parse(candidate); } catch {}
      }
      return null;
    };

    const parsedObj = coerceJson(text);
    const normalizedDoc = normalizeExtraction(text);

    const sanitizeStr = (v: unknown): string | null => {
      if (v === null || v === undefined) return null;
      if (typeof v === "number") return String(v);
      if (typeof v === "string") {
        const trimmed = v.trim();
        return trimmed === "" ? null : trimmed;
      }
      return null;
    };

    const valueFromParsed = (keys: string[]): string | null => {
      if (!parsedObj) return null;
      const record = parsedObj as Record<string, unknown>;
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
          const value = sanitizeStr(record[key]);
          if (value) return value;
        }
      }
      return null;
    };
    const findDocNo = () => {
      const m1 = text.match(/(?:Document\s*No\.?|Doc\s*No\.?|Challan\s*No\.?|Invoice\s*No\.?)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i);
      if (m1?.[1]) return m1[1];
      const m2 = text.match(/\b[A-Z]{1,5}[-\/]\d{2,}[-\/]\d{2,}\b/);
      return m2?.[0] ?? null;
    };
    const findDate = () => {
      const m = text.match(/(\d{4}[\/-](?:0[1-9]|1[0-2])[\/-](?:0[1-9]|[12]\d|3[01]))|((?:0[1-9]|[12]\d|3[01])[\/-](?:0[1-9]|1[0-2])[\/-]\d{4})/);
      if (!m) return null;
      const d = m[0];
      // Normalize DD/MM/YYYY -> YYYY-MM-DD
      if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(d)) {
        const [dd, mm, yyyy] = d.split(/[\/\-]/);
        return `${yyyy}-${mm}-${dd}`;
      }
      return d.replaceAll('/', '-');
    };
    const result: DocumentExtraction = {
      documentNo:
        valueFromParsed(["documentNo", "DocumentNo", "Document No", "DocNo"]) ??
        normalizedDoc.documentNo ??
        findDocNo(),
      date:
        valueFromParsed(["date", "Date", "Challan Date", "Invoice Date"]) ??
        normalizedDoc.date ??
        findDate(),
      fileUrl: typeof fileUrl === 'string' ? fileUrl : null,
      items: normalizedDoc.items,
    };

    // Persist the extracted data to Supabase for long-term storage
    try {
      const supabase = getSupabaseAdminClient();
      const { error: insertError } = await supabase
        .from("document_extractions")
        .insert({
          document_no: result.documentNo,
          document_date: result.date,
          items: result.items ?? [],
          raw_text: text,
          URL: result.fileUrl ?? null,
        });

      if (insertError) {
        console.error("Supabase insert failed:", insertError);
      }
    } catch (persistErr) {
      console.error("Failed to persist extraction in Supabase:", persistErr);
      // Do not fail the API because of a persistence error
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Vision API error", error);
    const message =
      error instanceof Error ? error.message : "Failed to process image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Simple health check so hitting GET /api/extract returns 200 instead of 404 (helps diagnose routing issues)
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
