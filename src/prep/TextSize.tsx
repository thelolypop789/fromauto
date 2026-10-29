import { useState } from "react";
import { READ_STEPS, readScale, setReadScale } from "./readScale";

// A− / A+ for the question text. Sits in the question card header of every exam screen.
export default function TextSize() {
  const [v, setV] = useState(readScale);
  const i = READ_STEPS.indexOf(v);
  const step = (d: number) => { const n = READ_STEPS[Math.min(READ_STEPS.length - 1, Math.max(0, i + d))]; setV(n); setReadScale(n); };
  return (
    <span className="pp-tsize" role="group" aria-label="ขนาดตัวอักษรโจทย์">
      <button onClick={() => step(-1)} disabled={i <= 0} aria-label="ตัวอักษรเล็กลง">A−</button>
      <button onClick={() => step(1)} disabled={i >= READ_STEPS.length - 1} aria-label="ตัวอักษรใหญ่ขึ้น">A+</button>
    </span>
  );
}
