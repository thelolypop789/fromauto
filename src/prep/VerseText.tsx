import { Fragment } from "react";

// โจทย์/ตัวเลือกที่มีคำประพันธ์เก็บเป็นข้อความธรรมดา: ขึ้นบรรทัดตามบาท/วรรค ("\n"), เว้นระหว่างวรรคด้วยช่องว่าง 3 ตัวขึ้นไป,
// และโจทย์แยกคำถามกับบทประพันธ์ด้วยบรรทัดว่าง ที่นี่ทำให้แต่ละวรรคเป็นก้อนเดียว (inline-block) จอแคบจึงขึ้นบรรทัดใหม่
// ตรงช่องว่างระหว่างวรรค ไม่ใช่กลางวรรค ข้อความทั่วไปที่ไม่มีโครงนี้แสดงเหมือนเดิม
function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && "\n"}
          {/* ย่อหน้า (วรรคที่สองของบาทกลอน) เป็นระยะเว้นของตัววรรคเอง จึงไม่ถูกแยกออกจากวรรคเมื่อจอแคบ */}
          {line.replace(/^ {3,}/, "").split(/( {3,})/).map((seg, k) => (seg === "" || /^ +$/.test(seg) ? seg
            : <span key={k} className={k === 0 && /^ {3,}/.test(line) ? "pp-varak in" : "pp-varak"}>{seg}</span>))}
        </Fragment>
      ))}
    </>
  );
}

export default function VerseText({ text, stem = false }: { text: string; stem?: boolean }) {
  if (!text.includes("\n")) return <>{text}</>;
  const cut = stem ? text.indexOf("\n\n") : -1;
  if (cut < 0) return <Lines text={text} />;
  return <>{text.slice(0, cut)}{"\n\n"}<span className="pp-verse"><Lines text={text.slice(cut + 2)} /></span></>;
}
