import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { rpc, thaiError, track } from "./api";
import type { Preset } from "./CreateSet";
import { IconCrown } from "./icons";
import Mascot from "./Mascot";
import type { PastTag } from "./PastExams";
import { GROUPS, type Block, type Branch, type MindMap } from "./summaries/types";
import "./summary.css";

// "สรุปแบบแผนผัง": list of maps → one map (mascot hub + branches) → one branch's detail. Recall mode hides the value to
// remember on each branch: tap once to reveal, tap again to mark it remembered. The server decides what each user gets
// (prep_summary_list / prep_summary_get): approved maps only, and without a package for that ภาค only the free sample per group.
const SLOTS: Record<number, string[]> = {
  4: ["tl", "tr", "bl", "br"],
  5: ["tl", "tr", "ml", "mr", "bc"],
  6: ["tl", "tr", "ml", "mr", "bl", "br"],
};
const TONE: Record<string, string> = { pink: "#E8577A", mint: "#22A06B", sky: "#2F80ED", lem: "#C98A00", lil: "#7B5BD6", pea: "#E07A1F" };

// One card per map from prep_summary_list; the content comes from prep_summary_get only when the user may open it.
type Card = { id: string; group: MindMap["group"]; free: boolean; title: string; icon: string; branches: number; tone: string; approved: boolean; locked: boolean };

// Loads the list, and one map on demand. `approve` flips a map's approval and updates the list in place.
function useSummaries() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState("");
  const [map, setMap] = useState<MindMap | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { rpc<Card[]>("prep_summary_list").then(setCards).catch(e => setError(thaiError(e))); }, []);
  const load = async (id: string | null) => {
    window.scrollTo(0, 0);
    if (!id) { setMap(null); return; }
    setBusy(true);
    try { setMap(await rpc<MindMap>("prep_summary_get", { p_id: id })); track("summary_view"); }
    catch (e) { alert(e instanceof Error && e.message === "summary_locked" ? "แผนผังนี้เปิดได้ด้วยแพ็กของภาคนั้น หรือแพ็กครบทุกภาค" : thaiError(e)); }
    setBusy(false);
  };
  const approve = async (id: string, ok: boolean) => {
    try {
      await rpc("prep_admin_summary_set", { p_id: id, p_ok: ok });
      setCards(cs => cs?.map(c => (c.id === id ? { ...c, approved: ok } : c)) ?? cs);
      return true;
    } catch (e) { alert(thaiError(e)); return false; }
  };
  return { cards, error, map, busy, load, approve };
}

export default function Summary({ isAdmin, onPractice, onPastSet, onUpgrade }: {
  isAdmin: boolean; onPractice: (p: Preset) => void; onPastSet: (setId: string) => void; onUpgrade: () => void;
}) {
  const { cards, error, map, busy, load, approve } = useSummaries();
  const [locked, setLocked] = useState<Card | null>(null);
  const [past, setPast] = useState<PastTag[]>([]);
  const [sec, setSec] = useState<"A" | "B" | null>(() => { try { const v = localStorage.getItem("mm-sec"); return v === "A" || v === "B" ? v : null; } catch { return null; } });
  useEffect(() => { rpc<PastTag[]>("prep_past_tags").then(setPast).catch(() => setPast([])); }, []);
  if (error) return <div className="pp-card"><div className="pp-error">{error}</div></div>;
  if (!cards || busy) return <div className="pp-spinner" />;

  if (map) {
    const ok = cards.find(c => c.id === map.id)?.approved ?? false;
    return <MapView key={map.id} map={map} isAdmin={isAdmin} ok={ok} onSetOk={v => approve(map.id, v)}
      onBack={() => load(null)} onPractice={() => onPractice({ topics: map.topics })}
      past={past.filter(t => (t.groups[map.group] ?? 0) >= 5)} onPastSet={onPastSet} />;
  }

  const sample = cards.some(c => c.locked);   // free user: show the ฟรี / crown tags and the upgrade card
  // ภาค ก / ภาค ข tabs. Until the user picks one (remembered on this device), open the ภาค their package covers.
  const has = (k: string) => cards.some(c => c.group.startsWith(k));
  const auto = has("B") && !cards.some(c => c.group.startsWith("A") && !c.locked) && cards.some(c => c.group.startsWith("B") && !c.locked) ? "B" : "A";
  const shown = sec && has(sec) ? sec : auto;
  const pick = (k: "A" | "B") => { setSec(k); try { localStorage.setItem("mm-sec", k); } catch { /* private mode */ } };
  return (
    <div className="mm">
      <div className="mm-intro">
        <Mascot mood="happy" costume="teacher" size={84} motion="idle" />
        <div><h2>สรุปแบบแผนผัง</h2><p>อ่านภาพเดียวจบหมวด แล้วลองโหมดท่องจำ จำได้แล้วค่อยไปฝึกข้อสอบ</p></div>
      </div>
      {isAdmin && <p className="pp-note small">แอดมินเห็นทุกแผนผัง ผู้ใช้เห็นเฉพาะแผนผังที่ตรวจแล้ว ({cards.filter(c => c.approved).length}/{cards.length}) · ตรวจได้ที่ แอดมิน → ข้อสอบ → สรุปแผนผัง</p>}
      {sample && (
        <div className={`mm-upsell ${locked ? "on" : ""}`}>
          <span className="cr"><IconCrown size={20} /></span>
          <div>
            <b>{locked ? `ปลดล็อก "${locked.title}"` : "ลองฟรีได้วิชาละ 1 หมวด"}</b>
            <p>{locked ? `เปิดได้ด้วยแพ็กภาค ${locked.group.startsWith("B") ? "ข" : "ก"} หรือแพ็กครบทุกภาค` : "หมวดที่มีมงกุฎ เปิดได้ด้วยแพ็กของภาคนั้น หรือแพ็กครบทุกภาค"}</p>
          </div>
          <button className="pp-btn pp-btn-primary sm" onClick={onUpgrade}>ดูแพ็ก</button>
        </div>
      )}
      {!cards.length && <div className="pp-card pp-empty">กำลังเตรียมสรุปให้อยู่ เร็ว ๆ นี้</div>}
      {has("A") && has("B") && (
        <div className="pp-seg mm-sec" role="tablist" aria-label="เลือกภาค">
          {(["A", "B"] as const).map(k => (
            <button key={k} role="tab" aria-selected={shown === k} className={shown === k ? "on" : ""} onClick={() => pick(k)}>
              ภาค {k === "A" ? "ก" : "ข"} <small>{cards.filter(c => c.group.startsWith(k)).length} หมวด</small>
            </button>
          ))}
        </div>
      )}
      {GROUPS.filter(g => g.key.startsWith(shown)).map(g => {
        const ms = cards.filter(c => c.group === g.key);
        if (!ms.length) return null;
        return (
          <section key={g.key} className="mm-group">
            <h3>{g.title}<small>{g.sub}</small></h3>
            <div className="mm-list">
              {ms.map(m => (
                <button key={m.id} className={`mm-item t-${m.tone} ${m.locked ? "locked" : ""}`}
                  onClick={() => { if (!m.locked) load(m.id); else { setLocked(m); window.scrollTo({ top: 0, behavior: "smooth" }); } }}>
                  <span className="ic">{m.icon}</span>
                  {sample && (m.free ? <span className="tag free">ฟรี</span> : m.locked && <span className="tag crown" aria-label="ปลดล็อกด้วยแพ็ก"><IconCrown size={13} /></span>)}
                  <b>{m.title}</b>
                  <small>{m.branches} กิ่ง{isAdmin && !m.approved ? " · ร่าง" : ""}</small>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// แอดมิน → ข้อสอบ → สรุปแผนผัง: every map with its status; open one to read it and approve or withdraw it.
export function AdminSummaries({ onChanged }: { onChanged?: () => void }) {
  const { cards, error, map, busy, load, approve } = useSummaries();
  const set = async (id: string, ok: boolean) => { if (await approve(id, ok)) onChanged?.(); };
  if (error) return <div className="pp-card"><div className="pp-error">{error}</div></div>;
  if (!cards || busy) return <div className="pp-spinner" />;
  if (map) return <MapView key={map.id} map={map} isAdmin ok={cards.find(c => c.id === map.id)?.approved ?? false} onSetOk={ok => set(map.id, ok)}
    onBack={() => load(null)} onPractice={() => { /* preview only */ }} past={[]} onPastSet={() => { /* preview only */ }} />;
  const drafts = cards.filter(c => !c.approved).length;
  return (
    <div className="pp-card mm-admin-list">
      <h3>สรุปแผนผัง · รอตรวจ {drafts} จาก {cards.length}</h3>
      <p className="pp-muted small">เปิดอ่านทุกกิ่ง เทียบกับตัวบทกฎหมายหรือหลักสูตร แล้วกด "ตรวจแล้ว" ผู้ใช้จะเห็นเฉพาะแผนผังที่ตรวจแล้ว · หมวดที่มีป้าย ฟรี ผู้ใช้ฟรีเปิดได้ ควรตรวจก่อน</p>
      {GROUPS.map(g => (
        <div key={g.key}>
          <h4>{g.title}</h4>
          {cards.filter(c => c.group === g.key).map(m => (
            <div key={m.id} className="mm-arow">
              <span className="ic">{m.icon}</span>
              <button className="pp-link" onClick={() => load(m.id)}>{m.title}</button>
              {m.free && <span className="pp-badge ok">ฟรี</span>}
              <span className={`pp-badge ${m.approved ? "ok" : "warn"}`}>{m.approved ? "เปิดแล้ว" : "ร่าง"}</span>
              <button className="pp-btn pp-btn-ghost sm" onClick={() => set(m.id, !m.approved)}>{m.approved ? "ซ่อน" : "ตรวจแล้ว"}</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MapView({ map, isAdmin, ok, onSetOk, onBack, onPractice, past, onPastSet }: {
  map: MindMap; isAdmin: boolean; ok: boolean; onSetOk: (ok: boolean) => void; onBack: () => void; onPractice: () => void;
  past: PastTag[]; onPastSet: (setId: string) => void;
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
        <p><span className="mm-chip">{map.group.startsWith("B") ? "ภาค ข" : "ภาค ก"}</span>{recall ? "นึกให้ออกก่อน แล้วแตะ ? เพื่อดูเฉลย · แตะอีกครั้งถ้าจำได้" : map.intro ?? "แตะกิ่งไหนก็ได้ เพื่อดูรายละเอียด"}</p>
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
      {!recall && past.length > 0 && <PastSets map={map} past={past} onPastSet={onPastSet} />}
    </div>
  );
}

// Past-exam questions of this map's subject group (A3, A1 ...): a tap builds a set from them and starts it.
function PastSets({ map, past, onPastSet }: { map: MindMap; past: PastTag[]; onPastSet: (setId: string) => void }) {
  const [busy, setBusy] = useState("");
  const start = async (t: PastTag) => {
    setBusy(t.tag);
    try { onPastSet(await rpc<string>("prep_create_past_set", { p_tag: t.tag, p_section: t.section, p_prefix: map.group + "-" })); }
    catch (e) { alert(thaiError(e)); setBusy(""); }
  };
  return (
    <div className="mm-card mm-pastsets">
      <b>📝 แนวข้อสอบเก่าที่เกี่ยวข้อง</b>
      {past.map(t => (
        <button key={t.tag} className="mm-btn g" disabled={!!busy} onClick={() => start(t)}>
          {busy === t.tag ? "กำลังสร้างชุด…" : `${t.tag.replace(/^แนวข้อสอบ\s*/, "")} · ${t.groups[map.group]} ข้อ`}
        </button>
      ))}
      <p>เป็นแนวข้อสอบ ไม่ใช่ข้อสอบฉบับจริง · ทำแล้วนับคะแนนและเข้าทวนข้อผิด</p>
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
    case "past":
      return <PastView x={x} />;
    case "seq":
      return <SeqView x={x} />;
  }
}

// Each term takes two grid columns, so a bracket from the centre of term i to the centre of term j starts at column 2i+2
// and spans 2(j-i); a level-2 bracket runs between the centres of two neighbouring step-1 brackets.
function SeqView({ x }: { x: Extract<Block, { k: "seq" }> }) {
  const n = x.terms.length;
  return (
    <div className="mm-card mm-seq">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${2 * n}, minmax(0, 1fr))` }}>
        {x.terms.map((t, i) => (
          <b key={i} className={i === x.ans ? "ans" : undefined} style={{ gridColumn: `${2 * i + 1} / span 2`, gridRow: 1 }}>{t}</b>
        ))}
        {x.rows.map((r, ri) => r.ops.map((op, k) => {
          const step = r.step ?? 1, i = (r.from ?? 0) + k * step;
          const col = r.level2 ? `${2 * i + 3} / span 2` : `${2 * i + 2} / span ${2 * step}`;
          return (
            <span key={`${ri}-${k}`} className={`br t-${["pink", "sky", "lil", "mint"][ri % 4]}${r.level2 ? " l2" : ""}`} style={{ gridColumn: col, gridRow: ri + 2 }}>
              <i /><em>{op}</em>
            </span>
          );
        }))}
      </div>
      {x.cap && <p className="cap">{x.cap}</p>}
    </div>
  );
}

// Real papers are not published; these are guide questions labelled with the exam and year only. The answer and its reason
// follow the current law.
function PastView({ x }: { x: Extract<Block, { k: "past" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mm-card mm-past">
      <span className="lab">แนวข้อสอบเก่า</span> <span className="src">{x.src}</span>
      <p className="q">{x.q}</p>
      <ol>{x.choices.map((c, i) => <li key={i} className={open && i === x.a ? "ok" : undefined}>{c}</li>)}</ol>
      {open
        ? <p className="why"><b>ตอบ {x.a + 1}.</b> {x.why}</p>
        : <button className="pp-link small" onClick={() => setOpen(true)}>ดูเฉลย</button>}
      <p className="fine">เป็นแนวข้อสอบ ไม่ใช่ข้อสอบฉบับจริง · เฉลยตามตัวบทปัจจุบัน</p>
    </div>
  );
}
