import { useEffect, useRef } from "react";

// A short burst of paper confetti in the brand colours. Draws once, removes itself, and does nothing for reduced motion.
const COLORS = ["#8E1B2E", "#C9A227", "#F3D98A", "#F7762B", "#FF5A3C", "#2E7D32"];

export default function Confetti({ pieces = 90, ms = 1800 }: { pieces?: number; ms?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const c = ref.current; const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
    const ps = Array.from({ length: pieces }, () => ({
      x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 9, vy: -Math.random() * 11 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));
    const t0 = performance.now(); let raf = 0;
    const tick = (t: number) => {
      const k = (t - t0) / ms;
      ctx.clearRect(0, 0, W, H);
      if (k >= 1) return;
      ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
      for (const p of ps) {
        p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pieces, ms]);
  return <canvas ref={ref} className="pp-confetti" aria-hidden="true" />;
}
