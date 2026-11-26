import { BarChart3, GraduationCap, MessageSquare, Network } from "lucide-react";
import { cx } from "../../utils/format.js";

export const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "map", label: "Knowledge Map", icon: Network },
  { id: "eval", label: "Evaluation", icon: BarChart3 },
];

const STATUS = {
  connecting: { label: "Connecting", dot: "bg-slate-400", ring: "" },
  online: { label: "Online", dot: "bg-emerald-500", ring: "animate-ping bg-emerald-400" },
  starting: { label: "Starting", dot: "bg-amber-500", ring: "animate-ping bg-amber-400" },
  offline: { label: "Offline", dot: "bg-rose-500", ring: "" },
};

function HealthPill({ status, health, error }) {
  const s = STATUS[status];
  const title =
    status === "offline" ? `Backend unreachable: ${error}`
    : status === "starting" ? (health?.index_ready ? "Loading models…" : "Index not built: run python -m scripts.build_index")
    : health ? `${health.chunks} chunks indexed · ${health.llm_model}`
    : "Checking backend…";

  return (
    <div
      title={title}
      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
    >
      <span className="relative flex h-2 w-2">
        {s.ring && <span className={cx("absolute inline-flex h-full w-full rounded-full opacity-60", s.ring)} />}
        <span className={cx("relative inline-flex h-2 w-2 rounded-full", s.dot)} />
      </span>
      <span className="hidden sm:inline">{s.label}</span>
    </div>
  );
}

export default function Header({ tab, onTabChange, healthState }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <GraduationCap size={20} />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold sm:text-base">KSRM College RAG Assistant</div>
            <div className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">Answers from ksrmce.ac.in</div>
          </div>
        </div>

        <nav className="ml-auto flex items-center gap-1" aria-label="Main">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-current={tab === id ? "page" : undefined}
              title={label}
              className={cx(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                tab === id
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-500"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              )}
            >
              <Icon size={17} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </nav>

        <HealthPill {...healthState} />
      </div>
    </header>
  );
}
