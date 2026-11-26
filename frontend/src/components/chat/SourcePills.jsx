import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { cx, pct, shortUrl } from "../../utils/format.js";

/** One pill per cited page; clicking a pill expands its URL, relevance and the quoted passages. */
export default function SourcePills({ sources }) {
  const [openUrl, setOpenUrl] = useState(null);
  if (!sources?.length) return null;
  const open = sources.find((s) => s.url === openUrl);

  return (
    <div className="mt-3">
      <div className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Sources</div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <button
            key={s.url}
            onClick={() => setOpenUrl(openUrl === s.url ? null : s.url)}
            aria-expanded={openUrl === s.url}
            className={cx(
              "flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
              openUrl === s.url
                ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-500"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600"
            )}
          >
            <FileText size={13} className="shrink-0" />
            <span className="truncate">{s.title}</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href={open.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-500"
            >
              <span className="truncate">{shortUrl(open.url)}</span>
              <ExternalLink size={13} className="shrink-0" />
            </a>
            <span className="text-xs text-slate-500 dark:text-slate-400">relevance {pct(open.score, 1)}</span>
          </div>
          {open.snippets.map((snippet, i) => (
            <p key={i} className="mt-2 border-l-2 border-slate-300 pl-3 text-slate-600 dark:border-slate-600 dark:text-slate-300">
              {snippet}…
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
