// Text size for questions, choices and explanations (A− / A+ on the exam screens). One CSS variable,
// --pp-read-scale, scales them all; the choice is kept on this device.
export const READ_STEPS = [0.9, 1, 1.12, 1.25, 1.4];
const KEY = "pp-read-scale";

export function readScale(): number {
  try { const v = Number(localStorage.getItem(KEY)); return READ_STEPS.includes(v) ? v : 1; } catch { return 1; }
}

export function applyReadScale(v = readScale()) {
  document.documentElement.style.setProperty("--pp-read-scale", String(v));
}

export function setReadScale(v: number) {
  try { localStorage.setItem(KEY, String(v)); } catch { /* private mode: applies for this visit only */ }
  applyReadScale(v);
}
