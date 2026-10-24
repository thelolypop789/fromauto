import { useCallback, useEffect, useRef } from "react";

// Milliseconds since `key` (usually the question on screen) last changed. Used to log think time per answer.
export function useSinceShown(key: unknown) {
  const at = useRef(0);
  useEffect(() => { at.current = performance.now(); }, [key]);
  return useCallback(() => Math.round(performance.now() - at.current), []);
}
