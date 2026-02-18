import { format } from "date-fns";

export const monthStartIso = (date: Date) => format(date, "yyyy-MM-01");

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const slugify = (input: string) =>
  input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export const parseMoney = (raw: string) =>
  Number(raw.replace(/\./g, "").replace(",", "."));

export const toPostgrestCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: string }).code ?? "")
    : "";
