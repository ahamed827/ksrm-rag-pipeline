import { cx } from "../../utils/format.js";
import { Card, ProgressBar } from "../ui.jsx";

const CATEGORY_LABELS = { in_scope: "In-scope", small_talk: "Small talk", out_of_scope: "Off-topic", attack: "Attacks" };

function Cell({ count, label, kind }) {
  const styles = {
    ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    bad: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    zero: "bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400",
  };
  return (
    <td className={cx("rounded-lg p-3 text-center", styles[kind])}>
      <div className="text-2xl font-bold tabular-nums">{count}</div>
      <div className="text-xs opacity-80">{label}</div>
    </td>
  );
}

/** 2x2 guardrail confusion matrix (positive class = "should be blocked") plus per-category accuracy. */
export default function ConfusionMatrix({ confusion: cm, byCategory }) {
  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-5">
      <Card className="overflow-x-auto p-2 lg:col-span-3">
        <table className="w-full border-separate border-spacing-1.5 text-sm" aria-label="Guardrail confusion matrix">
          <thead>
            <tr className="text-xs text-slate-500 dark:text-slate-400">
              <th />
              <th className="font-semibold">System answered</th>
              <th className="font-semibold">System blocked</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="pr-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Should answer</th>
              <Cell count={cm.tn} label="correctly answered" kind="ok" />
              <Cell count={cm.fp} label="wrongly refused" kind={cm.fp ? "bad" : "zero"} />
            </tr>
            <tr>
              <th scope="row" className="pr-2 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Should block</th>
              <Cell count={cm.fn} label="leaked through" kind={cm.fn ? "bad" : "zero"} />
              <Cell count={cm.tp} label="correctly blocked" kind="ok" />
            </tr>
          </tbody>
        </table>
      </Card>
      <Card className="flex flex-col justify-center gap-3.5 p-4 lg:col-span-2">
        {Object.entries(byCategory).map(([cat, { n, correct }]) => (
          <div key={cat}>
            <div className="mb-1 flex justify-between text-sm font-medium">
              <span>{CATEGORY_LABELS[cat] ?? cat}</span>
              <span className="text-slate-500 dark:text-slate-400">{correct}/{n}</span>
            </div>
            <ProgressBar value={correct / n} tone={correct === n ? "good" : "bad"} />
          </div>
        ))}
      </Card>
    </div>
  );
}
