export type CalKind = "apply" | "exam" | "result" | "other";
export type CalEvent = { id: number; title: string; kind: CalKind; starts_on: string; ends_on: string | null; note: string | null; link: string | null; days_to: number };
export const KIND_LABEL: Record<CalKind, string> = { apply: "รับสมัคร", exam: "วันสอบ", result: "ประกาศผล", other: "อื่น ๆ" };

export const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const bkkToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
export const short = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });
export const full = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
export const when = (e: { starts_on: string; ends_on: string | null }) =>
  e.ends_on && e.ends_on !== e.starts_on ? `${short(e.starts_on)} – ${full(e.ends_on)}` : full(e.starts_on);
export const pad = (n: number) => String(n).padStart(2, "0");

export function status(e: CalEvent, today: string): string {
  const end = e.ends_on ?? e.starts_on;
  if (end < today) return "ผ่านแล้ว";
  if (e.starts_on <= today) return e.starts_on === end ? "วันนี้" : "กำลังดำเนินอยู่";
  return `อีก ${e.days_to} วัน`;
}

