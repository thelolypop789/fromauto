import { useEffect, useState } from "react";
import { setViewAs, type Me, type Profile } from "./api";
import { IconX } from "./icons";
import Stats from "./Stats";

// Full-screen, read-only copy of a user's analysis page for admins. Every call made while it is open carries the user's
// id (see setViewAs); practice buttons are hidden because the stand-in account below cannot create sets.
const READ_ONLY_ME = { plan: "free", free_sets_used: 1, free_sets_limit: 1 } as unknown as Me;

export default function AdminUserView({ user, onClose }: {
  user: { id: string; email: string; major: string | null; major_name: string | null; track?: string | null }; onClose: () => void;
}) {
  // Set before the first render of Stats so its very first calls already carry the header.
  const [ready] = useState(() => { setViewAs(user.id); return true; });
  useEffect(() => () => setViewAs(null), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const profile = { major: user.major, major_name: user.major_name, track: user.track === "vec" ? "vec" : "obec" } as Profile;
  return (
    <div className="pp-viewas" role="dialog" aria-modal="true" aria-label={`หน้าวิเคราะห์ของ ${user.email}`}>
      <div className="pp-viewas-bar">
        <div><b>กำลังดูหน้าวิเคราะห์ของ</b> {user.email}<span className="pp-viewas-tag">อ่านอย่างเดียว</span></div>
        <button className="pp-x" onClick={onClose} aria-label="ปิด"><IconX /></button>
      </div>
      <div className="pp-viewas-body pp-app">
        {ready && <Stats me={READ_ONLY_ME} profile={profile} onPractice={() => { /* read-only */ }} />}
      </div>
    </div>
  );
}
