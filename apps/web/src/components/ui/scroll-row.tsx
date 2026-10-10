"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Horizontal row that makes overflow obvious: a visible scrollbar, edge fades and arrow buttons that
 * appear only when there is more to see in that direction. RTL-aware: "start" is the right side.
 */
export function ScrollRow({
  children,
  className,
  activeKey,
}: {
  children: ReactNode;
  className?: string;
  activeKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // In RTL, scrollLeft is 0 at the start and goes negative towards the end.
    const offset = Math.abs(el.scrollLeft);
    setEdges({ start: offset > 2, end: offset + el.clientWidth < el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure, children]);

  // Keep the selected item visible (e.g. when arriving with ?category=… from the dashboard).
  useEffect(() => {
    const active = ref.current?.querySelector<HTMLElement>('[aria-current="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeKey]);

  const scroll = (towards: "start" | "end") => {
    const el = ref.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: towards === "end" ? -amount : amount, behavior: "smooth" });
  };

  const arrow =
    "absolute top-0 z-10 hidden size-9 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card transition-opacity hover:bg-soft sm:flex";

  return (
    // Lucide mirrors chevrons under dir="rtl", so "Right" renders pointing left (towards the end).
    <div className={cn("relative", className)}>
      <div ref={ref} className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-2.5 sm:mx-0 sm:px-11">
        {children}
      </div>

      {/* Fades hint that the row continues past the edge. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 start-0 w-10 bg-gradient-to-l from-canvas to-transparent transition-opacity sm:start-9",
          edges.start ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 end-0 w-10 bg-gradient-to-r from-canvas to-transparent transition-opacity sm:end-9",
          edges.end ? "opacity-100" : "opacity-0",
        )}
      />

      <button
        type="button"
        aria-label="גלילה אחורה"
        onClick={() => scroll("start")}
        className={cn(arrow, "start-0", !edges.start && "pointer-events-none opacity-0")}
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        aria-label="עוד קטגוריות"
        onClick={() => scroll("end")}
        className={cn(arrow, "end-0", !edges.end && "pointer-events-none opacity-0")}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
