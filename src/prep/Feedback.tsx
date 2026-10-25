import { useCallback, useEffect, useState } from "react";
import { rpc, thaiError } from "./api";

type Kind = "review" | "idea" | "bug";
type Row = { id: number; kind: Kind; rating: number | null; body: string; status: "new" | "seen" | "done"; admin_note: string | null; created_at: string };

export const KIND: Record<Kind, { icon: string; label: string; hint: string }> = {
  review: { icon: "⭐", label: "รีวิว", hint: "ชอบอะไร อยากให้ปรับอะไร เล่าให้ฟังหน่อย (ไม่บังคับ)" },
  idea: { icon: "💡", label: "เสนอแนะ", hint: "อยากได้ฟีเจอร์ไหน หรืออยากให้เพิ่มเนื้อหาอะไร" },
  bug: { icon: "🐞", label: "แจ้งปัญหา", hint: "เจออะไรผิดปกติ อยู่หน้าไหน ทำอะไรอยู่ตอนนั้น (ข้อสอบผิดให้กด \"แจ้งข้อผิดพลาด\" ที่ข้อนั้นจะเร็วกว่า)" },
};
const STATUS: Record<Row["status"], [string, string]> = { new: ["ส่งแล้ว", ""], seen: ["ทีมงานอ่านแล้ว", "warn"], done: ["ดำเนินการแล้ว", "ok"] };
const fmt = (s: string) => new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

export function Stars({ value, onChange, size = 30 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <span className="pp-stars" role={onChange ? "radiogroup" : undefined} aria-label={`${value} จาก 5 ดาว`}>
      {[1, 2, 3, 4, 5].map(n => onChange
        ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ดาว`} className={n <= value ? "on" : ""}
            style={{ fontSize: size }} onClick={() => onChange(n)}>★</button>
        : <span key={n} className={n <= value ? "on" : ""} style={{ fontSize: size }}>★</span>)}
    </span>
  );
}

// รีวิว / ข้อเสนอแนะ on the account page: pick a kind, write, send. Earlier messages and the team's replies are listed below.
export default function Feedback({ page = "account" }: { page?: string }) {
  const [kind, setKind] = useState<Kind>("review");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [pub, setPub] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const load = useCallback(() => { rpc<Row[]>("prep_my_feedback").then(setRows).catch(() => { /* list is optional */ }); }, []);
  useEffect(load, [load]);

  const ready = kind === "review" ? rating > 0 : body.trim().length > 0;
  const send = async () => {
    if (!ready || busy) return;
    setBusy(true); setMsg(null);
    try {
      await rpc("prep_feedback_submit", { p_kind: kind, p_rating: kind === "review" ? rating : null, p_body: body, p_public: kind === "review" && pub, p_page: page });
      setMsg({ ok: true, text: kind === "review" ? "ขอบคุณสำหรับรีวิวครับ 🙏" : "ได้รับแล้ว ขอบคุณครับ ทีมงานจะอ่านทุกข้อความ" });
      setBody(""); setRating(0); load();
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
    setBusy(false);
  };

  return (
    <div className="pp-card pp-fb">
      <h3>💬 รีวิว / ข้อเสนอแนะ</h3>
      <p className="pp-muted small">ทุกข้อความส่งถึงทีมงานโดยตรง ถ้าทีมงานตอบกลับ จะแจ้งในหน้านี้</p>
      <div className="pp-seg" role="tablist" aria-label="ประเภทข้อความ">
        {(Object.keys(KIND) as Kind[]).map(k => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => { setKind(k); setMsg(null); }}>
            {KIND[k].icon} {KIND[k].label}
          </button>
        ))}
      </div>
      {kind === "review" && (
        <div className="pp-fb-rate">
          <Stars value={rating} onChange={setRating} />
          <span className="pp-muted small">{rating ? ["", "ต้องปรับเยอะ", "พอใช้", "โอเค", "ดีมาก", "ชอบมาก!"][rating] : "แตะดาวเพื่อให้คะแนน"}</span>
        </div>
      )}
      <textarea className="pp-input" rows={4} maxLength={1000} placeholder={KIND[kind].hint} value={body} onChange={e => setBody(e.target.value)} />
      {kind === "review" && (
        <label className="pp-group-head">
          <input type="checkbox" checked={pub} onChange={e => setPub(e.target.checked)} />
          <span>ยินดีให้นำรีวิวนี้ไปแสดง (ไม่แสดงอีเมล)</span>
        </label>
      )}
      {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}
      <button className="pp-btn pp-btn-primary pp-wide" disabled={!ready || busy} onClick={send}>{busy ? "กำลังส่ง..." : "ส่ง"}</button>

      {rows.length > 0 && (
        <div className="pp-fb-mine">
          <b className="small">ที่เคยส่ง</b>
          {rows.map(r => (
            <div key={r.id} className="pp-myrep">
              <div className="pp-myrep-h">
                <span>{KIND[r.kind].icon}</span>
                {r.rating ? <Stars value={r.rating} size={14} /> : <span className="small">{KIND[r.kind].label}</span>}
                <span className={`pp-badge ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
                <span className="pp-muted small">{fmt(r.created_at)}</span>
              </div>
              {r.body && <div className="pp-myrep-q">{r.body}</div>}
              {r.admin_note && <div className="pp-myrep-note"><b>ทีมงาน:</b> {r.admin_note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
