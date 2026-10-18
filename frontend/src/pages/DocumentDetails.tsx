import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { api, ApiError } from "../lib/api";
import { formatBytes, formatDate } from "../lib/format";
import type { Document } from "../types";

export default function DocumentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setDoc(await api.getDocument(id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load the document.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.deleteDocument(id);
      notify("Document deleted.", "success");
      navigate("/dashboard");
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Failed to delete the document.",
        "error",
      );
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const rows: Array<[string, string]> = doc
    ? [
        ["Filename", doc.original_filename],
        ["File size", formatBytes(doc.file_size)],
        ["Upload date", formatDate(doc.created_at)],
        ["Last updated", formatDate(doc.updated_at)],
        ["Pages", String(doc.page_count)],
        ["Text chunks", String(doc.chunk_count)],
        ["Document ID", doc.id],
      ]
    : [];

  return (
    <AppLayout title="Document details" subtitle="Metadata and processing status">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Back to dashboard
      </Link>

      <div className="mt-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-navy-900">
            <Skeleton lines={6} />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {error}{" "}
            <button type="button" onClick={() => void load()} className="ml-1 font-bold underline">
              Retry
            </button>
          </div>
        ) : doc ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-navy-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-4xl" aria-hidden="true">
                    📄
                  </p>
                  <h2 className="mt-2 break-words text-xl font-extrabold tracking-tight">
                    {doc.original_filename}
                  </h2>
                </div>
                <StatusBadge status={doc.status} />
              </div>

              <dl className="mt-6 divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {label}
                    </dt>
                    <dd className="break-all text-sm font-semibold text-slate-900 dark:text-white">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-navy-900">
                <h3 className="font-bold">Actions</h3>
                <div className="mt-3 space-y-2">
                  <Link
                    to="/chat"
                    className="block rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:opacity-95"
                  >
                    Ask about this document
                  </Link>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Delete document
                  </button>
                </div>
              </div>

              {doc.status === "needs_ocr" && (
                <div
                  role="note"
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
                >
                  This PDF looks like scanned images with no selectable text.
                  OCR support is not available yet — please upload a
                  text-based PDF.
                </div>
              )}
              {doc.status === "failed" && (
                <div
                  role="note"
                  className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                >
                  Processing failed. The file may be corrupt,
                  password-protected, or empty. Try re-uploading it.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete document?"
        message={`"${doc?.original_filename}" and all of its chunks, vectors, and chat context will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
      />
    </AppLayout>
  );
}
