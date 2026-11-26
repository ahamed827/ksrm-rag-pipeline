import { Fragment, useMemo, useState } from "react";
import { cx, pct } from "../../utils/format.js";
import { Card, Tag } from "../ui.jsx";

const CORRECTNESS_PASS = 0.7;
const CATEGORY_DOT = {
  in_scope: "bg-brand-500",
  small_talk: "bg-emerald-500",
  out_of_scope: "bg-amber-500",
  attack: "bg-rose-500",
};

/** Why a case counts as a failure (empty list = passed). */
function problems(c) {
  const out = [];
  if (!c.guardrail_correct) {
    out.push(c.should_block ? "Leaked" : c.category === "small_talk" && !c.did_block ? "No small-talk reply" : "Wrongly blocked");
  }
  if (c.status === "error") out.push("Error");
  if (c.retrieval && !c.retrieval.hit) out.push("Retrieval miss");
  if (c.generation && c.generation.correctness < CORRECTNESS_PASS) out.push("Incorrect");
  return out;
}

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "failures", label: "Failures", test: (c) => c.problems.length > 0 },
  { id: "in_scope", label: "In-scope", test: (c) => c.category === "in_scope" },
  { id: "small_talk", label: "Small talk", test: (c) => c.category === "small_talk" },
  { id: "out_of_scope", label: "Off-topic", test: (c) => c.category === "out_of_scope" },
  { id: "attack", label: "Attacks", test: (c) => c.category === "attack" },
];

const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const TD = "whitespace-nowrap px-3 py-2.5";

export default function CaseTable({ cases }) {
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const rows = useMemo(() => cases.map((c) => ({ ...c, problems: problems(c) })), [cases]);
  const visible = rows.filter(FILTERS.find((f) => f.id === filter).test);

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold">Per-question results</h2>
        <div className="flex flex-wrap gap-0.5 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cx(
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                filter === f.id
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {f.label}
              <span className="ml-1 opacity-60">{rows.filter(f.test).length}</span>
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className={TH}>Question</th>
              <th className={TH}>Result</th>
              <th className={TH}>First hit</th>
              <th className={TH}>P@k</th>
              <th className={TH}>Faithful</th>
              <th className={TH}>Correct</th>
              <th className={TH}>Relevance</th>
              <th className={TH}>Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">Nothing here 🎉</td>
              </tr>
            )}
            {visible.map((c) => {
              const rank = c.retrieval?.relevant_flags?.indexOf(true);
              return (
                <Fragment key={c.id}>
                  <tr
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  >
                    <td className="min-w-64 px-3 py-2.5">
                      <span className={cx("mr-2 inline-block h-2 w-2 rounded-full align-middle", CATEGORY_DOT[c.category])} />
                      {c.question}
                    </td>
                    <td className={TD}>
                      {c.problems.length === 0
                        ? <Tag tone="good">{c.did_block ? "Blocked" : "Pass"}</Tag>
                        : c.problems.map((p) => <Tag key={p} tone="bad">{p}</Tag>)}
                    </td>
                    <td className={TD}>{c.retrieval ? (rank >= 0 ? `#${rank + 1}` : "miss") : "—"}</td>
                    <td className={TD}>{c.retrieval ? pct(c.retrieval.precision_at_k) : "—"}</td>
                    <td className={TD}>{pct(c.generation?.faithfulness)}</td>
                    <td className={TD}>{pct(c.generation?.correctness)}</td>
                    <td className={TD}>{c.rerank_score == null ? "—" : pct(c.rerank_score, 1)}</td>
                    <td className={TD}>{c.latency_s}s</td>
                  </tr>
                  {expanded === c.id && (
                    <tr className="bg-slate-50 dark:bg-slate-800/40">
                      <td colSpan={8} className="px-3 py-3 text-sm">
                        <div className="max-w-4xl space-y-1.5">
                          <div><span className="text-slate-500">Expected:</span> {c.expected_answer}</div>
                          <div className="whitespace-pre-wrap"><span className="text-slate-500">Got:</span> {c.answer}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
