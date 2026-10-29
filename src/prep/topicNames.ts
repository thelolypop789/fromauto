import { useEffect, useState } from "react";
import { rpc, type Topic } from "./api";

// Thai names for topic codes ("B1-EVAL" → "การวัดและประเมินผล"), shown on the question chip. Loaded once per page;
// until it arrives, or for a code it does not list, the chip shows nothing rather than the internal code.
let cache: Promise<Record<string, string>> | null = null;
const load = () => (cache ??= rpc<Topic[]>("prep_topics")
  .then(ts => Object.fromEntries(ts.map(t => [t.code, t.name])))
  .catch(() => { cache = null; return {}; }));

export function useTopicNames() {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => { let live = true; load().then(n => { if (live) setNames(n); }); return () => { live = false; }; }, []);
  return names;
}
