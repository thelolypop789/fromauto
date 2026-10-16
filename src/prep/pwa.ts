import { useEffect, useState } from "react";

// index.html is shared with the teacher app, so /prep adds its own PWA tags at runtime.
// Browsers read these when the user installs, so adding them after load is fine.
const THEME = "#6E1423";

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

function setLink(rel: string, href: string, extra: Record<string, string> = {}) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement("link"); el.rel = rel; document.head.appendChild(el); }
  el.href = href;
  Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
}

export function setupPwa() {
  setLink("manifest", "/prep-manifest.webmanifest");
  setLink("icon", "/prep-icons/favicon-32.png", { type: "image/png" });
  setLink("apple-touch-icon", "/prep-icons/apple-touch-icon.png");
  setMeta("theme-color", THEME);
  setMeta("mobile-web-app-capable", "yes");
  setMeta("apple-mobile-web-app-capable", "yes");
  setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  setMeta("apple-mobile-web-app-title", "ซ้อมสอบ");
  setMeta("viewport", "width=device-width, initial-scale=1.0, viewport-fit=cover");

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    // This module loads lazily, usually after the window "load" event has already fired.
    const register = () => navigator.serviceWorker.register("/prep-sw.js", { scope: "/prep" }).catch(() => { /* app still works online */ });
    if (document.readyState === "complete") register(); else window.addEventListener("load", register, { once: true });
  }
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach(f => f()); });
window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach(f => f()); });

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// "prompt": Chrome/Edge/Android can show the native install dialog.
// "ios": Safari needs manual Share → Add to Home Screen.
// null: already installed or not installable.
export function useInstall() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const f = () => rerender(n => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  const kind: "prompt" | "ios" | null = isStandalone() ? null : deferred ? "prompt" : isIos() ? "ios" : null;
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    listeners.forEach(f => f());
  };
  return { kind, install };
}
