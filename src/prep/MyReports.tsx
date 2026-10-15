import { useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import { IconFlag } from "./icons";

type Row = { id: number; question_id: number; stem: string; topic: string; reason: string; status: "open" | "fixed" | "rejected"; admin_note: string | null; created_at: string; resolved_at: string | null };
const STATUS: Record<Row["status"], [string, string]> = {
  open: ["รอตรวจสอบ", "warn"], fixed: ["แก้ไขแล้ว", "ok"], rejected: ["ตรวจแล้ว ข้อนี้ถูกต้อง", ""],
};
const fmt = (s: string) => new Date(s).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

export default function MyReports() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { rpc<Row[]>("prep_my_reports").then(setRows).catch(e => setError(thaiError(e))); }, []);

  if (error) return null;           // the account page still works without this section
  if (!rows || rows.length === 0) return null;
  return (
    <div className="pp-card">
      <h3><IconFlag size={16} /> รายงานของฉัน</h3>
      {rows.map(r => (
        <div key={r.id} className="pp-myrep">
          <div className="pp-myrep-h">
            <span className={`pp-badge ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
            <span className="pp-muted small">{r.topic} · {fmt(r.created_at)}</span>
          </div>
          <div className="pp-myrep-q">{r.stem}</div>
          <div className="pp-muted small">{r.reason}</div>
          {r.admin_note && <div className="pp-myrep-note"><b>ทีมงาน:</b> {r.admin_note}</div>}
        </div>
      ))}
    </div>
  );
}
