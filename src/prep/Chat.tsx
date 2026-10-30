import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Mascot from "./Mascot";
import { IconChat, IconNext, IconX } from "./icons";
import { supabase, thaiError } from "./api";
import { SHOP } from "./config";
import { navigate, useBackClose } from "./router";

// In-app chat with the same bot as LINE @701pvghq (Edge Function prep-line-bot, action "chat"). The bot also sees the
// user's own plan, orders and readiness, so "สลิปผ่านยัง" gets a real answer. A human is reached through LINE.
type Msg = { role: "user" | "assistant"; content: string };
const QUICK = ["สลิปของฉันผ่านหรือยัง", "แพ็กไหนคุ้มสุด", "ควรฝึกหมวดไหนก่อน", "ซื้อขาดกับรายรอบต่างกันยังไง"];

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("prep-line-bot", { body });
  if (error) {
    const msg = await (error as { context?: Response }).context?.json?.().then((j: { error?: string }) => j.error).catch(() => null);
    throw new Error(msg || error.message);
  }
  return data as T;
}

// Links in a reply: a sobprep.com/prep link opens inside the app (and closes the chat), anything else in a new tab.
function Linked({ text, onInApp }: { text: string; onInApp: (path: string) => void }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return <>{parts.map((p, i) => {
    if (!/^https?:\/\//.test(p)) return <Fragment key={i}>{p}</Fragment>;
    let inApp: string | null = null;
    try { const u = new URL(p); if (/(^|\.)sobprep\.com$/.test(u.hostname) && u.pathname.startsWith("/prep")) inApp = u.pathname; } catch { /* not a URL */ }
    return inApp
      ? <a key={i} href={p} onClick={e => { e.preventDefault(); onInApp(inApp!); }}>{p.replace(/^https:\/\//, "").replace(/\?src=[\w-]+$/, "")}</a>
      : <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a>;
  })}</>;
}

function ChatSheet({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useBackClose(onClose);
  useEffect(() => {
    call<{ history: Msg[]; left: number }>({ action: "history" })
      .then(r => { setMsgs(r.history); setLeft(r.left); })
      .catch(() => setMsgs([]));
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async (q: string) => {
    const m = q.trim();
    if (!m || busy) return;
    setText(""); setError(""); setBusy(true);
    setMsgs(list => [...(list ?? []), { role: "user", content: m }]);
    try {
      const r = await call<{ reply: string; handoff: boolean; left: number }>({ action: "chat", message: m });
      setMsgs(list => [...(list ?? []), { role: "assistant", content: r.reply }]);
      setHandoff(h => h || r.handoff); setLeft(r.left);
    } catch (e) {
      setError(thaiError(e)); setText(m);
      setMsgs(list => (list ?? []).slice(0, -1));
    }
    setBusy(false);
  };
  const openInApp = (path: string) => { onClose(); window.setTimeout(() => navigate(path), 0); };

  let body: ReactNode;
  if (msgs === null) body = <div className="pp-spinner" />;
  else body = (
    <>
      {!msgs.length && (
        <div className="pp-chat-hello">
          <Mascot mood="wave" size={88} motion="pop" />
          <p>สวัสดีครับ ถามเรื่องแพ็ก การซื้อ สถานะสลิป หรือควรฝึกอะไรก่อนได้เลย</p>
          <div className="pp-chat-quick">{QUICK.map(q => <button key={q} className="pp-chat-q" onClick={() => send(q)}>{q}</button>)}</div>
        </div>
      )}
      {msgs.map((m, i) => (
        <div key={i} className={`pp-chat-msg ${m.role === "user" ? "me" : "bot"}`}>
          {m.role === "assistant" ? <Linked text={m.content} onInApp={openInApp} /> : m.content}
        </div>
      ))}
      {busy && <div className="pp-chat-msg bot pp-chat-typing" aria-label="กำลังพิมพ์"><i /><i /><i /></div>}
      <div ref={end} />
    </>
  );

  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-chat-h" onClick={onClose}>
      <div className="pp-modal-box pp-chat" onClick={e => e.stopPropagation()}>
        <div className="pp-modal-h">
          <h3 id="pp-chat-h"><IconChat size={20} />ถามแอดมินบอท</h3>
          <button className="pp-x" onClick={onClose} aria-label="ปิด"><IconX /></button>
        </div>
        <div className="pp-chat-list" aria-live="polite">{body}</div>
        {error && <div className="pp-error small">{error}</div>}
        <a className={`pp-chat-line${handoff ? " on" : ""}`} href={SHOP.contactUrl} target="_blank" rel="noopener noreferrer">
          คุยกับแอดมินทาง LINE {SHOP.contactText.replace(/^LINE\s*/, "")}
        </a>
        <form className="pp-chat-form" onSubmit={e => { e.preventDefault(); send(text); }}>
          <textarea className="pp-input" rows={1} maxLength={2000} placeholder="พิมพ์คำถาม…" value={text} disabled={left === 0}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }} />
          <button className="pp-btn pp-btn-primary" type="submit" disabled={busy || !text.trim() || left === 0} aria-label="ส่ง"><IconNext /></button>
        </form>
        {left != null && left <= 5 && <p className="pp-muted small pp-chat-left">{left ? `วันนี้ถามได้อีก ${left} ข้อความ` : "วันนี้ถามครบแล้ว พรุ่งนี้ถามต่อได้"}</p>}
        <p className="pp-muted small pp-chat-note">ตอบโดย AI อาจผิดพลาดได้ · เก็บข้อความไว้ 90 วันเพื่อปรับปรุงบริการ</p>
      </div>
    </div>
  );
}

// Floating button above the bottom nav (on desktop: bottom-right corner).
export default function ChatButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="pp-chat-fab" onClick={() => setOpen(true)} aria-label="แชทถามแอดมินบอท"><IconChat size={24} /></button>
      {open && <ChatSheet onClose={() => setOpen(false)} />}
    </>
  );
}
