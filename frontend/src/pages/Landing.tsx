import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

const features = [
  {
    icon: "❓",
    title: "Ask questions from PDFs",
    text: "Upload any PDF and ask natural-language questions. DocuMind reads the full document and answers in seconds.",
  },
  {
    icon: "🔗",
    title: "Source-based answers",
    text: "Every answer cites the filename, page number, and exact passage it came from — so you can verify everything.",
  },
  {
    icon: "🔒",
    title: "Secure document processing",
    text: "Filenames are sanitized, uploads are size- and type-validated, and keys stay in environment variables — never in code.",
  },
  {
    icon: "⚡",
    title: "Fast search",
    text: "Documents are chunked and embedded into a vector store, so retrieval over hundreds of pages stays instant.",
  },
];

const steps = [
  { n: "1", title: "Upload your PDF", text: "Drag & drop — we validate, extract, and index it automatically." },
  { n: "2", title: "Ask anything", text: "Select documents and ask questions in plain language." },
  { n: "3", title: "Get cited answers", text: "Answers come only from your documents, with page-level sources." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-navy-950 dark:text-slate-100">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-lg text-white" aria-hidden="true">
            🧠
          </span>
          <span className="text-lg font-extrabold tracking-tight">DocuMind AI</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            to="/dashboard"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-navy-800"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-[#2a1a5e] px-6 py-16 text-center text-white sm:px-12 sm:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-purple-600/30 blur-3xl"
          />
          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
            AI document question answering
          </p>
          <h1 className="relative mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Ask your documents anything
          </h1>
          <p className="relative mx-auto mt-5 max-w-2xl text-lg text-slate-300">
            Upload PDFs and chat with them. DocuMind AI retrieves the relevant
            passages and answers only from your documents — with page-level
            citations, never guesses.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/dashboard"
              className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-purple-900/40 transition hover:opacity-95 sm:w-auto"
            >
              Upload Documents
            </Link>
            <Link
              to="/chat"
              className="w-full rounded-xl border border-white/25 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto"
            >
              Try the chat
            </Link>
          </div>
          <p className="relative mt-6 text-xs text-slate-400">
            PDF · max 20 MB · answers always cite their sources
          </p>
        </section>

        {/* Features */}
        <section className="py-16 sm:py-20" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
            Built for trustworthy answers
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-500 dark:text-slate-400">
            A retrieval-augmented pipeline that grounds every answer in your
            own documents — and says so when it can't find one.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-navy-900"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 text-2xl dark:from-blue-950 dark:to-purple-950" aria-hidden="true">
                  {f.icon}
                </span>
                <h3 className="mt-4 font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="pb-16 sm:pb-20" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-navy-900"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-extrabold text-white" aria-hidden="true">
                  {s.n}
                </span>
                <h3 className="mt-4 font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              to="/dashboard"
              className="inline-block rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3.5 text-base font-bold text-white shadow-lg transition hover:opacity-95"
            >
              Upload Documents
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800">
        DocuMind AI · Answers grounded in your documents, or it says so.
      </footer>
    </div>
  );
}
