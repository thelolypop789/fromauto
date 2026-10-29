import { useEffect, useRef, useState } from "react";

// A small history router for /prep. Every screen has its own URL, so the phone's back button and swipe go back one
// screen instead of leaving the app, a refresh stays on the same screen, and a screen can be linked to (manifest
// shortcuts, shared links). vercel.json already serves prep.html for every /prep/* path.
const EVENT = "pp-nav";

// Each entry the app pushes records how many app screens lie behind it (d), so an in-app "back" button can step back
// through history like the phone's back key, and only falls back to a fixed screen when the page was opened directly.
type Entry = { d?: number; dialog?: string } | null;
const depth = () => (history.state as Entry)?.d ?? 0;

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (path === location.pathname + location.search) return;
  if (opts.replace) history.replaceState({ d: depth() }, "", path); else history.pushState({ d: depth() + 1 }, "", path);
  window.dispatchEvent(new Event(EVENT));
}

export function goBack(fallback: string) {
  if (depth() > 0) history.back(); else navigate(fallback, { replace: true });
}

// The current path, updated on navigate() and on back/forward.
export function usePath() {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => {
    const f = () => setPath(location.pathname);
    window.addEventListener("popstate", f); window.addEventListener(EVENT, f);
    return () => { window.removeEventListener("popstate", f); window.removeEventListener(EVENT, f); };
  }, []);
  return path;
}

// While a dialog is open, the back button closes it instead of leaving the screen: opening adds a history entry with
// the same URL, back pops it and calls onClose. Closing it any other way removes that entry again, unless the user
// has moved on to another screen meanwhile (then the leftover entry has the same URL as the screen under the dialog).
let seq = 0;
export function useBackClose(onClose: () => void, enabled = true) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    if (!enabled) return;
    const token = `pp-dialog-${++seq}`;
    let popped = false, pushed = false;
    const onPop = () => { if ((history.state as Entry)?.dialog !== token) { popped = true; window.removeEventListener("popstate", onPop); close.current(); } };
    // Deferred so a mount that is undone straight away (React StrictMode in development) never touches history.
    const id = window.setTimeout(() => {
      history.pushState({ d: depth() + 1, dialog: token }, "", location.href);
      pushed = true;
      window.addEventListener("popstate", onPop);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("popstate", onPop);
      if (pushed && !popped && (history.state as Entry)?.dialog === token) history.back();
    };
  }, [enabled]);
}
