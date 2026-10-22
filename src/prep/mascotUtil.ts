import { useEffect, useState } from "react";
import type { Mood } from "./Mascot";

// Counts a number up from 0 (shown at once for reduced motion).
export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(() => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? target : 0));
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// What the mascot says for a score: celebrate at 80%+, pass line 60%, encourage below.
export function scoreMood(pct: number, cleared = false): { mood: Mood; say: string; party: boolean } {
  if (cleared) return { mood: "cheer", say: "เคลียร์ครบทุกข้อ สุดยอด!", party: true };
  if (pct >= 80) return { mood: "cheer", say: "เยี่ยมมาก! ไฟลุกโชน 🔥", party: true };
  if (pct >= 60) return { mood: "happy", say: "ผ่านเกณฑ์ 60% แล้ว ไปต่อ!", party: false };
  return { mood: "think", say: "ยังไม่ถึงเกณฑ์ ลองทำข้อผิดซ้ำอีกรอบนะ", party: false };
}

