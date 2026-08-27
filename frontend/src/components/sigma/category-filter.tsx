"use client";

import type { Category } from "@/lib/types";

interface CategoryFilterProps {
  categories: Category[];
  active: string;
  onSelect: (id: string) => void;
}

export function CategoryFilter({ categories, active, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        onClick={() => onSelect("all")}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          active === "all"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            active === cat.id
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          {cat.name}
          <span className="ml-1 text-muted-foreground">({cat.count})</span>
        </button>
      ))}
    </div>
  );
}
