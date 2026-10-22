import { fixPatch, type ClaudeVerdict } from "./claudeVerdicts";

const L = ["ก", "ข", "ค", "ง"];
const LABEL = { ok: ["Claude: ถูกต้อง", "ok"], fix: ["Claude: ควรแก้", "warn"], hide: ["Claude: ควรซ่อน", "bad"] } as const;

export function ClaudeBox({ v, keyAnswer, onApply }: { v: ClaudeVerdict; keyAnswer: number; onApply: () => void }) {
  const [label, cls] = LABEL[v.verdict];
  const patch = fixPatch(v);
  const lowConf = v.confidence === "low";
  return (
    <div className={`pp-claude ${cls}`}>
      <div className="pp-claude-h">
        <b>{label}</b>
        {v.answer !== null && v.answer !== keyAnswer && <span className="pp-chip warn">Claude ตอบ {L[v.answer]} (เฉลย {L[keyAnswer]})</span>}
        {lowConf && <span className="pp-chip">ไม่แน่ใจ ควรตรวจเอกสาร</span>}
      </div>
      {v.issue && <p className="small">{v.issue}</p>}
      {Object.keys(patch).length > 0 && (
        <div className="small pp-claude-fix">
          {patch.stem && <div><b>โจทย์ใหม่:</b> {patch.stem}</div>}
          {patch.choices && <div><b>ตัวเลือกใหม่:</b> {patch.choices.map((c, i) => `${L[i]}) ${c}`).join(" · ")}</div>}
          {patch.answer !== undefined && <div><b>เฉลยใหม่:</b> {L[patch.answer]}</div>}
          {patch.explanation && <div><b>คำอธิบายใหม่:</b> {patch.explanation}</div>}
          <button className="pp-btn pp-btn-ghost sm" onClick={onApply}>ใส่คำแก้ของ Claude ลงในช่อง (ยังไม่บันทึก)</button>
        </div>
      )}
    </div>
  );
}
