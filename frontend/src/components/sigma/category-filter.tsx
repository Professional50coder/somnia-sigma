"use client";

import { useRef, useEffect } from "react";
import { animate, stagger, onScroll, createLayout } from "animejs";
import type { Category } from "@/lib/types";

interface CategoryFilterProps {
  categories: Category[];
  active: string;
  onSelect: (id: string) => void;
}

export function CategoryFilter({ categories, active, onSelect }: CategoryFilterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  // Layout animation for filter reordering
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const layout = createLayout(el, {
      duration: 300,
      ease: "outExpo",
    });
    layout.record();
    return () => { try { layout.revert(); } catch {} };
  }, [categories, active]);

  // Entrance animation using onScroll
  useEffect(() => {
    if (!ref.current || played.current) return;
    const el = ref.current;
    played.current = true;
    const buttons = el.querySelectorAll("button");
    animate(buttons, {
      opacity: [0, 1],
      scale: [0.9, 1],
      duration: 300,
      delay: stagger(30, { from: "center" }),
      ease: "outExpo",
      autoplay: onScroll({ target: el, enter: "100%" }),
    });
  }, []);

  return (
    <div className="flex items-center gap-1 flex-wrap" ref={ref}>
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
