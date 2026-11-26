import { useEffect, useRef, useState } from "react";
import { RotateCcw, SendHorizontal, Square } from "lucide-react";
import MessageBubble from "./MessageBubble.jsx";
import WelcomeScreen from "./WelcomeScreen.jsx";

const MAX_LENGTH = 1000;

export default function ChatView({ messages, streaming, send, stop, clear }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // Keep the newest content in view while tokens stream in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-grow the textarea up to ~6 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function submit(text = input) {
    if (!text.trim() || streaming) return;
    send(text);
    setInput("");
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {messages.length === 0 ? (
            <WelcomeScreen onPick={submit} />
          ) : (
            <div className="space-y-5">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto max-w-3xl px-4 pb-4 pt-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-brand-500 dark:border-slate-700 dark:bg-slate-900"
          >
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              maxLength={MAX_LENGTH}
              placeholder="Ask a question about KSRM…"
              aria-label="Your question"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-slate-400"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop generating"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Send"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SendHorizontal size={18} />
              </button>
            )}
          </form>
          <div className="mt-2 flex min-h-5 items-center justify-between text-xs text-slate-400">
            <span className="hidden sm:inline">
              Answers come from ksrmce.ac.in and may be incomplete. Verify important details with the college.
            </span>
            <span className="sm:hidden">Answers come from ksrmce.ac.in.</span>
            {messages.length > 0 && (
              <button
                onClick={clear}
                className="ml-3 flex shrink-0 items-center gap-1 font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <RotateCcw size={13} /> New chat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
