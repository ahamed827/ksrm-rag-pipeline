/** Small shared UI primitives used by the Knowledge Map and Evaluation tabs. */
import { cx } from "../utils/format.js";

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cx("rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}
      {...props}
    >
      {children}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 border-brand-600",
  secondary:
    "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800",
};

export function Button({ variant = "secondary", className, children, ...props }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const ALERT_TONES = {
  warn: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  bad: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
};

export function Alert({ tone = "warn", children }) {
  return <div className={cx("mb-4 rounded-lg border px-4 py-2.5 text-sm", ALERT_TONES[tone])}>{children}</div>;
}

const TAG_TONES = {
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  bad: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function Tag({ tone = "neutral", children }) {
  return (
    <span className={cx("mr-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold", TAG_TONES[tone])}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, tone = "brand" }) {
  const fill = { brand: "bg-brand-600", good: "bg-emerald-500", bad: "bg-rose-500" }[tone];
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={cx("h-full rounded-full transition-all duration-300", fill)} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function PageContainer({ children }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
