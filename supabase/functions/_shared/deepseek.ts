// DeepSeek fallback for the prep functions that were written for Gemini. Which one runs is a switch in the admin
// (แอดมิน → ข้อสอบ → หมวดย่อยเอก → "AI ที่ใช้"), stored in prep.gen_settings.ai_provider and read with public.prep_ai_provider().
// Secret: DEEPSEEK_API_KEY. Optional: DEEPSEEK_FAST_MODEL (default deepseek-flash), DEEPSEEK_STRONG_MODEL
// (default deepseek-v4-pro). DeepSeek has no response schema, so the Gemini schema is put in the system prompt as JSON.
// It reads text only: callers must not send PDFs or images here.

export type Provider = "gemini" | "deepseek";

// deno-lint-ignore no-explicit-any
export async function aiProvider(sb: any): Promise<Provider> {
  const { data } = await sb.rpc("prep_ai_provider");
  return data === "deepseek" ? "deepseek" : "gemini";
}

export const DEEPSEEK_FAST = Deno.env.get("DEEPSEEK_FAST_MODEL") || "deepseek-flash";
export const DEEPSEEK_STRONG = Deno.env.get("DEEPSEEK_STRONG_MODEL") || "deepseek-v4-pro";

// Key, balance and quota problems: every retry would fail the same way, so callers stop and show the message.
export class DeepSeekFatal extends Error {}

export function parseJsonLoose(text: string): Record<string, unknown> {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { /* fall through */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("ตอบไม่เป็น JSON");
  return JSON.parse(t.slice(a, b + 1));
}

// One JSON answer. Retries on 429/5xx/timeouts and once more when the reply is not valid JSON.
export async function deepseekJson(
  model: string, prompt: string, schema: unknown,
  opts: { temperature?: number; maxTokens?: number; thinking?: boolean; timeoutMs?: number } = {},
): Promise<{ data: Record<string, unknown>; text: string; model: string; truncated: boolean }> {
  const key = Deno.env.get("DEEPSEEK_API_KEY");
  if (!key) throw new DeepSeekFatal("ยังไม่ได้ตั้งค่า DEEPSEEK_API_KEY ใน Supabase (Edge Functions → Secrets)");
  const system = "ตอบเป็น JSON object เพียงก้อนเดียว ไม่มีข้อความอื่นนอก JSON และให้ตรงกับโครงสร้าง (JSON Schema) นี้:\n"
    + JSON.stringify(schema);
  const body = JSON.stringify({
    model, stream: false, max_tokens: opts.maxTokens ?? 16000, temperature: opts.temperature ?? 0,
    ...(opts.thinking ? { thinking: { type: "enabled" } } : { thinking: { type: "disabled" } }),
    messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
  });
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 110_000),
      });
    } catch (e) { last = `${model}: ${(e as Error).message}`; continue; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.error?.message ?? data?.message ?? res.statusText);
      if (res.status === 401 || res.status === 403) throw new DeepSeekFatal(`คีย์ DeepSeek ใช้งานไม่ได้ — ตรวจ DEEPSEEK_API_KEY (${msg})`);
      if (res.status === 402 || /insufficient|balance|quota/i.test(msg)) throw new DeepSeekFatal(`เครดิต DeepSeek หมด — เติมเงินที่ platform.deepseek.com (${msg})`);
      last = `${model}: ${res.status} ${msg}`;
      if (res.status === 429 || res.status >= 500) continue;
      throw new Error(last);
    }
    const choice = data?.choices?.[0];
    const text = String(choice?.message?.content ?? "");
    try {
      return { data: parseJsonLoose(text), text, model: String(data.model || model), truncated: choice?.finish_reason === "length" };
    } catch { last = `${model}: ตอบไม่เป็น JSON${choice?.finish_reason === "length" ? " (ยาวเกิน)" : ""}`; }
  }
  throw new Error("DeepSeek ไม่ตอบ: " + last);
}
