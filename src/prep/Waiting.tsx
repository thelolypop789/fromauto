import { useEffect, useState } from "react";

// Loading spinner that never traps the user: after a few seconds it explains and offers a way out.
export default function Waiting() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, []);
  const reset = () => {
    try { localStorage.removeItem("fromauto-prep-auth"); } catch { /* storage blocked */ }
    window.location.reload();
  };
  return (
    <div className="pp-center">
      <div className="pp-spinner" />
      {slow && (
        <div className="pp-card" style={{ marginTop: 16, textAlign: "center" }}>
          <p className="pp-muted" style={{ margin: "0 0 12px" }}>โหลดนานกว่าปกติ อาจเป็นเพราะสัญญาณช้า ลองโหลดใหม่ก่อน</p>
          <button className="pp-btn pp-btn-primary" onClick={() => window.location.reload()}>โหลดใหม่</button>
          <button className="pp-link" onClick={reset} style={{ display: "block", margin: "12px auto 0" }}>ยังค้างอยู่? ล้างการเข้าสู่ระบบแล้วเข้าใหม่</button>
        </div>
      )}
    </div>
  );
}
