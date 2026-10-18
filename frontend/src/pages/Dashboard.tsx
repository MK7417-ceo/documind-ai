import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import StatCard from "../components/StatCard";
import DocumentTable from "../components/DocumentTable";
import EmptyState from "../components/EmptyState";
import { SkeletonList } from "../components/Skeleton";
import ConfirmDialog from "../components/ConfirmDialog";
import UploadModal from "../components/UploadModal";
import { useToast } from "../components/Toast";
import { api, ApiError } from "../lib/api";
import { timeAgo } from "../lib/format";
import type { Document } from "../types";

export default function Dashboard() {
  const { notify } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, history] = await Promise.all([
        api.listDocuments(),
        api.getChatHistory(200).catch(() => []),
      ]);
      setDocuments(docs);
      setQuestionCount(history.filter((m) => m.role === "user").length);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    try {
      await api.deleteDocument(pendingDelete.id);
      notify("Document deleted.", "success");
      setDocuments((prev) => prev.filter((d) => d.id !== pendingDelete.id));
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Failed to delete the document.",
        "error",
      );
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  const readyDocs = documents.filter((d) => d.status === "ready");
  const lastProcessed = [...documents]
    .filter((d) => d.status === "ready")
    .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))[0];

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Overview of your documents and activity"
      actions={
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          ⬆ Upload document
        </button>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 rounded-lg border border-red-300 px-3 py-1 text-xs font-bold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-navy-900" />
            ))}
          </div>
          <div className="mt-8">
            <SkeletonList rows={4} />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total documents" value={documents.length} icon="📄" accent="blue" />
            <StatCard
              label="Questions asked"
              value={questionCount ?? "—"}
              icon="💬"
              accent="purple"
            />
            <StatCard
              label="Last processed"
              value={lastProcessed ? timeAgo(lastProcessed.updated_at) : "—"}
              icon="✅"
              accent="emerald"
            />
          </div>

          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Recent documents</h2>
            {documents.length > 5 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Showing {Math.min(documents.length, 5)} of {documents.length}
              </span>
            )}
          </div>

          <div className="mt-4">
            {documents.length === 0 ? (
              <EmptyState
                icon="📂"
                title="No documents yet"
                description="Upload your first PDF to start asking questions about it."
                action={
                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                  >
                    Upload a document
                  </button>
                }
              />
            ) : (
              <DocumentTable
                documents={documents.slice(0, 5)}
                onDelete={setPendingDelete}
                deletingId={deletingId}
              />
            )}
          </div>

          {readyDocs.length > 0 && (
            <div className="mt-8 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 p-5 dark:border-blue-900 dark:from-blue-950/40 dark:to-purple-950/40">
              <p className="font-bold text-slate-900 dark:text-white">
                {readyDocs.length} document{readyDocs.length === 1 ? "" : "s"} ready to chat
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Select them in the chat to start asking questions.
              </p>
              <Link
                to="/chat"
                className="mt-3 inline-block rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                Open chat →
              </Link>
            </div>
          )}
        </>
      )}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => void load()}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete document?"
        message={`"${pendingDelete?.original_filename}" and all of its chunks, vectors, and chat context will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        busy={deletingId !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </AppLayout>
  );
}
