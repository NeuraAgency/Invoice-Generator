export interface NormalizedItem {
  indNo: string | null;
  materialNo: string | null;
  materialDescription: string | null;
  quantityFromRemarks: string | null;
}

export interface NormalizedDocument {
  documentNo: string | null;
  date: string | null;
  items: NormalizedItem[];
}

const stripCodeFences = (raw: string): string => {
  let text = raw.trim();
  if (text.startsWith("```") && text.endsWith("```")) {
    text = text.slice(3, -3).trim();
  }
  if (text.startsWith("```json")) {
    text = text.slice(7).trim();
  }
  if (text.startsWith("```") && text.includes("```")) {
    const idx = text.indexOf("```");
    text = text.slice(3, idx).trim();
  }
  return text;
};

const cleanValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  let str = String(value).trim();
  if (str === "") return null;
  str = str.replace(/^"+|"+$/g, "");
  str = str.replace(/,$/, "");
  return str.trim() || null;
};

const attemptParse = (raw: string): any | null => {
  const text = stripCodeFences(raw);
  try {
    return JSON.parse(text);
  } catch {}

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = text.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  return null;
};

export const normalizeExtraction = (raw: string): NormalizedDocument => {
  const parsed = attemptParse(raw);

  const documentNo = cleanValue(parsed?.documentNo) ?? null;
  const date = cleanValue(parsed?.date) ?? null;

  const sourceItems = Array.isArray(parsed?.Items)
    ? parsed.Items
    : Array.isArray(parsed?.items)
    ? parsed.items
    : [];

  const items: NormalizedItem[] = sourceItems
    .map((item: any) => {
      const indNo =
        cleanValue(item?.["IND #"]) ??
        cleanValue(item?.indNo) ??
        cleanValue(item?.ind) ??
        cleanValue(item?.IND) ??
        null;

      const materialNo =
        cleanValue(item?.materialNo) ??
        cleanValue(item?.["Material No"]) ??
        cleanValue(item?.code) ??
        null;

      const materialDescription =
        cleanValue(item?.materialDescription) ??
        cleanValue(item?.description) ??
        cleanValue(item?.["Material Description"]) ??
        null;

      const quantityFromRemarks =
        cleanValue(item?.quantityFromRemarks) ??
        cleanValue(item?.quantity) ??
        cleanValue(item?.qty) ??
        null;

      if (!indNo && !materialNo && !materialDescription && !quantityFromRemarks) {
        return null;
      }

      return {
        indNo,
        materialNo,
        materialDescription,
        quantityFromRemarks,
      } as NormalizedItem;
    })
    .filter((item: NormalizedItem | null): item is NormalizedItem => Boolean(item));

  return {
    documentNo,
    date,
    items,
  };
};
