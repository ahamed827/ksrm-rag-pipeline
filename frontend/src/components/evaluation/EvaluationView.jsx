import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/client.js";
import { Play } from "lucide-react";
import { pct, seconds, tone } from "../../utils/format.js";
import { Alert, Button, Card, PageContainer, PageTitle, ProgressBar } from "../ui.jsx";
import ScoreSection from "./ScoreSection.jsx";
import ConfusionMatrix from "./ConfusionMatrix.jsx";
import CaseTable from "./CaseTable.jsx";

const POLL_MS = 2000;

export default function EvaluationView() {
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const poll = useCallback(async () => {
    try {
      const state = await api.evaluationStatus();
      setJob(state);
      clearTimeout(timer.current);
      if (state.running) timer.current = setTimeout(poll, POLL_MS);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    poll();
    return () => clearTimeout(timer.current);
  }, [poll]);

  async function start() {
    setError(null);
    try {
      setJob(await api.startEvaluation());
      timer.current = setTimeout(poll, POLL_MS);
    } catch (e) {
      setError(e.message);
    }
  }

  const running = job?.running;
  const report = job?.report;

  return (
    <PageContainer>
      <PageTitle
        title="Evaluation"
        subtitle="Runs the golden set (in-scope, small-talk, off-topic and attack questions) through the full pipeline and scores it at four levels. An LLM judge grades generated answers."
      >
        <Button variant="primary" onClick={start} disabled={running || !job}>
          <Play size={15} />
          {running ? "Running…" : report ? "Run again" : "Run evaluation"}
        </Button>
      </PageTitle>

      {(error || job?.error) && <Alert tone="bad">{error || job.error}</Alert>}

      {running && (
        <Card className="mb-6 p-4">
          <div className="mb-2 flex justify-between text-sm font-semibold">
            <span>Evaluating {job.total ? `${Math.min(job.done + 1, job.total)} of ${job.total}` : "…"}</span>
            <span className="text-slate-500">{job.total ? pct(job.done / job.total) : ""}</span>
          </div>
          <ProgressBar value={job.total ? job.done / job.total : 0} />
          <p className="mt-2 truncate text-sm text-slate-500">{job.current}</p>
        </Card>
      )}

      {!report && !running && job && (
        <Card className="py-12 text-center text-slate-500">No results yet. Run an evaluation to see the scorecard.</Card>
      )}

      {report && <Report report={report} />}
    </PageContainer>
  );
}

function Report({ report }) {
  const { retrieval: r, generation: g, guardrails: gr, system: sy } = report.summary;
  const cfg = report.config;

  return (
    <>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Last run {new Date(report.run_at).toLocaleString()} · {report.cases.length} questions · {cfg.llm_model} ·{" "}
        {cfg.use_reranker ? "re-ranker on" : "re-ranker off"} · top-{cfg.top_k}
      </p>

      <ScoreSection
        title="1 · Retrieval"
        subtitle={`Did vector search find the right chunks? (${r.n} in-scope questions, k = ${r.k})`}
        scores={[
          { label: "Hit rate", value: pct(r.hit_rate), tone: tone(r.hit_rate, 0.9, 0.7), hint: "At least one relevant chunk in the top k" },
          { label: "MRR", value: r.mrr == null ? "—" : r.mrr.toFixed(3), tone: tone(r.mrr, 0.8, 0.5), hint: "1 / rank of the first relevant chunk, averaged" },
          { label: `Precision@${r.k}`, value: pct(r.precision_at_k), hint: "Share of retrieved chunks that are relevant" },
          { label: `Recall@${r.k}`, value: pct(r.recall_at_k), hint: "Share of all relevant chunks that were retrieved" },
        ]}
      />

      <ScoreSection
        title="2 · Generation"
        subtitle={`Is the answer good? (${g.n} answered in-scope questions, LLM-judged)`}
        scores={[
          { label: "Faithfulness", value: pct(g.faithfulness), tone: tone(g.faithfulness, 0.9, 0.7), hint: "Claims supported by the context" },
          { label: "Relevancy", value: pct(g.relevancy), tone: tone(g.relevancy, 0.9, 0.7), hint: "Answer addresses the question" },
          { label: "Correctness", value: pct(g.correctness), tone: tone(g.correctness, 0.9, 0.7), hint: "Matches the expected answer" },
        ]}
      />

      <ScoreSection
        title="3 · Guardrails"
        subtitle={`Are KSRM questions and small talk answered, and off-topic/attacks blocked? (${gr.n} questions, positive = should block)`}
        scores={[
          { label: "Accuracy", value: pct(gr.accuracy), tone: tone(gr.accuracy, 0.95, 0.8), hint: "All correct decisions / all questions" },
          { label: "Precision", value: pct(gr.precision), tone: tone(gr.precision, 0.95, 0.8), hint: "Of everything blocked, how much deserved it" },
          { label: "Recall", value: pct(gr.recall), tone: tone(gr.recall, 0.95, 0.8), hint: "Of everything that deserved blocking, how much was" },
          { label: "F1", value: pct(gr.f1), tone: tone(gr.f1, 0.95, 0.8), hint: "Balance of precision and recall" },
        ]}
      >
        <ConfusionMatrix confusion={gr.confusion} byCategory={gr.by_category} />
      </ScoreSection>

      <ScoreSection
        title="4 · System"
        subtitle="Speed and reliability of the pipeline (excludes judge calls)"
        scores={[
          { label: "Avg latency", value: seconds(sy.avg_latency_s, 2), hint: "Mean end-to-end time per question" },
          { label: "p95 latency", value: seconds(sy.p95_latency_s, 2), hint: "95% of questions are faster than this" },
          { label: "Errors", value: String(sy.errors), tone: sy.errors ? "bad" : "good", hint: "LLM/API failures during the run" },
          ...(sy.llm_scope_checks != null
            ? [{ label: "LLM scope checks", value: `${sy.llm_scope_checks}/${report.cases.length}`, hint: "Ambiguous questions that needed the extra LLM call" }]
            : []),
        ]}
      />

      {sy.label_issues?.length > 0 && (
        <Alert>
          Golden-set evidence matched no chunk for: {sy.label_issues.join(", ")}. Update eval/golden_set.json.
        </Alert>
      )}

      <CaseTable cases={report.cases} />
    </>
  );
}
