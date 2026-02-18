export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const tokenize = (value: string) =>
  normalizeSearch(value)
    .split(" ")
    .filter((token) => token.length >= 3);
