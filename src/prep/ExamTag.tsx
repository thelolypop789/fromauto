import { IconTrophy } from "./icons";

// การ์ดเล็กบอกว่าข้อนี้มาจากสนามสอบไหน (exam_tag เช่น "แนวข้อสอบ ครูผู้ช่วย สพฐ. รอบทั่วไป 2569 (จากผู้เข้าสอบ)",
// "แนวข้อสอบ สอศ. 2567 (หลักสูตรใหม่)") แสดงบนหัวการ์ดโจทย์ทุกหน้าที่มีข้อสอบ
// (ชุดฝึก ข้อสอบเก่า ทวนข้อผิด สอบจำลอง ข้อสอบประจำวัน) — บรรทัดเล็ก "แนวข้อสอบ · หมายเหตุในวงเล็บ" บรรทัดใหญ่ชื่อสนามสอบกับปี
export default function ExamTag({ tag }: { tag?: string | null }) {
  if (!tag) return null;
  const m = tag.match(/^(?:แนวข้อสอบ\s*)?(.*?)\s*(?:\(([^()]*)\))?\s*$/);
  const exam = m?.[1] || tag;
  const note = m?.[2];
  return (
    <div className="pp-q-tagrow">
      <div className="pp-q-tag" title={tag}>
        <span className="pp-q-tag-ico"><IconTrophy size={15} /></span>
        <span className="pp-q-tag-t">
          <small>แนวข้อสอบ{note ? ` · ${note}` : ""}</small>
          <b>{exam}</b>
        </span>
      </div>
    </div>
  );
}
