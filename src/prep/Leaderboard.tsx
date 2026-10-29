import { useCallback, useEffect, useState } from "react";
import { rpc, thaiError, track } from "./api";
import { IconBack } from "./icons";
import { levelOf } from "./levels";
import Mascot from "./Mascot";
import { nf } from "./chartFormat";
import { ask } from "./dialog";

type Period = "week" | "month" | "all";
type Board = "xp" | "correct" | "answered" | "accuracy" | "streak" | "mock";
type Row = { rank: number; name: string; value: number; xp: number; you: boolean; uid?: string | null };
type Data = { board: Board; period: Period; min_answers: number | null; players: number; rows: Row[]; me: { rank: number; value: number; hidden: boolean } | null };
type Community = {
  users: number; active_today: number; answers_today: number; answers_week: number; answers_total: number; accuracy_week: number | null;
  daily_done_today: number; mocks_week: number; top_majors: { name: string; answers: number }[];
  hardest_topic: { name: string; pct: number } | null; easiest_topic: { name: string; pct: number } | null;
};
type MyProfile = { nickname: string | null; hidden: boolean; handle: string };

const BOARDS: { k: Board; label: string; fmt: (v: number) => string; hint: string }[] = [
  { k: "xp", label: "เลเวลสูงสุด", fmt: v => `${nf(v)} XP`, hint: "XP = ตอบ 1 ข้อ +1 · ตอบถูก +1 · ข้อสอบประจำวันครบ +20 · ส่งจำลองสอบ +50" },
  { k: "correct", label: "ตอบถูกเยอะสุด", fmt: v => `${nf(v)} ข้อ`, hint: "นับจำนวนข้อที่ตอบถูกทั้งหมด รวมข้อที่ทำซ้ำ" },
  { k: "answered", label: "ทำข้อเยอะสุด", fmt: v => `${nf(v)} ข้อ`, hint: "จำนวนข้อที่ตอบทั้งหมด" },
  { k: "accuracy", label: "แม่นที่สุด", fmt: v => `${v}%`, hint: "% ตอบถูก นับเฉพาะคนที่ตอบอย่างน้อยตามเกณฑ์ที่ระบุ จะได้ไม่ใช่คนที่ทำแค่ไม่กี่ข้อ" },
  { k: "streak", label: "ฝึกต่อเนื่องนานสุด", fmt: v => `${v} วัน`, hint: "จำนวนวันที่ฝึกอย่างน้อย 1 ข้อต่อวัน ต่อเนื่องกันโดยไม่ขาด นับเฉพาะช่วงล่าสุดที่ยังไม่ขาด" },
  { k: "mock", label: "คะแนนจำลองสอบ", fmt: v => `${v}%`, hint: "คะแนนจำลองสอบที่ดีที่สุดของแต่ละคน (% ของข้อทั้งหมด)" },
];
const PERIODS: [Period, string][] = [["week", "สัปดาห์นี้"], ["month", "30 วัน"], ["all", "ตลอดกาล"]];
const MEDAL = ["🥇", "🥈", "🥉"];

export default function Leaderboard({ onBack, isAdmin = false }: { onBack: () => void; isAdmin?: boolean }) {
  const [board, setBoard] = useState<Board>("xp");
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<Data | null>(null);
  const [com, setCom] = useState<Community | null>(null);
  const [mine, setMine] = useState<MyProfile | null>(null);
  const [error, setError] = useState("");
  const [nick, setNick] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback((b: Board, p: Period) => {
    setData(null);
    return rpc<Data>("prep_leaderboard", { p_board: b, p_period: p }).then(d => { setData(d); setError(""); }).catch(e => setError(thaiError(e)));
  }, []);

  useEffect(() => {
    track("board_view");
    rpc<Community>("prep_community_stats").then(setCom).catch(() => setCom(null));
    rpc<MyProfile>("prep_board_profile").then(p => { setMine(p); setNick(p.nickname ?? ""); }).catch(() => setMine(null));
  }, []);
  useEffect(() => {
    let live = true;
    rpc<Data>("prep_leaderboard", { p_board: board, p_period: period })
      .then(d => { if (live) { setData(d); setError(""); } }).catch(e => { if (live) setError(thaiError(e)); });
    return () => { live = false; };
  }, [board, period]);

  const b = BOARDS.find(x => x.k === board)!;
  const saveProfile = async (hidden: boolean, nickname: string) => {
    try {
      setMine(await rpc<MyProfile>("prep_set_board_profile", { p_nickname: nickname, p_hidden: hidden }));
      setMsg({ ok: true, text: "บันทึกแล้ว" }); load(board, period);
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
  };
  const clear = async (r: Row) => {
    if (!r.uid || !(await ask({ title: `ล้างชื่อที่แสดงของ "${r.name}"?`, ok: "ล้างชื่อ", danger: true }))) return;
    try { await rpc("prep_admin_clear_nickname", { p_user: r.uid }); load(board, period); } catch (e) { setError(thaiError(e)); }
  };
  const inTop = data?.rows.some(r => r.you) ?? false;

  return (
    <>
      <div className="pp-card pp-lb-head">
        <button className="pp-link small" onClick={onBack}><IconBack size={16} />กลับ</button>
        <div className="pp-lb-title"><Mascot mood="cheer" motion="cheer" size={56} /><div><h2>อันดับ</h2><span className="pp-muted small">ทุกคนแสดงเป็นชื่อสมมติ ตั้งชื่อเองหรือซ่อนตัวได้ด้านล่าง</span></div></div>
      </div>

      {com && (
        <div className="pp-lb-stats">
          <div><b>{nf(com.active_today)}</b><span>คนใช้งานวันนี้</span></div>
          <div><b>{nf(com.answers_today)}</b><span>ข้อที่ทำวันนี้</span></div>
          <div><b>{com.accuracy_week ?? "–"}{com.accuracy_week != null ? "%" : ""}</b><span>ตอบถูกเฉลี่ยสัปดาห์นี้</span></div>
          <div><b>{nf(com.mocks_week)}</b><span>จำลองสอบสัปดาห์นี้</span></div>
        </div>
      )}

      <div className="pp-card">
        <div className="pp-lb-boards" role="tablist">
          {BOARDS.map(x => <button key={x.k} role="tab" aria-selected={board === x.k} className={board === x.k ? "on" : ""} onClick={() => setBoard(x.k)}>{x.label}</button>)}
        </div>
        {board !== "streak" && (
          <div className="pp-seg">
            {PERIODS.map(([k, l]) => <button key={k} className={period === k ? "on" : ""} onClick={() => setPeriod(k)}>{l}</button>)}
          </div>
        )}
        <p className="pp-muted small">{b.hint}{board === "accuracy" && data?.min_answers ? ` (ขั้นต่ำ ${data.min_answers} ข้อ)` : ""}{period === "week" && board !== "streak" ? " · สัปดาห์เริ่มวันจันทร์ รีเซ็ตทุกสัปดาห์" : ""}</p>

        {error && <div className="pp-error">{error}</div>}
        {!data && !error && <div className="pp-spinner" />}
        {data && data.rows.length === 0 && <p className="pp-muted">ยังไม่มีใครในอันดับนี้ ลองทำข้อสอบแล้วขึ้นอันดับเป็นคนแรกได้เลย</p>}
        {data && (
          <ol className="pp-lb-list">
            {data.rows.map(r => (
              <li key={r.rank + r.name} className={`${r.you ? "you" : ""} ${r.rank <= 3 ? "top" : ""}`}>
                <span className="pp-lb-rank" aria-label={`อันดับ ${r.rank}`}>{r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</span>
                <span className="pp-lb-name">{r.name}{r.you && <em>คุณ</em>}<small className="pp-muted">Lv.{levelOf(r.xp).no} {levelOf(r.xp).name}</small></span>
                <b>{b.fmt(r.value)}</b>
                {isAdmin && r.uid && <button className="pp-link small" onClick={() => clear(r)}>ล้างชื่อ</button>}
              </li>
            ))}
          </ol>
        )}
        {data && data.me && !inTop && (
          <div className="pp-lb-me">{data.me.hidden ? "คุณซ่อนตัวอยู่ · " : ""}อันดับของคุณ <b>#{data.me.rank}</b> จาก {nf(data.players)} คน · {b.fmt(data.me.value)}</div>
        )}
        {data && !data.me && <div className="pp-lb-me muted">คุณยังไม่มีคะแนนในอันดับนี้{board === "accuracy" ? ` (ต้องตอบอย่างน้อย ${data.min_answers} ข้อ)` : board === "mock" ? " (ลองจำลองสอบดูสักครั้ง)" : " ลองทำข้อสอบสักชุดได้เลย"}</div>}
      </div>

      {com && (
        <div className="pp-card">
          <h3>สถิติที่น่าสนใจ</h3>
          <div className="pp-guide-table">
            <div><span>ข้อที่ทุกคนรวมกันทำแล้ว</span><b>{nf(com.answers_total)}</b></div>
            <div><span>สัปดาห์นี้ทำไปแล้ว</span><b>{nf(com.answers_week)} ข้อ</b></div>
            <div><span>ทำข้อสอบประจำวันครบวันนี้</span><b>{nf(com.daily_done_today)} คน</b></div>
            {com.top_majors.map((m, i) => <div key={m.name}><span>วิชาเอกที่ทำเยอะสุดสัปดาห์นี้ #{i + 1}</span><b>{m.name} · {nf(m.answers)} ข้อ</b></div>)}
            {com.easiest_topic && <div><span>หมวดที่ตอบถูกมากที่สุด</span><b>{com.easiest_topic.name} · {com.easiest_topic.pct}%</b></div>}
            {com.hardest_topic && <div><span>หมวดที่ยากที่สุด</span><b>{com.hardest_topic.name} · {com.hardest_topic.pct}%</b></div>}
          </div>
        </div>
      )}

      {mine && (
        <div className="pp-card pp-lb-prof">
          <h3>ชื่อของคุณในอันดับ</h3>
          <p className="pp-muted small">ตอนนี้แสดงเป็น <b>{mine.nickname ?? mine.handle}</b> ไม่แสดงอีเมลหรือข้อมูลอื่น ชื่อใช้ได้ 2–16 ตัวอักษร (ไทย อังกฤษ ตัวเลข) ห้ามใส่ลิงก์</p>
          <div className="pp-row" style={{ gap: 8 }}>
            <input className="pp-input" maxLength={16} placeholder={mine.handle} value={nick} onChange={e => setNick(e.target.value)} style={{ flex: 1 }} />
            <button className="pp-btn pp-btn-primary" onClick={() => saveProfile(mine.hidden, nick)}>บันทึกชื่อ</button>
          </div>
          <label className="pp-lb-hide"><input type="checkbox" checked={mine.hidden} onChange={e => { setMine({ ...mine, hidden: e.target.checked }); saveProfile(e.target.checked, nick); }} /> ซ่อนฉันจากตารางอันดับ (ยังเห็นอันดับของตัวเองอยู่)</label>
          {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}
        </div>
      )}
    </>
  );
}
