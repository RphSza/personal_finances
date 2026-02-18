import { useEffect, useId, useMemo, useRef, useState } from "react";
import { normalizeSearch } from "../utils/search";
import type { CategoryGroupRow, CategoryRow, TransactionType } from "../types";

type CategoryComboboxProps = {
  categories: CategoryRow[];
  groups: CategoryGroupRow[];
  value: string;
  onChange: (categoryId: string) => void;
  transactionType: TransactionType;
  disabled?: boolean;
};

type EnrichedOption = {
  id: string;
  name: string;
  groupName: string;
  groupSortOrder: number;
  type: TransactionType;
};

export function CategoryCombobox({
  categories,
  groups,
  value,
  onChange,
  transactionType,
  disabled,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const comboId = useId();

  const groupMap = useMemo(() => {
    const map = new Map<string, CategoryGroupRow>();
    for (const g of groups) map.set(g.id, g);
    return map;
  }, [groups]);

  const options = useMemo(() => {
    const active = categories.filter((c) => c.deleted_at === null);
    const enriched: EnrichedOption[] = active.map((c) => {
      const group = groupMap.get(c.group_id);
      return {
        id: c.id,
        name: c.name,
        groupName: group?.name ?? "",
        groupSortOrder: group?.sort_order ?? 999,
        type: c.default_type,
      };
    });
    enriched.sort((a, b) => {
      const typePri = (t: TransactionType) => (t === transactionType ? 0 : 1);
      const tp = typePri(a.type) - typePri(b.type);
      if (tp !== 0) return tp;
      const gs = a.groupSortOrder - b.groupSortOrder;
      if (gs !== 0) return gs;
      return a.name.localeCompare(b.name);
    });
    return enriched;
  }, [categories, groupMap, transactionType]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = normalizeSearch(query);
    return options.filter(
      (o) => normalizeSearch(o.name).includes(q) || normalizeSearch(o.groupName).includes(q)
    );
  }, [options, query]);

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    const opt = options.find((o) => o.id === value);
    return opt?.name ?? "";
  }, [options, value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered]);

  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.children[activeIndex] as HTMLElement | undefined;
      active?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) select(filtered[activeIndex].id);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setQuery("");
        break;
    }
  };

  return (
    <div className="category-combobox" onKeyDown={handleKeyDown}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${comboId}-list`}
        aria-activedescendant={open && filtered[activeIndex] ? `${comboId}-opt-${activeIndex}` : undefined}
        aria-autocomplete="list"
        value={open ? query : selectedLabel}
        placeholder="Buscar categoria..."
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && filtered.length > 0 ? (
        <ul
          ref={listRef}
          id={`${comboId}-list`}
          role="listbox"
          className="category-combobox-dropdown"
        >
          {filtered.map((opt, i) => (
            <li
              key={opt.id}
              id={`${comboId}-opt-${i}`}
              role="option"
              aria-selected={opt.id === value}
              className={`category-combobox-option ${i === activeIndex ? "active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                select(opt.id);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="category-combobox-name">{opt.name}</span>
              {opt.groupName ? (
                <span className="category-combobox-group">{opt.groupName}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
