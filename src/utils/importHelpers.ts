import type { ImportFormat } from "../features/entries/importParser";

export const inferImportFormatFromFileName = (fileName: string): ImportFormat | null => {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "csv") return "csv";
  if (ext === "ofx") return "ofx";
  return null;
};

export const isLikelyCardStatement = (fileName: string) =>
  /(fatura|cartao|cartão|card)/i.test(fileName);

export const isCardBillPayment = (description: string) =>
  /(pagamento.*fatura|fatura.*paga|pagto.*fatura|pgt[o]?\s*fatura|payment.*invoice)/i.test(description);

export const isCardCreditEvent = (description: string) =>
  /(estorno|reembolso|credito|crédito|cashback|ajuste a credito|ajuste a crédito)/i.test(description);
