import type { CategoryRow, TransactionType } from "../types";
import { normalizeSearch, tokenize } from "./search";

export const suggestCategoryId = (
  categories: CategoryRow[],
  description: string,
  type: TransactionType,
  categoryHint?: string | null
): string => {
  const active = categories.filter((cat) => cat.deleted_at === null);
  if (!active.length) return "";
  const typed = active.filter((cat) => cat.default_type === type);
  const pool = typed.length ? typed : active;

  const hintNorm = normalizeSearch(categoryHint ?? "");
  if (hintNorm) {
    const exactByCode = pool.find((cat) => normalizeSearch(cat.code) === hintNorm);
    if (exactByCode) return exactByCode.id;
    const exactByName = pool.find((cat) => normalizeSearch(cat.name) === hintNorm);
    if (exactByName) return exactByName.id;
    const partialByCode = pool.find(
      (cat) => normalizeSearch(cat.code).includes(hintNorm) || hintNorm.includes(normalizeSearch(cat.code))
    );
    if (partialByCode) return partialByCode.id;
    const partialByName = pool.find(
      (cat) => normalizeSearch(cat.name).includes(hintNorm) || hintNorm.includes(normalizeSearch(cat.name))
    );
    if (partialByName) return partialByName.id;
  }

  const descriptionNorm = normalizeSearch(description);
  const scored = pool
    .map((cat) => {
      const nameNorm = normalizeSearch(cat.name);
      const codeNorm = normalizeSearch(cat.code);
      const tokens = [...tokenize(cat.name), ...tokenize(cat.code)];
      const tokenHits = tokens.filter((token) => descriptionNorm.includes(token)).length;
      const exactBonus = descriptionNorm.includes(nameNorm) || descriptionNorm.includes(codeNorm) ? 3 : 0;
      return { id: cat.id, score: tokenHits + exactBonus };
    })
    .sort((a, b) => b.score - a.score);

  if ((scored[0]?.score ?? 0) > 0) return scored[0].id;
  const outros = pool.find(
    (cat) => normalizeSearch(cat.name).includes("outros") || normalizeSearch(cat.code).includes("outros")
  );
  return outros?.id ?? pool[0]?.id ?? "";
};
