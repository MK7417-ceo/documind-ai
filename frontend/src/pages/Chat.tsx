import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "../components/AppLayout";
import ChatMessage, { ThinkingIndicator } from "../components/ChatMessage";
import EmptyState from "../components/EmptyState";
import ConfirmDialog from "../components/ConfirmDialog";
import UploadModal from "../components/UploadModal";
import { useToast } from "../components/Toast";
import { api, ApiError } from "../lib/api";
import type { ChatMessage as ChatMessageType, Document } from "../types";

const SUGGESTED_QUESTIONS = [
  "What is the main purpose of this document?",
  "Summarize this document.",
  "What are the important requirements?",
  "What deadlines are mentioned?",
  "What risks are described?",
];

let localId = 0;
function nextLocalId(prefix: string): string {
  localId += 1;
  return `${prefix}-${Date.now()}-${localId}`;
}

export default function Chat() {
  const { notify } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const readyDocs = useMemo(
    () => documents.filter((d) => d.status === "ready"),
    [documents],
  );

  const loadDocs = useCallback(async () => {
    try {
      const docs = await api.listDocuments();
      setDocuments(docs);
      // Auto-select all ready documents on first load only.
      setSelectedIds((prev) => {
        if (prev.size > 0) return prev;
        return new Set(docs.filter((d) => d.status === "ready").map((d) => d.id));
      });
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Could not load documents.",
        "error",
      );
    }
  }, [notify]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const history = await api.getChatHistory(50);
      setMessages(history);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : "Could not load chat history.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocs();
    void loadHistory();
  }, [loadDocs, loadHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const toggleDoc = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(readyDocs.map((d) => d.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || sending) return;
      if (selectedIds.size === 0) {
        notify("Select at least one document before asking.", "info");
        return;
      }

      const userMsg: ChatMessageType = {
        id: nextLocalId("user"),
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setSending(true);

      try {
        const response = await api.chat(trimmed, [...selectedIds]);
        const assistantMsg: ChatMessageType = {
          id: nextLocalId("assistant"),
          role: "assistant",
          content: response.answer,
          sources: response.sources,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        notify(
          err instanceof ApiError ? err.message : "The chat request failed.",
          "error",
        );
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
    },
    [sending, selectedIds, notify],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      await api.clearChatHistory();
      setMessages([]);
      notify("Chat history cleared.", "success");
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : "Could not clear chat history.",
        "error",
      );
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  const noDocsSelected = selectedIds.size === 0;

  return (
    <AppLayout
      title="Chat"
      subtitle="Ask questions about your documents"
      actions={
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          disabled={messages.length === 0}
          aria-label="Clear chat history"
          className="shrink-0 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-navy-800"
        >
          🗑 Clear chat
        </button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Document selector */}
        <section
          aria-label="Document selection"
          className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-navy-900 lg:sticky lg:top-24"
        >
          <button
            type="button"
            onClick={() => setSelectorOpen((v) => !v)}
            aria-expanded={selectorOpen}
            className="flex w-full items-center justify-between"
          >
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Documents ({readyDocs.length})
            </h2>
            <span className="text-slate-400 lg:hidden" aria-hidden="true">
              {selectorOpen ? "▲" : "▼"}
            </span>
          </button>

          <div className={`${selectorOpen ? "block" : "hidden"} lg:block`}>
            {readyDocs.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  icon="📄"
                  title="No ready documents"
                  description="Upload a PDF and wait for it to finish processing."
                  action={
                    <button
                      type="button"
                      onClick={() => setUploadOpen(true)}
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Upload
                    </button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="mt-3 flex gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-700"
                  >
                    None
                  </button>
                </div>
                <ul className="thin-scroll mt-3 max-h-72 space-y-1.5 overflow-y-auto">
                  {readyDocs.map((doc) => (
                    <li key={doc.id}>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:bg-slate-50 has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50/60 dark:border-slate-700 dark:hover:bg-navy-800 dark:has-[:checked]:border-blue-600 dark:has-[:checked]:bg-blue-950/40">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleDoc(doc.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {doc.original_filename}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {doc.page_count} pages · {doc.chunk_count} chunks
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        {/* Chat column */}
        <section aria-label="Chat conversation" className="flex min-h-[60vh] flex-col">
          {noDocsSelected ? (
            <EmptyState
              icon="💬"
              title="Select a document to start"
              description="Upload a document and select it to start asking questions. Answers come only from your documents."
              action={
                readyDocs.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white"
                  >
                    Upload a document
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="thin-scroll min-h-[40vh] flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 dark:border-slate-700 dark:bg-navy-900/60">
                {loading ? (
                  <div className="space-y-4" aria-label="Loading messages">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"
                      />
                    ))}
                  </div>
                ) : loadError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                  >
                    {loadError}{" "}
                    <button
                      type="button"
                      onClick={() => void loadHistory()}
                      className="ml-1 font-bold underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                    <span className="text-4xl" aria-hidden="true">
                      👋
                    </span>
                    <h3 className="mt-3 font-bold text-slate-900 dark:text-white">
                      Ask anything about your documents
                    </h3>
                    <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                      I'll search {selectedIds.size} selected document
                      {selectedIds.size === 1 ? "" : "s"} and answer only from
                      what I find there.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => <ChatMessage key={m.id} message={m} />)
                )}
                {sending && <ThinkingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested questions */}
              {messages.length === 0 && !loading && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Suggested questions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void send(q)}
                        disabled={sending}
                        className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-400 hover:text-blue-700 disabled:opacity-50 dark:border-slate-600 dark:bg-navy-900 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="mt-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                  }}
                  className="flex items-end gap-2.5"
                >
                  <label htmlFor="chat-input" className="sr-only">
                    Ask a question about your documents
                  </label>
                  <textarea
                    id="chat-input"
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder={`Ask about ${selectedIds.size} document${selectedIds.size === 1 ? "" : "s"}… (Enter to send, Shift+Enter for new line)`}
                    disabled={sending}
                    className="thin-scroll max-h-36 min-h-[48px] flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-60 dark:border-slate-600 dark:bg-navy-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={sending || input.trim().length === 0}
                    aria-label="Send message"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-lg text-white shadow-sm transition hover:opacity-95 disabled:opacity-40"
                  >
                    {sending ? (
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <span aria-hidden="true">➤</span>
                    )}
                  </button>
                </form>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  Answers are generated only from your selected documents. If
                  something isn't found, I'll say so.
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => void loadDocs()}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear chat history?"
        message="All previous chat messages will be permanently deleted. This cannot be undone."
        confirmLabel="Clear history"
        busy={clearing}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => void handleClearHistory()}
      />
    </AppLayout>
  );
}
