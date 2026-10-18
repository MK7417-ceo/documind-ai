import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { DocumentStatus } from "../types";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

type Phase = "idle" | "uploading" | "processing" | "done" | "error";

interface ProcessingStep {
  key: DocumentStatus;
  label: string;
  activeDuring: DocumentStatus[];
}

const STEPS: ProcessingStep[] = [
  { key: "extracting", label: "Extracting text", activeDuring: ["extracting"] },
  { key: "chunking", label: "Creating chunks", activeDuring: ["chunking"] },
  { key: "embedding", label: "Generating embeddings", activeDuring: ["embedding"] },
  { key: "indexing", label: "Indexing document", activeDuring: ["indexing"] },
];

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

/**
 * PDF upload dialog: validation → upload progress → live processing
 * pipeline status (polled from the backend every 1.5s).
 */
export default function UploadModal({ open, onClose, onUploaded }: UploadModalProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<DocumentStatus>("uploading");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setFile(null);
    setProgress(0);
    setStatus("uploading");
    setError(null);
    setDragging(false);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Stop polling when the modal unmounts/closes.
  useEffect(() => {
    if (!open) {
      stopPolling();
    }
    return () => stopPolling();
  }, [open, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  /** Poll the document status until it reaches a terminal state. */
  const pollStatus = useCallback(
    (id: string) => {
      const terminal = new Set(["ready", "failed", "needs_ocr"]);
      pollRef.current = setInterval(async () => {
        try {
          const doc = await api.getDocument(id);
          setStatus(doc.status);
          if (terminal.has(doc.status)) {
            stopPolling();
            if (doc.status === "ready") {
              setPhase("done");
              onUploaded();
            } else {
              setPhase("error");
              setError(
                doc.status === "needs_ocr"
                  ? "This PDF appears to be scanned images with no selectable text. It needs OCR processing, which is not available yet — please upload a text-based PDF."
                  : "Processing failed. The PDF may be corrupt, password-protected, or empty.",
              );
            }
          }
        } catch (err) {
          stopPolling();
          setPhase("error");
          setError(
            err instanceof ApiError
              ? err.message
              : "Could not check the processing status.",
          );
        }
      }, 1500);
    },
    [onUploaded, stopPolling],
  );

  const validateFile = useCallback((f: File): string | null => {
    const isPdf =
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return "Only PDF files are accepted.";
    if (f.size > MAX_FILE_SIZE) {
      return `File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`;
    }
    if (f.size === 0) return "This file is empty.";
    return null;
  }, []);

  const startUpload = useCallback(
    async (f: File) => {
      const validationError = validateFile(f);
      if (validationError) {
        setError(validationError);
        setPhase("error");
        return;
      }
      setFile(f);
      setError(null);
      setPhase("uploading");
      setProgress(0);
      setStatus("uploading");
      try {
        const result = await api.uploadDocument(f, (p) => {
          setProgress(Math.round((p.loaded / p.total) * 100));
        });
        setProgress(100);
        setPhase("processing");
        setStatus((result.status as DocumentStatus) || "extracting");
        pollStatus(result.id);
      } catch (err) {
        setPhase("error");
        setError(
          err instanceof ApiError
            ? err.message
            : "Upload failed. Please try again.",
        );
      }
    },
    [validateFile, pollStatus],
  );

  const handleClose = () => {
    if (phase === "uploading" || phase === "processing") return; // don't close mid-flight
    reset();
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (phase === "uploading" || phase === "processing") return;
    const f = e.dataTransfer.files?.[0];
    if (f) void startUpload(f);
  };

  if (!open) return null;

  const busy = phase === "uploading" || phase === "processing";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-title"
    >
      <div
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="animate-fade-in relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-navy-900">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="upload-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Upload document
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              PDF only · max 20 MB per file
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            aria-label="Close upload dialog"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-navy-800"
          >
            ✕
          </button>
        </div>

        {phase === "idle" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                : "border-slate-300 hover:border-blue-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-navy-800"
            }`}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Drop a PDF file here or press Enter to browse"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
          >
            <span className="text-4xl" aria-hidden="true">
              📤
            </span>
            <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">
              Drag & drop your PDF here
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">or</p>
            <span className="mt-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">
              Browse files
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              aria-label="Choose a PDF file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void startUpload(f);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {phase === "uploading" && (
          <div className="mt-5">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              📄 {file?.name}
            </p>
            <div
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Uploading… {progress}%
            </p>
          </div>
        )}

        {phase === "processing" && (
          <div className="mt-5">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              📄 {file?.name}
            </p>
            <ol className="mt-4 space-y-2.5">
              <ProcessingRow label="Uploading" state="done" />
              {STEPS.map((step) => {
                const order: DocumentStatus[] = [
                  "extracting",
                  "chunking",
                  "embedding",
                  "indexing",
                ];
                const currentIdx = order.indexOf(status);
                const stepIdx = order.indexOf(step.key);
                const state =
                  stepIdx < currentIdx ? "done" : stepIdx === currentIdx ? "active" : "pending";
                return <ProcessingRow key={step.key} label={step.label} state={state} />;
              })}
            </ol>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Processing your document — this usually takes a few seconds.
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="mt-5 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-950" aria-hidden="true">
              ✓
            </span>
            <h3 className="mt-3 font-bold text-slate-900 dark:text-white">
              Document ready!
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {file?.name} was processed successfully. You can now ask questions about it.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                Done
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-navy-800"
              >
                Upload another
              </button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="mt-5">
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            >
              {error ?? "Something went wrong."}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-navy-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProcessingRow({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          state === "done"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : state === "active"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
              : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
        }`}
      >
        {state === "done" ? "✓" : state === "active" ? <Spinner /> : "·"}
      </span>
      <span
        className={`text-sm ${
          state === "pending"
            ? "text-slate-400 dark:text-slate-500"
            : "font-medium text-slate-700 dark:text-slate-200"
        }`}
      >
        {label}
        {state === "active" && <span className="ml-1 animate-pulse">…</span>}
      </span>
    </li>
  );
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
