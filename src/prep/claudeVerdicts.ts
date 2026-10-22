import { rpc, supabase } from "./api";

// One Claude verdict per question (prep.claude_reviews). The admin decides; a verdict never changes a question.
export type ClaudeFix = { stem: string | null; choices: string[] | null; answer: number | null; explanation: string | null };
export type ClaudeVerdict = { verdict: "ok" | "fix" | "hide"; answer: number | null; issue: string | null; fix: ClaudeFix | null; confidence?: string; model?: string };

export const CLAUDE_BATCH = 10;   // the Edge Function reviews at most 10 questions per call

export const loadVerdicts = (ids: number[]) =>
  ids.length ? rpc<Record<string, ClaudeVerdict>>("prep_admin_claude_get", { p_ids: ids }) : Promise.resolve({});

// Reviews up to CLAUDE_BATCH questions; returns their verdicts keyed by id.
export async function reviewWithClaude(ids: number[]): Promise<Record<number, ClaudeVerdict>> {
  const { data, error } = await supabase.functions.invoke("prep-claude-review", { body: { ids: ids.slice(0, CLAUDE_BATCH) } });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* keep generic */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  const out: Record<number, ClaudeVerdict> = {};
  for (const r of (data?.results ?? []) as (ClaudeVerdict & { id: number })[]) out[r.id] = r;
  return out;
}

// The parts of a question that a "fix" verdict replaces, ready to merge into the edit form.
export function fixPatch(v: ClaudeVerdict): Partial<{ stem: string; choices: string[]; answer: number; explanation: string }> {
  const f = v.fix;
  if (!f) return {};
  return {
    ...(f.stem ? { stem: f.stem } : {}),
    ...(f.choices ? { choices: f.choices } : {}),
    ...(f.answer !== null && f.answer !== undefined ? { answer: f.answer } : {}),
    ...(f.explanation ? { explanation: f.explanation } : {}),
  };
}
