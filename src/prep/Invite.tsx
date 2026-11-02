import { useEffect, useState } from "react";
import { rpc, track } from "./api";
import { notify } from "./dialog";

type Ref = { code: string; invited: number; rewarded: number; cap: number; bonus: number };

// Invite a friend: a personal link (?ref=CODE&src=ref). When the friend signs up through it and finishes a first set, both
// get one more free set (the inviter at most `cap` times). Users who came by word of mouth bought 3–4× as often as ad
// traffic (fb-indart 32%, tt-bio 23% vs fb-ad2 7%, Oct 2026), so this card asks the people who like the app to share it.
export default function Invite({ paid }: { paid: boolean }) {
  const [r, setR] = useState<Ref | null>(null);
  useEffect(() => { rpc<Ref>("prep_my_referral").then(setR).catch(() => { /* card hidden */ }); }, []);
  if (!r) return null;
  const url = `${location.origin}/prep?ref=${r.code}&src=ref`;
  const text = "ซ้อมข้อสอบครูผู้ช่วยด้วยกันไหม มีเฉลยทุกข้อ ฝึกฟรีได้เลย";

  const share = async () => {
    track("ref_share");
    try {
      if (navigator.share) { await navigator.share({ title: "SOBPREP ซ้อมสอบครูผู้ช่วย", text, url }); return; }
    } catch { return; /* closed the share sheet */ }
    try { await navigator.clipboard.writeText(`${text} ${url}`); notify("คัดลอกลิงก์แล้ว"); } catch { notify(url); }
  };
  const line = `https://line.me/R/msg/text/?${encodeURIComponent(`${text} ${url}`)}`;

  return (
    <div className="pp-card">
      <h3>ชวนเพื่อนมาซ้อมด้วยกัน</h3>
      <p className="pp-muted small">
        {paid
          ? "ส่งลิงก์นี้ให้เพื่อนที่เตรียมสอบ เพื่อนได้ชุดฟรีเพิ่ม 1 ชุดเมื่อทำชุดแรกเสร็จ"
          : "เพื่อนสมัครผ่านลิงก์นี้แล้วทำชุดแรกเสร็จ ได้ชุดฟรีเพิ่มคนละ 1 ชุดทั้งคุณและเพื่อน"}
      </p>
      <div className="pp-row">
        <button className="pp-btn pp-btn-primary" onClick={share}>แชร์ลิงก์ชวนเพื่อน</button>
        <a className="pp-btn pp-btn-outline" href={line} target="_blank" rel="noopener noreferrer" onClick={() => track("ref_share")}>ส่งทาง LINE</a>
      </div>
      <p className="pp-muted small">
        โค้ดของคุณ <b>{r.code}</b> · ชวนแล้ว {r.invited} คน · เริ่มซ้อมแล้ว {r.rewarded} คน
        {!paid && r.bonus > 0 ? ` · ได้ชุดฟรีเพิ่มแล้ว ${r.bonus} ชุด` : ""}
        {r.rewarded >= r.cap ? ` (รับชุดฟรีจากการชวนครบ ${r.cap} ครั้งแล้ว)` : ""}
      </p>
    </div>
  );
}
