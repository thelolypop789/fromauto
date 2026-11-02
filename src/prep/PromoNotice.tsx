import { useEffect, useState } from "react";
import { rpc } from "./api";
import { IconCrown } from "./icons";

type Notice = { id: number; title: string; body: string } | null;

// A message from the team to free users who used up their free sets (แอดมิน: prep_admin_winback). Shown on Home until
// the user opens the packages or closes it; account-page notifications alone were seen by too few.
export default function PromoNotice({ onUpgrade }: { onUpgrade: () => void }) {
  const [n, setN] = useState<Notice>(null);
  useEffect(() => { rpc<Notice>("prep_my_promo_notice").then(setN).catch(() => { /* hidden */ }); }, []);
  if (!n) return null;
  const close = () => { rpc("prep_dismiss_notice", { p_id: n.id }).catch(() => { /* shown again next time */ }); setN(null); };
  return (
    <div className="pp-card pp-wall">
      <h3>{n.title}</h3>
      <p style={{ whiteSpace: "pre-line" }}>{n.body}</p>
      <div className="pp-row">
        <button className="pp-btn pp-btn-gold" onClick={() => { close(); onUpgrade(); }}><IconCrown size={20} />ดูแพ็ก</button>
        <button className="pp-btn pp-btn-ghost" onClick={close}>ไว้ทีหลัง</button>
      </div>
    </div>
  );
}
