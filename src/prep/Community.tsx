import { COMMUNITY } from "./config";

// ปุ่มเข้ากลุ่มเตรียมสอบ by SOBPREP (Facebook group / LINE OpenChat) — ไม่แสดงอะไรถ้ายังไม่ได้ใส่ลิงก์ใน config.ts
export const hasCommunity = !!(COMMUNITY.facebook || COMMUNITY.openchat);

export function CommunityLinks({ title }: { title?: string }) {
  if (!hasCommunity) return null;
  return (
    <div className="pp-community">
      {title && <b>{title}</b>}
      <div className="pp-row">
        {COMMUNITY.facebook && <a className="pp-btn pp-btn-outline" href={COMMUNITY.facebook} target="_blank" rel="noopener">กลุ่ม Facebook</a>}
        {COMMUNITY.openchat && <a className="pp-btn pp-btn-outline" href={COMMUNITY.openchat} target="_blank" rel="noopener">LINE OpenChat</a>}
      </div>
    </div>
  );
}

export default function CommunityCard() {
  if (!hasCommunity) return null;
  return (
    <div className="pp-card">
      <h3>กลุ่มเตรียมสอบ by SOBPREP</h3>
      <p className="pp-muted small">คุยกับเพื่อนที่สอบสนามเดียวกัน แชร์ข่าวประกาศ เทคนิค และกำลังใจ</p>
      <CommunityLinks />
    </div>
  );
}
