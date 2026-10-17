// Pure helpers for the Facebook page agent (no Deno / network here, so they can be unit-tested with node).

export const GRAPH = "https://graph.facebook.com/v21.0";

export type GraphError = { message: string; code?: number; error_subcode?: number; type?: string };
export type Explained = { message: string; tokenProblem: boolean; retryLater: boolean };

// Turns a Graph API failure into a short Thai message for the admin. tokenProblem = the page token no longer works
// (expired, revoked, missing permission): nothing will succeed until the admin makes a new one.
export function explainGraphError(status: number, err: GraphError | undefined): Explained {
  const code = err?.code;
  const detail = (err?.message ?? "").slice(0, 200);
  if (code === 190 || status === 401) {
    return { message: "Page token ใช้ไม่ได้ (หมดอายุ ถูกเพิกถอน หรือรหัสผ่านเปลี่ยน) ให้สร้าง token ใหม่แล้วอัปเดต FB_PAGE_TOKEN", tokenProblem: true, retryLater: false };
  }
  if (code === 200 || code === 10 || (code != null && code >= 200 && code < 300)) {
    return { message: `ไม่มีสิทธิ์โพสต์ (permission) ตรวจ pages_manage_posts / pages_manage_engagement: ${detail}`, tokenProblem: true, retryLater: false };
  }
  if (code === 4 || code === 17 || code === 32 || code === 613 || status === 429) {
    return { message: "Facebook จำกัดความถี่ (rate limit) รอสักพักแล้วลองใหม่", tokenProblem: false, retryLater: true };
  }
  if (code === 368) {
    return { message: "Facebook บล็อกการโพสต์ชั่วคราวเพราะเข้าข่ายสแปม ตรวจที่เพจแล้วรอก่อน", tokenProblem: false, retryLater: true };
  }
  if (code === 1 || code === 2 || status >= 500) {
    return { message: "Facebook ขัดข้องชั่วคราว: " + detail, tokenProblem: false, retryLater: true };
  }
  return { message: `Facebook ปฏิเสธคำขอ (${code ?? status}): ${detail}`, tokenProblem: false, retryLater: false };
}

// Storage paths the admin saved are checked again here before they are used to read a private object.
export function safePath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(p) || p.includes("..") || p.startsWith("/")) return null;
  return p;
}

export function mimeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/png";
}

// A Facebook caption / comment is plain text. Collapse runs of blank lines and trim; never send empty text.
export function cleanText(s: unknown): string {
  return String(s ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
