import { useCallback, useEffect, useState } from "react";
import { rpc, supabase, thaiError } from "./api";

type Stats = { conversations: number; line_conversations: number; app_conversations: number; messages: number;
  ai: number; preset: number; handoff: number; fallback: number; slip: number };
type Summary = { day: string; summary: string; stats: Partial<Stats>; model: string | null; updated_at: string };
type Turn = { role: "user" | "assistant"; content: string; src: string | null; at: string };
type Conv = { channel: "line" | "app"; who: string; last: string; turns: Turn[] };

const bangkokDay = (offset = 0) => new Date(Date.now() + 7 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);
const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const fmtTime = (s: string) => new Date(s).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
const SRC: Record<string, string> = { ai: "AI", slip: "สลิป", welcome: "ทักทาย", fallback: "ขัดข้อง", handoff: "ขอแอดมิน", limit: "ครบโควตา" };
const srcLabel = (s: string | null) => !s ? "" : s.startsWith("preset:") ? (s === "preset:admin" ? "ขอแอดมิน" : `พรีเซต ${s.slice(7)}`) : SRC[s] ?? s;

// แอดมิน → ผู้ใช้ → แชทลูกค้า: the AI summary of each day's chats (LINE + in-app), written by prep-line-bot at 00:20 for
// the day before, plus every conversation of a day to read in full. "สรุปใหม่" asks for a summary now (also today so far).
export default function AdminChats() {
  const [list, setList] = useState<Summary[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [convs, setConvs] = useState<Record<string, Conv[]>>({});
  const load = useCallback(() => { rpc<Summary[]>("prep_admin_chat_summaries", { p_limit: 30 }).then(setList).catch(e => setError(thaiError(e))); }, []);
  useEffect(load, [load]);

  const summarize = async (day: string) => {
    setBusy(day); setError("");
    try {
      const { data, error } = await supabase.functions.invoke("prep-line-bot", { body: { action: "summarize", day } });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      load();
    } catch (e) { setError(thaiError(e)); }
    setBusy("");
  };
  const show = async (day: string) => {
    if (open === day) { setOpen(null); return; }
    setOpen(day);
    if (!convs[day]) rpc<Conv[]>("prep_admin_chat_day", { p_day: day }).then(c => setConvs(m => ({ ...m, [day]: c }))).catch(e => setError(thaiError(e)));
  };

  if (!list && !error) return <div className="pp-spinner" />;
  const today = bangkokDay(), yesterday = bangkokDay(-1);
  const days = [...new Set([today, yesterday, ...(list ?? []).map(s => s.day)])];
  return (
    <div className="pp-card">
      <h3>แชทลูกค้า (LINE + ในแอป)</h3>
      <p className="pp-muted small">ระบบสรุปแชทของเมื่อวานให้อัตโนมัติทุกคืนเวลา 00:20 น. กด "สรุปใหม่" เพื่อสรุปตอนนี้ (วันนี้จะสรุปถึงเวลาที่กด) · เก็บแชทไว้ 90 วัน</p>
      {error && <div className="pp-error">{error}</div>}
      {days.map(day => {
        const s = list?.find(x => x.day === day);
        const st = s?.stats ?? {};
        return (
          <div key={day} className="pp-chatsum-conv">
            <div className="pp-fb-meta">
              <b>{fmtDay(day)}{day === today ? " (วันนี้)" : ""}</b>
              <span className="pp-spacer" />
              <button className="pp-btn pp-btn-ghost sm" disabled={!!busy} onClick={() => summarize(day)}>{busy === day ? "กำลังสรุป…" : s ? "สรุปใหม่" : "สรุป"}</button>
              <button className="pp-btn pp-btn-ghost sm" onClick={() => show(day)}>{open === day ? "ซ่อนแชท" : "อ่านแชท"}</button>
            </div>
            {s && (
              <>
                <div className="pp-chatsum-stats">
                  <span className="pp-badge">{st.conversations ?? 0} แชท (LINE {st.line_conversations ?? 0} · แอป {st.app_conversations ?? 0})</span>
                  <span className="pp-badge">{st.messages ?? 0} ข้อความ</span>
                  <span className="pp-badge">AI {st.ai ?? 0} · พรีเซต {st.preset ?? 0}</span>
                  {!!st.handoff && <span className="pp-badge warn">ขอแอดมิน {st.handoff}</span>}
                  {!!st.fallback && <span className="pp-badge warn">ขัดข้อง {st.fallback}</span>}
                </div>
                <div className="pp-chatsum-text">{s.summary}</div>
                <p className="pp-muted small">อัปเดต {new Date(s.updated_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}{s.model ? ` · ${s.model}` : ""}</p>
              </>
            )}
            {!s && <p className="pp-muted small">ยังไม่มีสรุป</p>}
            {open === day && (
              !convs[day] ? <div className="pp-spinner" /> : !convs[day].length ? <p className="pp-muted">ไม่มีแชทในวันนี้</p> :
              convs[day].map((c, i) => (
                <details key={i} className="pp-chatsum-conv">
                  <summary>{c.channel === "app" ? "📱" : "💬"} {c.who} · {c.turns.filter(t => t.role === "user").length} ข้อความ · ล่าสุด {fmtTime(c.last)}</summary>
                  <div className="pp-chatsum-turns">
                    {c.turns.map((t, j) => (
                      <div key={j} className={`pp-chat-msg ${t.role === "user" ? "me" : "bot"}`}>
                        {t.content}
                        <div className="pp-muted small">{fmtTime(t.at)}{t.role === "assistant" && t.src ? ` · ${srcLabel(t.src)}` : ""}</div>
                      </div>
                    ))}
                  </div>
                </details>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
