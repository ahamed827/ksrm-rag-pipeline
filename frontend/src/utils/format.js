/** Format a 0–1 rate as a percentage ("—" when missing). */
export function pct(value, digits = 0) {
  return value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

/** Tone for a 0–1 score: "good" | "mid" | "bad" | "". */
export function tone(value, good = 0.8, mid = 0.5) {
  if (value == null) return "";
  return value >= good ? "good" : value >= mid ? "mid" : "bad";
}

/** Tailwind text colour for a tone. */
export const TONE_TEXT = {
  good: "text-emerald-600 dark:text-emerald-400",
  mid: "text-amber-600 dark:text-amber-400",
  bad: "text-rose-600 dark:text-rose-400",
  "": "",
};

export function seconds(value, digits = 1) {
  return value == null ? "—" : `${value.toFixed(digits)}s`;
}

/** "https://ksrmce.ac.in/about/" -> "ksrmce.ac.in/about" */
export function shortUrl(url) {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** "https://ksrmce.ac.in/departments/cse/" -> "cse"; site root -> "home" */
export function pageLabel(url) {
  try {
    const path = new URL(url).pathname.replace(/\/$/, "");
    return path ? path.split("/").pop().replace(/-/g, " ") : "home";
  } catch {
    return url;
  }
}

/** Join class names, skipping falsy values. */
export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}
