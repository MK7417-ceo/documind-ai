import { useCallback, useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import ConfirmDialog from "../components/ConfirmDialog";
import ThemeToggle, { applyTheme } from "../components/ThemeToggle";
import { useToast } from "../components/Toast";
import { api, ApiError } from "../lib/api";
import type { HealthStatus } from "../types";

type Accent = "blue" | "purple" | "emerald";
const ACCENT_KEY = "documind-accent";

const accentOptions: Array<{ id: Accent; label: string; swatch: string }> = [
  { id: "blue", label: "Ocean blue", swatch: "bg-blue-600" },
  { id: "purple", label: "Violet", swatch: "bg-purple-600" },
  { id: "emerald", label: "Emerald", swatch: "bg-emerald-600" },
];

export default function Settings() {
  const { notify } = useToast();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [accent, setAccent] = useState<Accent>(
    () => (localStorage.getItem(ACCENT_KEY) as Accent) || "blue",
  );
  const [confirmClearDocs, setConfirmClearDocs] = useState(false);
  const [confirmClearChat, setConfirmClearChat] = useState(false);
  const [busyDocs, setBusyDocs] = useState(false);
  const [busyChat, setBusyChat] = useState(false);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      setHealth(await api.health());
    } catch (err) {
      setHealthError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the backend.",
      );
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const pickAccent = (a: Accent) => {
    setAccent(a);
    localStorage.setItem(ACCENT_KEY, a);
    notify(`Accent set to ${accentOptions.find((o) => o.id === a)?.label}.`, "success");
  };

  const resetTheme = () => {
    localStorage.removeItem("documind-theme");
    applyTheme("light");
    notify("Theme reset to light.", "success");
  };

  const handleClearDocs = async () => {
    setBusyDocs(true);
    try {
      const count = await api.deleteAllDocuments();
      notify(
        count === 0 ? "There were no documents to delete." : `${count} document${count === 1 ? "" : "s"} deleted.`,
        "success",
      );
      void loadHealth();
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Could not delete documents.",
        "error",
      );
    } finally {
      setBusyDocs(false);
      setConfirmClearDocs(false);
    }
  };

  const handleClearChat = async () => {
    setBusyChat(true);
    try {
      await api.clearChatHistory();
      notify("Chat history cleared.", "success");
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Could not clear chat history.",
        "error",
      );
    } finally {
      setBusyChat(false);
      setConfirmClearChat(false);
    }
  };

  const healthy = health?.status?.toLowerCase() === "ok";

  return (
    <AppLayout title="Settings" subtitle="Preferences, model status, and data controls">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Appearance */}
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-navy-900" aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" className="text-base font-bold">Appearance</h2>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-navy-800">
            <div>
              <p className="text-sm font-semibold">Theme</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Light or dark — applied across the whole app.
              </p>
            </div>
            <ThemeToggle />
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-navy-800">
            <p className="text-sm font-semibold">Accent color</p>
            <div className="mt-2.5 flex gap-2" role="radiogroup" aria-label="Accent color">
              {accentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={accent === opt.id}
                  onClick={() => pickAccent(opt.id)}
                  title={opt.label}
                  aria-label={opt.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${opt.swatch} transition ${
                    accent === opt.id
                      ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-navy-900"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  {accent === opt.id && (
                    <span className="text-sm font-bold text-white" aria-hidden="true">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={resetTheme}
            className="mt-3 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            Reset appearance to defaults
          </button>
        </section>

        {/* API / model status */}
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-navy-900" aria-labelledby="api-heading">
          <div className="flex items-center justify-between">
            <h2 id="api-heading" className="text-base font-bold">API & model status</h2>
            <button
              type="button"
              onClick={() => void loadHealth()}
              disabled={healthLoading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-navy-800"
            >
              {healthLoading ? "Checking…" : "↻ Refresh"}
            </button>
          </div>

          {healthError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            >
              {healthError}
            </div>
          ) : health ? (
            <dl className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Backend status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      healthy
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${healthy ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden="true" />
                    {health.status}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Mode</dt>
                <dd>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      health.mock_mode
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                    }`}
                  >
                    {health.mock_mode ? "Mock (no API key)" : "Live API"}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Documents indexed</dt>
                <dd className="text-sm font-bold">{health.documents}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-sm text-slate-500 dark:text-slate-400">Version</dt>
                <dd className="text-sm font-semibold">{health.version}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Checking backend status…</p>
          )}

          {health?.mock_mode && (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              Mock mode is on: embeddings and answers are generated locally for
              testing. Set the backend's <code>OPENAI_API_KEY</code> (or
              compatible key) to use a real model.
            </p>
          )}
        </section>

        {/* Danger zone */}
        <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm lg:col-span-2 dark:border-red-900 dark:bg-navy-900" aria-labelledby="danger-heading">
          <h2 id="danger-heading" className="text-base font-bold text-red-700 dark:text-red-400">
            Danger zone
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            These actions permanently delete data and cannot be undone.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-sm font-bold">Clear chat history</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deletes all previous chat messages.
              </p>
              <button
                type="button"
                onClick={() => setConfirmClearChat(true)}
                className="mt-auto rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Clear chat history
              </button>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-sm font-bold">Delete all documents</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deletes every document, its chunks, and its vectors.
              </p>
              <button
                type="button"
                onClick={() => setConfirmClearDocs(true)}
                className="mt-auto rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete all documents
              </button>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmClearChat}
        title="Clear chat history?"
        message="All previous chat messages will be permanently deleted. This cannot be undone."
        confirmLabel="Clear history"
        busy={busyChat}
        onClose={() => setConfirmClearChat(false)}
        onConfirm={() => void handleClearChat()}
      />
      <ConfirmDialog
        open={confirmClearDocs}
        title="Delete all documents?"
        message="Every uploaded document, along with all chunks and vectors, will be permanently deleted. This cannot be undone."
        confirmLabel="Delete all"
        busy={busyDocs}
        onClose={() => setConfirmClearDocs(false)}
        onConfirm={() => void handleClearDocs()}
      />
    </AppLayout>
  );
}
