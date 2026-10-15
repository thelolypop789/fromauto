import { useState } from "react";
import { Logo, IconDownload, IconX } from "./icons";
import { useInstall } from "./pwa";

const KEY = "pp-install-dismissed";

export default function InstallBanner({ always = false }: { always?: boolean }) {
  const { kind, install } = useInstall();
  const [hidden, setHidden] = useState(() => { try { return !always && localStorage.getItem(KEY) === "1"; } catch { return false; } });
  if (!kind || hidden) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } };
  return (
    <div className="pp-install">
      <Logo size={40} />
      <div className="pp-install-t">
        <b>ติดตั้งเป็นแอปบนเครื่อง</b>
        {kind === "prompt"
          ? "เปิดได้จากหน้าจอหลัก เต็มจอ ไม่ต้องพิมพ์ลิงก์"
          : <>กดปุ่ม <b style={{ display: "inline" }}>แชร์</b> ใน Safari แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”</>}
      </div>
      {kind === "prompt" && <button className="pp-btn pp-btn-gold" onClick={install}><IconDownload size={18} />ติดตั้ง</button>}
      {!always && <button className="pp-x" onClick={dismiss} aria-label="ปิด"><IconX /></button>}
    </div>
  );
}
