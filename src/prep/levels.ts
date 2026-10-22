// Fire-themed levels for the mascot. XP comes from prep_progress (answers + correct + daily quiz + mock exams).
export const LEVELS = [
  { at: 0, name: "ไฟจุดใหม่" },
  { at: 50, name: "ประกายไฟ" },
  { at: 150, name: "ไฟเริ่มติด" },
  { at: 300, name: "ไฟอุ่น" },
  { at: 600, name: "ไฟลุก" },
  { at: 1000, name: "ไฟลุกโชน" },
  { at: 1600, name: "ไฟแรงสูง" },
  { at: 2500, name: "เปลวทอง" },
  { at: 4000, name: "เปลวเพลิงครู" },
  { at: 6000, name: "ไฟนิรันดร์" },
];
const STEP_AFTER = 3000;   // past the last named level: one more level every 3,000 XP

export type Level = { no: number; name: string; from: number; to: number; xp: number };

export function levelOf(xp: number): Level {
  const last = LEVELS.length - 1;
  if (xp >= LEVELS[last].at) {
    const extra = Math.floor((xp - LEVELS[last].at) / STEP_AFTER);
    const from = LEVELS[last].at + extra * STEP_AFTER;
    return { no: LEVELS.length + extra, name: LEVELS[last].name, from, to: from + STEP_AFTER, xp };
  }
  const i = LEVELS.findIndex((l, k) => xp >= l.at && xp < LEVELS[k + 1].at);
  return { no: i + 1, name: LEVELS[i].name, from: LEVELS[i].at, to: LEVELS[i + 1].at, xp };
}
