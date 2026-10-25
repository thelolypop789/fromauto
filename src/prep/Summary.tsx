import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { rpc, thaiError, track } from "./api";
import type { Preset } from "./CreateSet";
import { IconCrown } from "./icons";
import Mascot from "./Mascot";
import { MAPS } from "./summaries";
import { GROUPS, type Block, type Branch, type MindMap } from "./summaries/types";
import "./summary.css";

// "สรุปแบบแผนผัง": list of maps → one map (mascot hub + branches) → one branch's detail. Recall mode hides the value to
// remember on each branch: tap once to reveal, tap again to mark it remembered. Users see only maps an admin approved;
// without a ภาค ก package only the sample maps (one per group, `free`) open, the rest show a crown and the upgrade card.
const SLOTS: Record<number, string[]> = {
  4: ["tl", "tr", "bl", "br"],
  5: ["tl", "tr", "ml", "mr", "bc"],
  6: ["tl", "tr", "ml", "mr", "bl", "br"],
};
const TONE: Record<string, string> = { pink: "#E8577A", mint: "#22A06B", sky: "#2F80ED", lem: "#C98A00", lil: "#7B5BD6", pea: "#E07A1F" };

export default function Summary({ isAdmin, full, onPractice, onUpgrade }: {
  isAdmin: boolean; full: boolean; onPractice: (p: Preset) => void; onUpgrade: () => void;
}) {
  const [approved, setApproved] = useState<Set<string> | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [locked, setLocked] = useState<MindMap | null>(null);
  const canOpen = (m: MindMap) => full || isAdmin || !!m.free;
  useEffect(() => {
    rpc<string[]>("prep_summary_approved").then(ids => setApproved(new Set(ids))).catch(e => setError(thaiError(e)));
  }, []);
  const open = (id: string | null) => { setOpenId(id); window.scrollTo(0, 0); if (id) track("summary_view"); };
  if (error) return <div className="pp-card"><div className="pp-error">{error}</div></div>;
  if (!approved) return <div className="pp-spinner" />;

  const map = MAPS.find(m => m.id === openId && canOpen(m));
  if (map) {
    const setOk = async (ok: boolean) => {
      try {
        await rpc("prep_admin_summary_set", { p_id: map.id, p_ok: ok });
        setApproved(prev => { const s = new Set(prev); if (ok) s.add(map.id); else s.delete(map.id); return s; });
      } catch (e) { alert(thaiError(e)); }
    };
    return <MapView key={map.id} map={map} isAdmin={isAdmin} ok={approved.has(map.id)} onSetOk={setOk}
      onBack={() => open(null)} onPractice={() => onPractice({ topics: map.topics })} />;
  }

  const visible = MAPS.filter(m => isAdmin || approved.has(m.id));
  return (
    <div className="mm">
      <div className="mm-intro">
        <Mascot mood="happy" costume="teacher" size={84} motion="idle" />
        <div><h2>สรุปแบบแผนผัง · ภาค ก</h2><p>อ่านภาพเดียวจบหมวด แล้วลองโหมดท่องจำ จำได้แล้วค่อยไปฝึกข้อสอบ</p></div>
      </div>
      {isAdmin && <p className="pp-note small">แอดมินเห็นทุกแผนผัง ผู้ใช้เห็นเฉพาะแผนผังที่กด "ตรวจแล้ว" ({approved.size}/{MAPS.length}) · ผู้ใช้ฟรีเปิดได้เฉพาะป้าย "ฟรี"</p>}
      {!full && !isAdmin && visible.length > 0 && (
        <div className={`mm-upsell ${locked ? "on" : ""}`}>
          <span className="cr"><IconCrown size={20} /></span>
          <div>
            <b>{locked ? `"${locked.title}" สำหรับผู้ซื้อแพ็ก` : "ลองฟรีได้วิชาละ 1 หมวด"}</b>
            <p>ปลดล็อกแผนผังสรุปภาค ก ครบทุกหมวด ด้วยแพ็กภาค ก หรือแพ็กครบทุกภาค</p>
          </div>
          <button className="pp-btn pp-btn-primary sm" onClick={onUpgrade}>ดูแพ็ก</button>
        </div>
      )}
      {!visible.length && <div className="pp-card pp-empty">กำลังเตรียมสรุปให้อยู่ เร็ว ๆ นี้</div>}
      {GROUPS.map(g => {
        const ms = visible.filter(m => m.group === g.key);
        if (!ms.length) return null;
        return (
          <section key={g.key} className="mm-group">
            <h3>{g.title}<small>{g.sub}</small></h3>
            <div className="mm-list">
              {ms.map((m, i) => (
                <button key={m.id} className={`mm-item t-${m.branches[i % m.branches.length].tone} ${canOpen(m) ? "" : "locked"}`}
                  onClick={() => { if (canOpen(m)) open(m.id); else { setLocked(m); window.scrollTo({ top: 0, behavior: "smooth" }); } }}>
                  <span className="ic">{m.icon}</span>
                  {!full && (m.free ? <span className="tag free">ฟรี</span> : <span className="tag crown"><IconCrown size={12} />ผู้ซื้อ</span>)}
                  <b>{m.title}</b>
                  <small>{m.branches.length} กิ่ง{isAdmin && !approved.has(m.id) ? " · ร่าง" : ""}</small>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MapView({ map, isAdmin, ok, onSetOk, onBack, onPractice }: {
  map: MindMap; isAdmin: boolean; ok: boolean; onSetOk: (ok: boolean) => void; onBack: () => void; onPractice: () => void;
}) {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [recall, setRecall] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [got, setGot] = useState<Set<string>>(new Set());
  const branch = map.branches.find(b => b.id === branchId);
  const quiz = map.branches.filter(b => b.big);

  const tap = (b: Branch) => {
    if (!recall) { setBranchId(b.id); window.scrollTo(0, 0); return; }
    if (!b.big) return;
    if (!seen.has(b.id)) { setSeen(s => new Set(s).add(b.id)); return; }
    setGot(g => { const n = new Set(g); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; });
  };
  const restart = () => { setSeen(new Set()); setGot(new Set()); };

  if (branch) return <BranchView map={map} b={branch} onBack={() => setBranchId(null)} onPractice={onPractice} />;
  const done = quiz.length > 0 && got.size === quiz.length;

  return (
    <div className="mm mm-paper">
      <button className="pp-link small" onClick={onBack}>← สรุปทั้งหมด</button>
      <div className="mm-head">
        <h2>{map.title}</h2>
        <p><span className="mm-chip">ภาค ก</span>{recall ? "นึกให้ออกก่อน แล้วแตะ ? เพื่อดูเฉลย · แตะอีกครั้งถ้าจำได้" : map.intro ?? "แตะกิ่งไหนก็ได้ เพื่อดูรายละเอียด"}</p>
      </div>
      {isAdmin && (
        <div className={`mm-admin ${ok ? "ok" : ""}`}>
          <span>{ok ? "✓ ผู้ใช้เห็นแผนผังนี้แล้ว" : "ร่าง · ผู้ใช้ยังไม่เห็น ตรวจเนื้อหาทุกกิ่งก่อนเปิด"}</span>
          <button className="pp-btn pp-btn-ghost sm" onClick={() => onSetOk(!ok)}>{ok ? "ซ่อนจากผู้ใช้" : "ตรวจแล้ว เปิดให้ผู้ใช้เห็น"}</button>
        </div>
      )}
      {recall && (
        <div className="mm-prog">
          <span>{"⭐".repeat(got.size)}{"☆".repeat(Math.max(0, quiz.length - got.size))}</span>
          <div className="mm-bar"><i style={{ width: `${quiz.length ? (100 * got.size) / quiz.length : 0}%` }} /></div>
          <b>{got.size}/{quiz.length}</b>
        </div>
      )}
      <Stage map={map} recall={recall} seen={seen} got={got} onTap={tap}
        hub={recall ? (done ? "จำได้ครบแล้ว!" : `อีก ${quiz.length - got.size} กิ่ง!`) : map.hub}
        hubSub={recall ? (done ? "เก่งมาก ไปฝึกข้อสอบกัน" : "สู้ ๆ นะ") : map.hubSub}
        mood={recall ? (done ? "cheer" : "think") : "happy"} />
      <div className="mm-btns">
        {recall
          ? <button className="mm-btn g" onClick={done ? () => { setRecall(false); restart(); } : restart}>{done ? "กลับแผนผัง" : "🔁 ทวนใหม่"}</button>
          : <button className="mm-btn g" onClick={() => { restart(); setRecall(true); }}>🧠 โหมดท่องจำ</button>}
        <button className={`mm-btn ${done ? "gold" : "p"}`} onClick={onPractice}>✏️ ฝึกข้อสอบหมวดนี้</button>
      </div>
      {recall && !done && <button className="pp-link small mm-exit" onClick={() => { setRecall(false); restart(); }}>ออกจากโหมดท่องจำ</button>}
    </div>
  );
}

// Hub and branches on a 6-column grid; dotted lines from the hub to each node are drawn from measured positions.
function Stage({ map, recall, seen, got, onTap, hub, hubSub, mood }: {
  map: MindMap; recall: boolean; seen: Set<string>; got: Set<string>; onTap: (b: Branch) => void;
  hub: string; hubSub?: string; mood: "happy" | "think" | "cheer";
}) {
  const box = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ d: string; c: string }[]>([]);
  const slots = SLOTS[map.branches.length] ?? SLOTS[6];
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const draw = () => {
      const o = el.getBoundingClientRect();
      const h = el.querySelector(".mm-hub")?.getBoundingClientRect();
      if (!h) return;
      const hx = h.left + h.width / 2 - o.left, hy = h.top + h.height / 2 - o.top;
      setLines([...el.querySelectorAll<HTMLElement>(".mm-node")].map((n, i) => {
        const r = n.getBoundingClientRect();
        const x = r.left + r.width / 2 - o.left, y = r.top + r.height / 2 - o.top;
        return { d: `M${hx} ${hy} Q ${(hx + x) / 2} ${hy} ${x} ${y}`, c: TONE[map.branches[i].tone] };
      }));
    };
    draw();
    const ro = new ResizeObserver(draw); ro.observe(el);
    return () => ro.disconnect();
  }, [map, recall, seen, got]);

  return (
    <div className={`mm-stage n${map.branches.length}`} ref={box}>
      <svg aria-hidden="true">{lines.map((l, i) => <path key={i} d={l.d} stroke={l.c} />)}</svg>
      {map.branches.map((b, i) => {
        const hidden = recall && b.big && !seen.has(b.id);
        const mark = recall && got.has(b.id);
        return (
          <button key={b.id} className={`mm-node t-${b.tone} ${slots[i]} ${mark ? "got" : ""} ${recall && !b.big ? "dim" : ""}`} onClick={() => onTap(b)}>
            <span className="ic" aria-hidden="true">{b.icon}</span>
            {!recall && (b.hot ? <span className="st">คนผิดเยอะ</span> : b.must ? <span className="st y">ต้องจำ</span> : null)}
            <span className="t">{recall ? b.ask ?? b.title : b.title}{!recall && b.ref ? ` · ${b.ref}` : ""}</span>
            {b.big && (hidden
              ? <span className="n"><i className="q">?</i></span>
              : <span className={`n ${b.big.length > 9 ? "long" : ""}`}>{b.big}{b.unit && <small> {b.unit}</small>}</span>)}
            {recall
              ? b.big && <span className="s hint">{hidden ? "แตะเพื่อดูเฉลย" : mark ? "✓ จำได้!" : "แตะอีกครั้งถ้าจำได้"}</span>
              : b.sub && <span className="s">{b.sub}</span>}
          </button>
        );
      })}
      <div className="mm-hub">
        <Mascot mood={mood} costume="teacher" size={86} motion="idle" />
        <div className="cloud"><b>{hub}</b>{hubSub && <small>{hubSub}</small>}</div>
      </div>
    </div>
  );
}

function BranchView({ map, b, onBack, onPractice }: { map: MindMap; b: Branch; onBack: () => void; onPractice: () => void }) {
  return (
    <div className="mm mm-paper">
      <button className="pp-link small" onClick={onBack}>← {map.title}</button>
      <div className={`mm-head t-${b.tone}`}>
        <h2><span className="mm-bic">{b.icon}</span>{b.title}</h2>
        {b.ref && <p>{b.ref}</p>}
      </div>
      {b.big && (
        <div className={`mm-key t-${b.tone}`}><span>ต้องจำ</span><b>{b.big}{b.unit && <small> {b.unit}</small>}</b>{b.sub && <p>{b.sub}</p>}</div>
      )}
      {b.blocks.map((x, i) => <BlockView key={i} x={x} tone={b.tone} />)}
      <div className="mm-btns">
        <button className="mm-btn g" onClick={onBack}>กลับแผนผัง</button>
        <button className="mm-btn p" onClick={onPractice}>✏️ ฝึกข้อสอบหมวดนี้</button>
      </div>
    </div>
  );
}

function BlockView({ x, tone }: { x: Block; tone: string }) {
  switch (x.k) {
    case "flower": {
      const n = x.items.length;
      return (
        <div className="mm-flower">
          <div className="core"><b>{x.center}</b>{x.sub && <span>{x.sub}</span>}</div>
          {x.items.map((it, i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
            const style = { left: `${50 + 36 * Math.cos(a)}%`, top: `${50 + 39 * Math.sin(a)}%` } as CSSProperties;
            return (
              <div key={i} className={`pet t-${["pink", "mint", "sky", "lem", "lil", "pea"][i % 6]}`} style={style}>
                <span className="k">{i + 1}</span><i>{it.icon}</i><b>{it.t}</b>
              </div>
            );
          })}
        </div>
      );
    }
    case "list":
      return (
        <div className="mm-card">
          {x.items.map((it, i) => (
            <div key={i} className="mm-row"><span className={`ri t-${tone}`}>{it.icon ?? "•"}</span><div><b>{it.t}</b>{it.d && <p>{it.d}</p>}</div></div>
          ))}
        </div>
      );
    case "pairs":
      return <div className="mm-pairs">{x.items.map((p, i) => <div key={i} className={`t-${tone}`}><b>{p.a}</b><span>{p.b}</span></div>)}</div>;
    case "steps":
      return (
        <div className="mm-card mm-steps">
          {x.items.map((s, i) => <div key={i} className="mm-row"><span className={`ri num t-${tone}`}>{i + 1}</span><div><b>{s.t}</b>{s.d && <p>{s.d}</p>}</div></div>)}
        </div>
      );
    case "table":
      return (
        <div className="mm-card mm-table"><table>
          <thead><tr>{x.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{x.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table></div>
      );
    case "formula":
      return <div className={`mm-formula t-${tone}`}><b>{x.f}</b>{x.d && <p>{x.d}</p>}</div>;
    case "example":
      return (
        <div className="mm-card mm-ex">
          <span className="lab">ตัวอย่างโจทย์</span>
          <p className="q">{x.q}</p>
          <ol>{x.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <p className="a">ตอบ {x.a}</p>
        </div>
      );
    case "words":
      return (
        <div className="mm-words">
          {x.items.map((w, i) => <div key={i} className={`t-${["pink", "mint", "sky", "lem", "lil", "pea"][i % 6]}`}><b>{w.w}</b><span>{w.m}</span>{w.ex && <i>{w.ex}</i>}</div>)}
        </div>
      );
    case "memo":
      return <div className="mm-memo">💡 <b>ทริกจำ:</b> {x.t}</div>;
    case "oops":
      return <div className="mm-oops"><Mascot mood="think" size={48} motion="still" /><p><b>ระวังพลาด!</b> {x.t}</p></div>;
    case "note":
      return <p className="mm-note">{x.t}</p>;
  }
}
