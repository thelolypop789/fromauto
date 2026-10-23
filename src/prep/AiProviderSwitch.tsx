import { useEffect, useState } from "react";
import { rpc, thaiError } from "./api";

export type AiProvider = "gemini" | "deepseek";

// Gemini / DeepSeek switch for the AI writer, sub-topic tagger, report check and import (prep.gen_settings.ai_provider).
// Shown in แอดมิน → หมวดย่อยเอก and in แอดมิน → นำเข้า; both read and write the same setting.
export default function AiProviderSwitch({ onChange }: { onChange?: (p: AiProvider) => void }) {
  const [p, setP] = useState<AiProvider | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    rpc<string>("prep_ai_provider").then(v => { const x = v === "deepseek" ? "deepseek" : "gemini"; setP(x); onChange?.(x); })
      .catch(e => setError(thaiError(e)));
  }, [onChange]);
  const pick = async (x: AiProvider) => {
    if (busy || p === x) return;
    setBusy(true); setError("");
    try { await rpc("prep_admin_ai_provider_set", { p_provider: x }); setP(x); onChange?.(x); } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };
  return (
    <div className="pp-card">
      <h3>AI ที่ใช้</h3>
      <div className="pp-seg" role="radiogroup" aria-label="AI ที่ใช้">
        {(["gemini", "deepseek"] as const).map(x => (
          <button key={x} role="radio" aria-checked={p === x} className={p === x ? "on" : ""} disabled={busy || !p} onClick={() => pick(x)}>
            {x === "gemini" ? "Gemini" : "DeepSeek"}</button>
        ))}
      </div>
      <p className="pp-muted small">
        ใช้กับ AI เขียนข้อสอบ, จัดหมวดย่อย, ตรวจรายงาน และนำเข้าข้อสอบ (ปุ่ม "ตรวจด้วย AI" ใช้ DeepSeek เสมอ)
        {p === "deepseek" && " · DeepSeek อ่านได้แค่ข้อความ: นำเข้า PDF และรูปถ่ายไม่ได้ ส่วนรูปในไฟล์ Word จะถูกข้าม"}
      </p>
      {error && <div className="pp-error">{error}</div>}
    </div>
  );
}
