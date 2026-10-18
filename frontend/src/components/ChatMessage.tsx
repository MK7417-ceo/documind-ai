import type { ChatMessage as ChatMessageType } from "../types";
import SourceCard from "./SourceCard";

interface ChatMessageProps {
  message: ChatMessageType;
}

/** One chat bubble: user on the right, assistant on the left with citations. */
export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`animate-fade-in flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] ${
          isUser
            ? "rounded-2xl rounded-br-md bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-white shadow-sm"
            : "w-full rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-navy-900"
        }`}
      >
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed ${
            isUser ? "text-white" : "text-slate-800 dark:text-slate-100"
          }`}
        >
          {message.content}
        </p>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Sources ({message.sources.length})
            </p>
            {message.sources.map((source, i) => (
              <SourceCard key={`${source.filename}-${source.page}-${i}`} source={source} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Bouncing-dot indicator while the assistant is thinking. */
export function ThinkingIndicator() {
  return (
    <div className="flex justify-start" role="status" aria-label="Assistant is thinking">
      <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-navy-900">
        <span className="flex gap-1" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Thinking…
        </span>
      </div>
    </div>
  );
}
