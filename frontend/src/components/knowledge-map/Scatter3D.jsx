import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cx } from "../../utils/format.js";

const W = 720;
const H = 480;
const SCALE = 165; // px per unit of the normalised unit sphere
const CAMERA = 4; // perspective distance; smaller = stronger perspective
const START = { yaw: -0.6, pitch: 0.35 };
const AUTO_SPEED = 0.004; // radians per frame

const AXES = [
  { label: "PC1", end: [1.1, 0, 0] },
  { label: "PC2", end: [0, 1.1, 0] },
  { label: "PC3", end: [0, 0, 1.1] },
];

/** Rotate (yaw around Y, then pitch around X) and apply perspective. Returns screen x/y, depth and size factor. */
function project([x, y, z], { yaw, pitch }) {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
  const f = CAMERA / (CAMERA + z2);
  return { sx: W / 2 + x1 * f * SCALE, sy: H / 2 - y2 * f * SCALE, depth: z2, f };
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Interactive 3-D scatter of PCA-projected chunk embeddings (plain SVG, no 3-D library).
 * points: [{id, x, y, z, source}], query: {x, y, z} | null, retrieved: Set of ids, color: {source: hex}
 */
export default function Scatter3D({ points, query, retrieved, color, onHover }) {
  const [view, setView] = useState(START);
  const [autoRotate, setAutoRotate] = useState(() => !prefersReducedMotion());
  const [hoverId, setHoverId] = useState(null);
  const drag = useRef(null);

  // Centre on the data and scale into the unit sphere, so the cloud fits the frame at every rotation angle.
  const normalised = useMemo(() => {
    const all = query ? [...points, query] : points;
    const mean = ["x", "y", "z"].map((k) => all.reduce((s, p) => s + p[k], 0) / all.length);
    const radius = Math.max(...all.map((p) => Math.hypot(p.x - mean[0], p.y - mean[1], p.z - mean[2]))) || 1;
    const norm = (p) => ["x", "y", "z"].map((k, i) => (p[k] - mean[i]) / radius);
    return { points: points.map((p) => ({ ...p, v: norm(p) })), query: query ? norm(query) : null };
  }, [points, query]);

  // Auto-rotation; pauses while dragging or hovering a point so it can be read.
  useEffect(() => {
    if (!autoRotate || hoverId) return undefined;
    let frame;
    const tick = () => {
      if (!drag.current) setView((v) => ({ ...v, yaw: v.yaw + AUTO_SPEED }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [autoRotate, hoverId]);

  function onPointerDown(e) {
    drag.current = { x: e.clientX, y: e.clientY, view };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag.current) return;
    const { x, y, view: v0 } = drag.current;
    setView({
      yaw: v0.yaw + (e.clientX - x) * 0.01,
      pitch: Math.max(-1.45, Math.min(1.45, v0.pitch + (e.clientY - y) * 0.01)),
    });
  }
  function onPointerUp() {
    drag.current = null;
  }

  function hover(p) {
    setHoverId(p?.id ?? null);
    onHover?.(p);
  }

  const projected = normalised.points
    .map((p) => ({ ...p, ...project(p.v, view) }))
    .sort((a, b) => b.depth - a.depth); // far first, so near points draw on top
  const q = normalised.query ? project(normalised.query, view) : null;
  const origin = project([0, 0, 0], view);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full cursor-grab touch-none select-none rounded-lg bg-slate-50 active:cursor-grabbing dark:bg-slate-950"
        role="img"
        aria-label="3-D projection of chunk embeddings. Drag to rotate."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {AXES.map(({ label, end }) => {
          const e = project(end, view);
          return (
            <g key={label}>
              <line x1={origin.sx} y1={origin.sy} x2={e.sx} y2={e.sy} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.2" />
              <text x={e.sx} y={e.sy} dx="4" dy="4" className="fill-slate-500 text-[12px] font-semibold dark:fill-slate-400">{label}</text>
            </g>
          );
        })}

        {q &&
          projected
            .filter((p) => retrieved.has(p.id))
            .map((p) => (
              <line key={`l-${p.id}`} x1={q.sx} y1={q.sy} x2={p.sx} y2={p.sy} className="stroke-slate-500/60" strokeDasharray="4 4" />
            ))}

        {projected.map((p) => {
          const hit = retrieved.has(p.id);
          const dim = query && !hit;
          return (
            <circle
              key={p.id}
              cx={p.sx}
              cy={p.sy}
              r={(hit ? 7.5 : 5.5) * p.f}
              fill={color[p.source]}
              fillOpacity={dim ? 0.25 : 0.55 + 0.45 * Math.min(1, p.f)}
              strokeWidth={hit || hoverId === p.id ? 2 : 1}
              className={cx(
                "cursor-pointer",
                hit || hoverId === p.id ? "stroke-slate-900 dark:stroke-white" : "stroke-white/80 dark:stroke-slate-900/80"
              )}
              onPointerEnter={() => !drag.current && hover(p)}
              onPointerLeave={() => hover(null)}
            />
          );
        })}

        {q && (
          <g transform={`translate(${q.sx},${q.sy})`}>
            <circle r={11 * q.f} className="fill-brand-600 stroke-white dark:stroke-slate-950" strokeWidth="2" />
            <path d="M-5 0h10M0 -5v10" className="stroke-white" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}
      </svg>

      <div className="absolute right-2 top-2 flex gap-1">
        <button
          onClick={() => setAutoRotate((a) => !a)}
          title={autoRotate ? "Pause rotation" : "Auto-rotate"}
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white/90 text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300"
        >
          {autoRotate ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button
          onClick={() => setView(START)}
          title="Reset view"
          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white/90 text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300"
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 text-xs text-slate-400">Drag to rotate</div>
    </div>
  );
}
