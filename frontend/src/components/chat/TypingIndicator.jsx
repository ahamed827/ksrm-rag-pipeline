const STAGE_LABELS = {
  retrieving: "Searching the KSRM website…",
  generating: "Writing the answer…",
};

export default function TypingIndicator({ stage }) {
  return (
    <div className="flex items-center gap-3 py-1 text-sm text-slate-500 dark:text-slate-400" role="status">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 200, 400].map((delay) => (
          <span
            key={delay}
            className="h-2 w-2 animate-blink rounded-full bg-slate-400 dark:bg-slate-500"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      {STAGE_LABELS[stage] ?? "Thinking…"}
    </div>
  );
}
