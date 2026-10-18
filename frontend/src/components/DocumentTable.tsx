import { Link } from "react-router-dom";
import type { Document } from "../types";
import { formatDateShort, formatBytes } from "../lib/format";
import StatusBadge from "./StatusBadge";

interface DocumentTableProps {
  documents: Document[];
  onDelete: (doc: Document) => void;
  deletingId?: string | null;
}

/**
 * Responsive document list: a table on desktop, stacked cards on mobile.
 */
export default function DocumentTable({ documents, onDelete, deletingId }: DocumentTableProps) {
  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-navy-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-navy-800">
              <th className="px-5 py-3 font-semibold text-slate-600 dark:text-slate-300">Name</th>
              <th className="px-5 py-3 font-semibold text-slate-600 dark:text-slate-300">Size</th>
              <th className="px-5 py-3 font-semibold text-slate-600 dark:text-slate-300">Pages</th>
              <th className="px-5 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
              <th className="px-5 py-3 font-semibold text-slate-600 dark:text-slate-300">Uploaded</th>
              <th className="px-5 py-3 text-right font-semibold text-slate-600 dark:text-slate-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-navy-800"
              >
                <td className="px-5 py-3.5">
                  <Link
                    to={`/documents/${doc.id}`}
                    className="max-w-[280px] truncate font-semibold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                    title={doc.original_filename}
                  >
                    📄 {doc.original_filename}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-slate-600 dark:text-slate-300">
                  {formatBytes(doc.file_size)}
                </td>
                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{doc.page_count}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-slate-600 dark:text-slate-300">
                  {formatDateShort(doc.created_at)}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex justify-end gap-2">
                    <Link
                      to={`/documents/${doc.id}`}
                      aria-label={`View details of ${doc.original_filename}`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-navy-800"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(doc)}
                      disabled={deletingId === doc.id}
                      aria-label={`Delete ${doc.original_filename}`}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      {deletingId === doc.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-navy-900"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                to={`/documents/${doc.id}`}
                className="truncate font-semibold text-slate-900 dark:text-white"
              >
                📄 {doc.original_filename}
              </Link>
              <StatusBadge status={doc.status} />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {formatBytes(doc.file_size)} · {doc.page_count} pages · {formatDateShort(doc.created_at)}
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                to={`/documents/${doc.id}`}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-center text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                View details
              </Link>
              <button
                type="button"
                onClick={() => onDelete(doc)}
                disabled={deletingId === doc.id}
                className="flex-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
              >
                {deletingId === doc.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
