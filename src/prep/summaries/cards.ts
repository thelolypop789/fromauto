import type { Block, Branch, MindMap } from "./types";

// Flashcards for "สรุปแบบแผนผัง", built from a map's own content so every map has a deck without writing cards by hand:
// each branch's recall question, then question-shaped blocks (look-alike pairs, table rows, ordered steps, petals,
// worked examples, guide questions). Memos, warnings and notes are not questions, so they are left out.
export type Card = { id: string; branch: string; q: string; a: string; sub?: string };

const join = (xs: string[]) => xs.filter(Boolean).join(" · ");

function fromBlock(b: Branch, x: Block, key: string): Card[] {
  const card = (n: number | string, q: string, a: string, sub?: string): Card => ({ id: `${key}-${n}`, branch: b.title, q, a, sub });
  switch (x.k) {
    case "pairs":
      return x.items.map((p, i) => card(i, p.a, p.b));
    case "words":
      return x.items.map((w, i) => card(i, w.w, w.m, w.ex));
    case "table": {
      // A row whose first cell is empty continues the row above (one heading spread over several rows).
      const rows: string[][] = [];
      for (const r of x.rows) {
        if (!r[0] && rows.length) rows[rows.length - 1] = rows[rows.length - 1].map((c, j) => (j && r[j] ? `${c} · ${r[j]}` : c));
        else rows.push([...r]);
      }
      const head = x.head[0] ? `${x.head[0]}: ` : "";
      return rows.map((r, i) => card(i, head + r[0], join(r.slice(1).map((c, j) => (x.head[j + 1] && r.length > 2 ? `${x.head[j + 1]} ${c}` : c)))));
    }
    case "steps":
      return x.items.length > 1 ? [card(0, `${b.title}: ครบ ${x.items.length} ข้อ มีอะไรบ้าง`, x.items.map((s, i) => `${i + 1}. ${s.t}`).join("\n"))] : [];
    case "flower":
      return [card(0, `${x.center}${x.sub ? ` ${x.sub}` : ""} มีอะไรบ้าง`, x.items.map(it => it.t).join(" · "))];
    case "example":
      return [card(0, x.q, `ตอบ ${x.a}`, x.steps.join(" → "))];
    case "past":
      return [card(0, `${x.q}\n${x.choices.map((c, i) => `${i + 1}. ${c}`).join("\n")}`, `ตอบ ${x.a + 1}. ${x.choices[x.a]}`, x.why)];
    case "formula":
      return x.d ? [card(0, `${b.title}: สูตร`, x.f, x.d)] : [];
    default:
      return [];
  }
}

export function mapCards(map: MindMap): Card[] {
  const out: Card[] = [];
  for (const b of map.branches) {
    if (b.big) out.push({ id: `${b.id}`, branch: b.title, q: b.ask ?? b.title, a: `${b.big}${b.unit ? ` ${b.unit}` : ""}`, sub: b.sub });
    b.blocks.forEach((x, i) => out.push(...fromBlock(b, x, `${b.id}-${i}`)));
  }
  return out;
}
