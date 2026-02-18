import type { TransactionType } from "../../types";

export type ImportFormat = "csv" | "ofx";

export type ParsedImportRow = {
  rowIndex: number;
  description: string;
  amount: number;
  type: TransactionType;
  occurrenceDate: string | null;
  categoryHint: string | null;
  rawPayload: Record<string, unknown>;
};

const normalizeDescription = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const parseDate = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return null;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const compact = raw.match(/^(\d{8})/);
  if (compact) {
    const x = compact[1];
    return `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6, 8)}`;
  }
  return null;
};

const parseAmount = (value: string): number | null => {
  const raw = value.replace(/[R$\s]/g, "").trim();
  if (!raw) return null;
  const cleaned = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const inferType = (amount: number): TransactionType =>
  amount >= 0 ? "income" : "expense";

const splitCsvLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
};

export const buildDedupeKey = (input: {
  description: string;
  amount: number;
  type: TransactionType;
  occurrenceDate: string | null;
}) => {
  const datePart = input.occurrenceDate ?? "sem-data";
  const amountPart = Math.abs(input.amount).toFixed(2);
  const descPart = normalizeDescription(input.description);
  return `${datePart}|${amountPart}|${input.type}|${descPart}`;
};

export const parseCsvImport = (rawText: string): ParsedImportRow[] => {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const delimiter = (lines[0].match(/;/g) ?? []).length > (lines[0].match(/,/g) ?? []).length ? ";" : ",";
  const header = splitCsvLine(lines[0], delimiter).map((h) => normalizeDescription(h));
  const idxDate = header.findIndex((h) => h.includes("data"));
  const idxDesc = header.findIndex((h) => h.includes("descricao") || h.includes("historico") || h.includes("memo"));
  const idxAmount = header.findIndex((h) => h.includes("valor") || h.includes("amount") || h.includes("montante"));
  const idxCategory = header.findIndex((h) => h.includes("categoria") || h.includes("category") || h.includes("cat"));

  const start = idxDesc === -1 || idxAmount === -1 ? 0 : 1;
  const rows: ParsedImportRow[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i], delimiter);
    const description = idxDesc >= 0 ? cols[idxDesc] ?? "" : cols[1] ?? cols[0] ?? "";
    const amountRaw = idxAmount >= 0 ? cols[idxAmount] ?? "" : cols[2] ?? cols[1] ?? "";
    const categoryHint = idxCategory >= 0 ? (cols[idxCategory] ?? "").trim() : "";
    const amount = parseAmount(amountRaw);
    if (!description.trim() || amount === null) continue;
    const dateRaw = idxDate >= 0 ? cols[idxDate] ?? "" : cols[0] ?? "";
    const occurrenceDate = parseDate(dateRaw);
    rows.push({
      rowIndex: i + 1,
      description: description.trim(),
      amount: Math.abs(amount),
      type: inferType(amount),
      occurrenceDate,
      categoryHint: categoryHint || null,
      rawPayload: { columns: cols },
    });
  }
  return rows;
};

export const parseOfxImport = (rawText: string): ParsedImportRow[] => {
  const blocks = rawText.split(/<STMTTRN>/i).slice(1);
  const rows: ParsedImportRow[] = [];
  blocks.forEach((block, index) => {
    const getTag = (tag: string) => {
      const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"));
      return match?.[1]?.trim() ?? "";
    };
    const trnType = getTag("TRNTYPE").toUpperCase();
    const amountRaw = getTag("TRNAMT");
    const amount = parseAmount(amountRaw);
    if (amount === null) return;
    const memo = getTag("MEMO");
    const name = getTag("NAME");
    const fitid = getTag("FITID");
    const dateRaw = getTag("DTPOSTED");
    const occurrenceDate = parseDate(dateRaw);
    const description = (memo || name || `Transacao OFX ${index + 1}`).trim();
    const explicitIncome = trnType === "CREDIT" || trnType === "DEP";
    const explicitExpense = trnType === "DEBIT" || trnType === "PAYMENT";
    const inferredAmount = explicitIncome ? Math.abs(amount) : explicitExpense ? -Math.abs(amount) : amount;

    rows.push({
      rowIndex: index + 1,
      description,
      amount: Math.abs(inferredAmount),
      type: inferType(inferredAmount),
      occurrenceDate,
      categoryHint: null,
      rawPayload: { trnType, fitid, dateRaw, amountRaw, memo, name },
    });
  });
  return rows;
};

export const parseImportFile = (format: ImportFormat, rawText: string): ParsedImportRow[] =>
  format === "ofx" ? parseOfxImport(rawText) : parseCsvImport(rawText);
