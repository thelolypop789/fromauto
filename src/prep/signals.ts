import type { ReadinessSignals } from "./api";

// Overall reading of the six signals: the mean of those that have enough data (null when none do).
export function signalsIndex(s: ReadinessSignals): { score: number | null; known: number } {
  const v = [s.accuracy, s.speed, s.errors, s.stamina, s.fix, s.coverage].map(x => x.score).filter((x): x is number => x != null);
  return { score: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null, known: v.length };
}

// Same four steps as the readiness score: under 50, 50–59, 60–79, 80+.
export const signalLevel = (p: number) => (p >= 80 ? 3 : p >= 60 ? 2 : p >= 50 ? 1 : 0);
export const SIGNAL_VERDICT = ["ควรปรับหลายด้าน", "เริ่มเข้าที่", "ฝึกได้ดี", "ฝึกได้ดีมาก"];
