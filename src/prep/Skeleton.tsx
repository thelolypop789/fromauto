// Placeholder blocks shown while a screen loads, shaped like what is coming (cards with a title and lines), so the
// page does not jump when the data arrives. `kind` picks the rough shape.
export default function Skeleton({ kind = "cards", n = 3 }: { kind?: "cards" | "list" | "grid" | "question"; n?: number }) {
  const items = Array.from({ length: n });
  return (
    <div className={`pp-skel pp-skel-${kind}`} role="status" aria-label="กำลังโหลด">
      {kind === "question" ? (
        <div className="pp-card"><i className="t" /><i /><i className="s" />{[0, 1, 2, 3].map(k => <i key={k} className="c" />)}</div>
      ) : items.map((_, k) => (
        <div key={k} className="pp-card"><i className="t" /><i /><i className="s" /></div>
      ))}
    </div>
  );
}
