import { useState } from "react";
import type { Source } from "../types";

/** Expandable citation card shown under assistant answers. */
export default function SourceCard({ source }: { source: Source }) {
  const [expanded, setExpanded] = useState(false);
  const preview =
    source.text.length > 180 && !expanded
      ? `${source.text.slice(0, 180)}…`
      : source.text;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-3.5 py-3 dark:border-slate-700 dark:bg-navy-800/60">
      <div className="flex items-center gap-2 text-xs">
        <span aria-hidden="true">📄</span>
        <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
          {source.filename}
        </span>
        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          Page {source.page}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        “{preview}”
      </p>
      {source.text.length > 180 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
