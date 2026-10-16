import { useEffect, useState } from "react";
import { PACKAGE_LABEL, fmtUntil, inboxTerm, rpc, thaiError, type InboxItem } from "./api";

// Packages the team sent to this account's e-mail. One tap activates them; no key is typed.
export default function MyInbox({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [busy, setBusy] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { rpc<InboxItem[]>("prep_my_inbox").then(setItems).catch(() => { /* optional */ }); }, []);

  const claim = async (i: InboxItem) => {
    if (busy) return;
    setBusy(i.id); setMsg(null);
    try {
      const r = await rpc<{ package: InboxItem["package"]; expires_at: string | null }>("prep_claim_inbox", { p_id: i.id });
      setItems(prev => prev.filter(x => x.id !== i.id));
      setMsg({ ok: true, text: `เปิดใช้งานสำเร็จ ${PACKAGE_LABEL[r.package]} · ${fmtUntil(r.expires_at)}` });
      onChanged();
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
    setBusy(0);
  };

  if (items.length === 0 && !msg) return null;
  return (
    <div className="pp-card pp-inbox" role="status">
      {items.map(i => (
        <div key={i.id} className="pp-inbox-item">
          <div>
            <b>ทีมงานส่งแพ็กให้คุณ: {PACKAGE_LABEL[i.package]}</b>
            <div className="pp-muted small">{inboxTerm(i)}</div>
            {i.message && <div className="small">“{i.message}”</div>}
          </div>
          <button className="pp-btn pp-btn-gold" disabled={busy === i.id} onClick={() => claim(i)}>{busy === i.id ? "กำลังเปิด..." : "เปิดใช้งาน"}</button>
        </div>
      ))}
      {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}
    </div>
  );
}
