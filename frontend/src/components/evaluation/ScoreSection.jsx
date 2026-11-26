import { cx, TONE_TEXT } from "../../utils/format.js";
import { Card } from "../ui.jsx";

/** A titled group of score cards for one evaluation level. */
export default function ScoreSection({ title, subtitle, scores, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {scores.map((s) => (
          <Card key={s.label} className="p-4" title={s.hint}>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</div>
            <div className={cx("my-0.5 text-2xl font-bold tabular-nums sm:text-3xl", TONE_TEXT[s.tone ?? ""])}>{s.value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{s.hint}</div>
          </Card>
        ))}
      </div>
      {children}
    </section>
  );
}
