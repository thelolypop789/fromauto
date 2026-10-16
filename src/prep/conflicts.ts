// Finds pairs of approved questions that ask the same thing but are keyed to different answers.
// Pure function so it can run in the browser (and be tested with node) without loading the database.
export type LiteQ = [id: number, topic: string, origin: string, stem: string, choices: string[], answer: number];
export type Conflict = { a: LiteQ; b: LiteQ; sim: number };

const norm = (s: string) => s.replace(/[\s\p{P}\p{S}ๆ]/gu, "");
const toks = (s: string) => (s.match(/[0-9]+|[A-Za-z]+/g) ?? []).join(" ");
function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1); }
  return m;
}
function dice(a: Map<string, number>, an: number, b: Map<string, number>, bn: number): number {
  if (an + bn === 0) return 1;
  let inter = 0;
  for (const [g, c] of a) { const d = b.get(g); if (d) inter += Math.min(c, d); }
  return (2 * inter) / (an + bn);
}

export function findConflicts(bank: LiteQ[], ok: Set<string>, minSim = 0.8): Conflict[] {
  type P = { q: LiteQ; ans: string; choices: Set<string>; n: string; t: string; bg: Map<string, number>; bn: number };
  const byTopic = new Map<string, P[]>();
  for (const q of bank) {
    const ans = (q[4][q[5]] ?? "").trim();
    const n = norm(q[3]);
    const p: P = { q, ans, choices: new Set(q[4].map(c => c.trim())), n, t: toks(q[3]), bg: bigrams(n), bn: Math.max(0, n.length - 1) };
    const list = byTopic.get(q[1]) ?? [];
    list.push(p); byTopic.set(q[1], list);
  }
  const out: Conflict[] = [];
  for (const list of byTopic.values()) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (a.q[2] === "template" && b.q[2] === "template") continue;
        if (a.ans === b.ans || !b.choices.has(a.ans) || !a.choices.has(b.ans)) continue;
        if (a.t !== b.t) continue;
        if (Math.abs(a.n.length - b.n.length) > Math.max(12, a.n.length * 0.35)) continue;
        const key = a.q[0] < b.q[0] ? `${a.q[0]}-${b.q[0]}` : `${b.q[0]}-${a.q[0]}`;
        if (ok.has(key)) continue;
        const sim = dice(a.bg, a.bn, b.bg, b.bn);
        if (sim >= minSim) out.push({ a: a.q, b: b.q, sim });
      }
    }
  }
  return out.sort((x, y) => y.sim - x.sim);
}
