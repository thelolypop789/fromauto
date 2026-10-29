import { useState } from "react";
import { getTheme, setTheme, type Theme } from "./theme";

const OPTIONS: [Theme, string][] = [["system", "ตามเครื่อง"], ["light", "สว่าง"], ["dark", "มืด"]];

// "ธีม" on the ฉัน page.
export default function ThemePicker() {
  const [t, setT] = useState<Theme>(getTheme);
  return (
    <div className="pp-card pp-theme">
      <b>ธีมสี</b>
      <div className="pp-seg" role="radiogroup" aria-label="ธีมสี">
        {OPTIONS.map(([k, label]) => (
          <button key={k} role="radio" aria-checked={t === k} className={t === k ? "on" : ""} onClick={() => { setT(k); setTheme(k); }}>{label}</button>
        ))}
      </div>
      <p className="pp-muted small">โหมดมืดช่วยถนอมสายตาเวลาอ่านตอนกลางคืน · "ตามเครื่อง" เปลี่ยนตามการตั้งค่าของโทรศัพท์</p>
    </div>
  );
}
