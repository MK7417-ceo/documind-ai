import type { DocumentStatus } from "../types";

const statusConfig: Record<
  DocumentStatus,
  { label: string; classes: string; dot: string }
> = {
  uploading: {
    label: "Uploading",
    classes: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  extracting: {
    label: "Extracting",
    classes: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  chunking: {
    label: "Chunking",
    classes: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
    dot: "bg-indigo-500",
  },
  embedding: {
    label: "Embedding",
    classes: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
    dot: "bg-purple-500",
  },
  indexing: {
    label: "Indexing",
    classes: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    dot: "bg-violet-500",
  },
  ready: {
    label: "Ready",
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    classes: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    dot: "bg-red-500",
  },
  needs_ocr: {
    label: "Needs OCR",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    dot: "bg-amber-500",
  },
};

/** Small colored status pill for a document's processing state. */
export default function StatusBadge({ status }: { status: DocumentStatus }) {
  const cfg = statusConfig[status] ?? {
    label: status,
    classes: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    dot: "bg-slate-500",
  };
  const pulsing = status !== "ready" && status !== "failed" && status !== "needs_ocr";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.classes}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${pulsing ? "animate-pulse" : ""}`}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  );
}
