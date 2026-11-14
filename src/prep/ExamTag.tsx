import { IconTrophy } from "./icons";

// แถบบอกว่าข้อนี้มาจากสนามสอบไหน (exam_tag เช่น "แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (จากผู้เข้าสอบ)")
// แสดงเต็มแถวบนหัวการ์ดโจทย์ทุกหน้าที่มีข้อสอบ (ชุดฝึก ข้อสอบเก่า ทวนข้อผิด สอบจำลอง ข้อสอบประจำวัน)
// วงเล็บท้ายแท็กเป็นที่มา แยกเป็นตัวเล็กบรรทัดเดียวกัน
export default function ExamTag({ tag }: { tag?: string | null }) {
  if (!tag) return null;
  const m = tag.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  const main = m ? m[1] : tag;
  const note = m ? m[2] : "";
  return (
    <div className="pp-q-tag" title={tag}>
      <IconTrophy size={16} />
      <span><b>{main}</b>{note && <small> · {note}</small>}</span>
    </div>
  );
}
