import { rpc, supabase } from "./api";

// One AI verdict per question (prep.ai_reviews: two Gemini models answer blind, Gemini Pro judges). The admin decides;
// a verdict never changes a question.
export type AiFix = { stem: string | null; choices: string[] | null; answer: number | null; explanation: string | null };
export type AiBlind = { answer: number | null; confidence: string; flags: string[]; note: string } | null;
export type AiVerdict = {
  verdict: "ok" | "fix" | "hide"; answer: number | null; issue: string | null; fix: AiFix | null; confidence?: string; model?: string;
  detail?: { blind?: Record<string, AiBlind> } | null;
};

export const AI_BATCH = 5;   // the Edge Function reviews at most 5 questions per call

export const loadVerdicts = (ids: number[]) =>
  ids.length ? rpc<Record<string, AiVerdict>>("prep_admin_ai_get", { p_ids: ids }) : Promise.resolve({});

// Reviews up to AI_BATCH questions; returns their verdicts keyed by id.
export async function reviewWithAi(ids: number[]): Promise<{ verdicts: Record<number, AiVerdict> }> {
  const { data, error } = await supabase.functions.invoke("prep-ai-review", { body: { ids: ids.slice(0, AI_BATCH) } });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* keep generic */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  const out: Record<number, AiVerdict> = {};
  for (const r of (data?.results ?? []) as (AiVerdict & { id: number })[]) out[r.id] = r;
  return { verdicts: out };
}

// The parts of a question that a "fix" verdict replaces, ready to merge into the edit form.
export function fixPatch(v: AiVerdict): Partial<{ stem: string; choices: string[]; answer: number; explanation: string }> {
  const f = v.fix;
  if (!f) return {};
  return {
    ...(f.stem ? { stem: f.stem } : {}),
    ...(f.choices ? { choices: f.choices } : {}),
    ...(f.answer !== null && f.answer !== undefined ? { answer: f.answer } : {}),
    ...(f.explanation ? { explanation: f.explanation } : {}),
  };
}
