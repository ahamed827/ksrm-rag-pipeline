import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { api } from "../../api/client.js";
import { cx, pageLabel } from "../../utils/format.js";
import { Alert, Button, Card, PageContainer, PageTitle } from "../ui.jsx";
import Scatter3D from "./Scatter3D.jsx";

const PALETTE = [
  "#4f6bed", "#e0763b", "#2a9d8f", "#c2417a", "#8a63d2", "#d4a72c",
  "#3b8fd1", "#5e9e3a", "#d1495b", "#6c7a89", "#b5651d",
];

export default function KnowledgeMap({ onRebuilt }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [hover, setHover] = useState(null);

  async function load(q) {
    setLoading(true);
    setError(null);
    try {
      setData(await api.vectors(q));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function rebuild() {
    if (!confirm("Re-scrape ksrmce.ac.in and rebuild the index? This can take a minute.")) return;
    setRebuilding(true);
    setError(null);
    try {
      await api.rebuildIndex();
      await load(query.trim() || undefined);
      onRebuilt?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setRebuilding(false);
    }
  }

  const view = useMemo(() => {
    if (!data?.points?.length) return null;
    const pages = [...new Set(data.points.map((p) => p.source))];
    const titles = Object.fromEntries(data.points.map((p) => [p.source, p.title || pageLabel(p.source)]));
    const color = Object.fromEntries(pages.map((s, i) => [s, PALETTE[i % PALETTE.length]]));
    const retrieved = new Set((data.retrieved ?? []).map((r) => r.id));
    return { pages, titles, color, retrieved };
  }, [data]);

  return (
    <PageContainer>
      <PageTitle
        title="Knowledge Map"
        subtitle="Every indexed chunk in 3-D. The vector database stores and searches 384-dimensional embeddings; PCA reduces them to the 3 axes with the most spread so you can see them. Chunks about similar topics sit close together."
      >
        <Button onClick={rebuild} disabled={rebuilding}>
          <RefreshCw size={15} className={cx(rebuilding && "animate-spin")} />
          {rebuilding ? "Rebuilding…" : "Rebuild index"}
        </Button>
      </PageTitle>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(query.trim() || undefined);
        }}
      >
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a question to see where it lands…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <Button variant="primary" disabled={loading}>{loading ? "Plotting…" : "Plot"}</Button>
      </form>

      {error && <Alert tone="bad">{error}</Alert>}

      <Card className="p-4">
        {!view ? (
          <div className="py-16 text-center text-slate-500">{loading ? "Loading vectors…" : "No chunks indexed yet."}</div>
        ) : (
          <>
            <Scatter3D
              points={data.points}
              query={data.query}
              retrieved={view.retrieved}
              color={view.color}
              onHover={setHover}
            />
            {data.explained_variance && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                PC1/PC2/PC3 capture {data.explained_variance.map((v) => `${(v * 100).toFixed(1)}%`).join(" / ")} of the
                spread in the {data.dimensions}-D space ({(data.explained_variance.reduce((a, b) => a + b, 0) * 100).toFixed(0)}%
                in total), so distances here are only approximate. Retrieval uses all {data.dimensions} dimensions.
              </p>
            )}

            <div className="min-h-16 px-1 pt-3 text-sm">
              {hover ? (
                <>
                  <span className="font-semibold">{hover.id}</span>
                  <span className="text-slate-500"> · {view.titles[hover.source]}</span>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{hover.preview}…</p>
                </>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  {data.query
                    ? `The cross marks your question. Highlighted dots are the ${view.retrieved.size} chunks retrieval returns for it.`
                    : "Hover a dot to preview its chunk."}
                </p>
              )}
            </div>

            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
              {view.pages.map((s) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: view.color[s] }} />
                  {view.titles[s]}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </PageContainer>
  );
}
