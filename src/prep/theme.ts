// Light / dark theme. "system" follows the device (prefers-color-scheme in prep.css); "light" / "dark" pin it with
// html[data-theme]. prep.html applies the saved choice before the first paint so the page never flashes.
export type Theme = "system" | "light" | "dark";
const KEY = "pp-theme";

export function getTheme(): Theme {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; }
}

export function setTheme(t: Theme) {
  try { if (t === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* applies for this visit only */ }
  if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
}
