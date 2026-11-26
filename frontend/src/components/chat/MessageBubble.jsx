import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, Check, Copy, ShieldAlert, Sparkles } from "lucide-react";
import { cx } from "../../utils/format.js";
import AnswerMetrics from "./AnswerMetrics.jsx";
import SourcePills from "./SourcePills.jsx";
import TypingIndicator from "./TypingIndicator.jsx";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (e.g. insecure context); nothing useful to show */
    }
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      aria-label={copied ? "Copied" : "Copy answer"}
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function StatusNote({ status }) {
  if (status === "blocked") {
    return (
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <ShieldAlert size={14} /> Outside what I can answer
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
        <AlertTriangle size={14} /> Something went wrong
      </div>
    );
  }
  return null;
}

export default function MessageBubble({ message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[15px] text-white">
          {message.text}
        </div>
      </div>
    );
  }

  const { text, status, stage, sources, metrics } = message;
  const streaming = status === "streaming";
  const waiting = streaming && !text;

  return (
    <div className="flex gap-3">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-500">
        <Sparkles size={16} />
      </div>
      <div
        className={cx(
          "min-w-0 flex-1 rounded-2xl rounded-tl-md border bg-white px-4 py-3 shadow-sm dark:bg-slate-900",
          status === "blocked" ? "border-amber-300 dark:border-amber-800"
            : status === "error" ? "border-rose-300 dark:border-rose-900"
            : "border-slate-200 dark:border-slate-800"
        )}
      >
        <StatusNote status={status} />
        {waiting ? (
          <TypingIndicator stage={stage} />
        ) : (
          <div className="markdown">
            <ReactMarkdown>{text}</ReactMarkdown>
            {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-slate-400 align-middle" />}
          </div>
        )}
        {status === "stopped" && <div className="mt-2 text-xs italic text-slate-400">Stopped</div>}

        {!streaming && <SourcePills sources={sources} />}

        {!streaming && text && status !== "error" && (
          <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
            <AnswerMetrics metrics={metrics} />
            <CopyButton text={text} />
          </div>
        )}
      </div>
    </div>
  );
}
