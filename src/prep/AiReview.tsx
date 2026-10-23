import { fixPatch, type AiVerdict } from "./aiVerdicts";

const L = ["ก", "ข", "ค", "ง"];
const LABEL = { ok: ["AI: ถูกต้อง", "ok"], fix: ["AI: ควรแก้", "warn"], hide: ["AI: ควรซ่อน", "bad"] } as const;

export function AiBox({ v, keyAnswer, onApply }: { v: AiVerdict; keyAnswer: number; onApply: () => void }) {
  const [label, cls] = LABEL[v.verdict];
  const patch = fixPatch(v);
  const lowConf = v.confidence === "low";
  return (
    <div className={`pp-aiv ${cls}`}>
      <div className="pp-aiv-h">
        <b>{label}</b>
        {Object.entries(v.detail?.blind ?? {}).map(([who, b]) => (
          <span key={who} className={`pp-chip ${b && b.answer === keyAnswer ? "ok" : "warn"}`} title={b?.note ?? ""}>
            {who} {b ? (b.answer === null ? "ไม่มีข้อถูก" : `ตอบ ${L[b.answer]}`) : "ไม่ได้ตอบ"}
          </span>
        ))}
        {lowConf && <span className="pp-chip">ไม่แน่ใจ ควรตรวจเอกสาร</span>}
      </div>
      {v.issue && <p className="small">{v.issue}</p>}
      {Object.keys(patch).length > 0 && (
        <div className="small pp-aiv-fix">
          {patch.stem && <div><b>โจทย์ใหม่:</b> {patch.stem}</div>}
          {patch.choices && <div><b>ตัวเลือกใหม่:</b> {patch.choices.map((c, i) => `${L[i]}) ${c}`).join(" · ")}</div>}
          {patch.answer !== undefined && <div><b>เฉลยใหม่:</b> {L[patch.answer]}</div>}
          {patch.explanation && <div><b>คำอธิบายใหม่:</b> {patch.explanation}</div>}
          <button className="pp-btn pp-btn-ghost sm" onClick={onApply}>ใส่คำแก้ของ AI ลงในช่อง (ยังไม่บันทึก)</button>
        </div>
      )}
    </div>
  );
}
