import { useState } from "react";
import { Logo, IconDownload, IconX } from "./icons";
import InstallSheet from "./InstallSheet";
import { useInstall } from "./pwa";

const KEY = "pp-install-dismissed";

// Small card that opens the install sheet. Home can hide it; Account always shows it.
export default function InstallBanner({ always = false }: { always?: boolean }) {
  const { kind } = useInstall();
  const [sheet, setSheet] = useState(false);
  const [hidden, setHidden] = useState(() => { try { return !always && localStorage.getItem(KEY) === "1"; } catch { return false; } });
  if (!kind || hidden) return null;
  const dismiss = () => { setHidden(true); try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } };
  return (
    <div className="pp-install">
      <Logo size={40} />
      <div className="pp-install-t">
        <b>เพิ่มซ้อมสอบไว้บนหน้าจอโฮม</b>
        แตะไอคอนเดียวก็เข้าซ้อมได้ เต็มจอเหมือนแอป
      </div>
      <button className="pp-btn pp-btn-primary" onClick={() => setSheet(true)}><IconDownload size={18} />ติดตั้ง</button>
      {!always && <button className="pp-x" onClick={dismiss} aria-label="ปิด"><IconX /></button>}
      {sheet && <InstallSheet onClose={() => setSheet(false)} />}
    </div>
  );
}
