import { useState } from "react";
import { PACKAGE_LABEL, expiringSoon, fmtUntil, type Me } from "./api";

// Shown from 7 days before a round package ends, with a shortcut to renew.
export default function ExpiryBanner({ me, onRenew }: { me: Me; onRenew: () => void }) {
  const [now] = useState(() => Date.now());
  const list = expiringSoon(me, now);
  if (list.length === 0) return null;
  return (
    <div className="pp-note pp-expiry" role="status">
      {list.map(x => (
        <div key={x.package}>
          <b>{PACKAGE_LABEL[x.package]}</b> จะหมดอายุใน {x.left} วัน ({fmtUntil(x.expires_at)}) · ชุดที่สร้างจากแพ็กนี้จะทำต่อไม่ได้เมื่อหมดอายุ
        </div>
      ))}
      <button className="pp-btn pp-btn-gold" onClick={onRenew}>ต่ออายุ</button>
    </div>
  );
}
