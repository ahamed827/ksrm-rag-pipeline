import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cx, pct, seconds, tone, TONE_TEXT } from "../../utils/format.js";

const SCOPE_LABELS = {
  reranker: "Re-ranker",
  distance: "Too far",
  llm: "LLM check",
  llm_unavailable: "Skipped",
  small_talk: "Small talk",
};

function Metric({ label, value, toneName = "", hint }) {
  return (
    <div className="rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800" title={hint}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={cx("text-sm font-semibold tabular-nums", TONE_TEXT[toneName])}>{value}</div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Per-answer scores grouped by pipeline stage, collapsed by default to keep the chat clean. */
export default function AnswerMetrics({ metrics: m }) {
  const [open, setOpen] = useState(false);
  if (!m) return null;
  const hasRetrieval = m.best_distance != null;
  const hasJudge = m.faithfulness != null || m.relevancy != null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronDown size={14} className={cx("transition-transform", open && "rotate-180")} />
        Details
        {hasJudge && m.faithfulness != null && <span className="ml-1">· {m.faithfulness}% grounded</span>}
        {m.latency_ms != null && <span>· {seconds(m.latency_ms / 1000)}</span>}
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          {hasRetrieval && (
            <Group title="Retrieval">
              {m.rerank_score != null && (
                <Metric
                  label="Relevance"
                  value={pct(m.rerank_score, 1)}
                  toneName={tone(m.rerank_score, 0.5, m.accept_rerank ?? 0.01)}
                  hint="Cross-encoder relevance of the best chunk to your question. Low scores trigger an LLM scope check."
                />
              )}
              <Metric
                label="Similarity"
                value={m.similarity.toFixed(2)}
                hint="Cosine similarity of question and nearest chunk. Not a probability: 0.4–0.7 is typical for a good match."
              />
              <Metric
                label="Distance"
                value={m.best_distance.toFixed(2)}
                hint={`Squared L2 distance of the nearest chunk. Above ${m.block_distance} is blocked without further checks.`}
              />
            </Group>
          )}
          <Group title="Guardrail">
            <Metric label="Scope check" value={SCOPE_LABELS[m.scope_check] ?? m.scope_check ?? "—"}
              hint="Which signal decided whether the question is about KSRM." />
          </Group>
          {hasJudge && (
            <Group title="Answer">
              {m.faithfulness != null && (
                <Metric label="Groundedness" value={`${m.faithfulness}%`} toneName={tone(m.faithfulness / 100)}
                  hint="LLM judge: is every claim supported by the retrieved pages?" />
              )}
              {m.relevancy != null && (
                <Metric label="Relevancy" value={`${m.relevancy}%`} toneName={tone(m.relevancy / 100)}
                  hint="LLM judge: does the answer address the question?" />
              )}
            </Group>
          )}
          {m.latency_ms != null && (
            <Group title="System">
              <Metric label="Latency" value={seconds(m.latency_ms / 1000)} hint="Time to the complete answer (judge excluded)." />
            </Group>
          )}
        </div>
      )}
    </div>
  );
}
