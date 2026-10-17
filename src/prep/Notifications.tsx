import { useEffect, useState } from "react";
import { rpc } from "./api";
import { IconCheck } from "./icons";

type Item = { id: number; kind: string; title: string; body: string; created_at: string; read: boolean; stem: string | null };
const fmt = (s: string) => new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Messages from the team about the reports the user sent (shown on the account page). Opening this card marks them read.
export default function Notifications({ onRead }: { onRead: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let alive = true;
    rpc<{ unread: number; items: Item[] }>("prep_my_notifications").then(r => {
      if (!alive) return;
      setItems(r.items);
      if (r.unread > 0) rpc("prep_mark_notifications_read").then(onRead).catch(() => { /* stays unread; shown again next time */ });
    }).catch(() => { /* the account page works without this section */ });
    return () => { alive = false; };
  }, [onRead]);

  if (!items || items.length === 0) return null;
  return (
    <div className="pp-card">
      <h3><IconCheck size={16} /> ข่าวจากทีมงาน</h3>
      {items.map(n => (
        <div key={n.id} className={`pp-notif ${n.read ? "" : "new"}`}>
          <div className="pp-notif-h"><b>{n.title}</b>{!n.read && <span className="pp-badge warn">ใหม่</span>}<span className="pp-muted small">{fmt(n.created_at)}</span></div>
          {n.stem && <div className="pp-muted small pp-notif-q">ข้อ: {n.stem}</div>}
          <div className="pp-notif-b">{n.body}</div>
        </div>
      ))}
    </div>
  );
}
