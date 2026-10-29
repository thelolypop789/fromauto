import { useEffect, useState } from "react";
import { track } from "./api";

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
    const register = () => navigator.serviceWorker.register("/prep-sw.js", { scope: "/prep" }).then(reg => {
      // A worker installed while this page already had one means a new deploy: the page still runs the old build.
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => { if (sw.state === "activated" && hadController) { updateReady = true; updateListeners.forEach(f => f()); } });
      });
      // An installed app can stay open for days: look for a new deploy whenever it comes back to the foreground.
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => { /* offline */ }); });
    }).catch(() => { /* app still works online */ });
    const hadController = !!navigator.serviceWorker.controller;
    if (document.readyState === "complete") register(); else window.addEventListener("load", register, { once: true });
  }
}

let updateReady = false;
const updateListeners = new Set<() => void>();
// True once a newer build has been installed while this page was open; the app offers a reload.
export function useUpdateReady() {
  const [ready, setReady] = useState(updateReady);
  useEffect(() => {
    const f = () => setReady(true);
    updateListeners.add(f);
    return () => { updateListeners.delete(f); };
  }, []);
  return ready;
}

// Online/offline state for the "no connection" strip.
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

// Number on the installed app's icon: questions waiting for today's review (Badging API; ignored where unsupported).
export function setAppBadge(n: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try { (n > 0 ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => { /* not allowed */ }); } catch { /* unsupported */ }
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach(f => f()); });
window.addEventListener("appinstalled", () => { deferred = null; track("install_done"); listeners.forEach(f => f()); });

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

// Facebook, Messenger, Instagram, LINE and TikTok open links in their own browser, which cannot install apps.
export const isInApp = () => /FBAN|FBAV|FB_IAB|Instagram|Line\/|musical_ly|Bytedance|TikTok/i.test(navigator.userAgent);

export const isLineApp = () => /Line\//i.test(navigator.userAgent);
export const isAndroid = () => /android/i.test(navigator.userAgent);
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// "prompt": Chrome/Edge/Android can show the native install dialog.
// "ios": Safari needs manual Share → Add to Home Screen.
// "inapp": opened inside Facebook/LINE etc.; the user must open the page in Safari or Chrome first.
// null: already installed or not installable.
export type InstallKind = "prompt" | "ios" | "inapp" | null;

export function useInstall() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const f = () => rerender(n => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  const kind: InstallKind = isStandalone() ? null : deferred ? "prompt" : isInApp() ? "inapp" : isIos() ? "ios" : null;
  const install = async () => {
    if (!deferred) return false;
    track("install_click");
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    listeners.forEach(f => f());
    return outcome === "accepted";
  };
  return { kind, install };
}

// Install sheet (InstallSheet.tsx): how often it may open by itself.
const KEY = "pp-install-sheet";       // { n: times dismissed, at: last dismissed (ms) }
const FIRST_DELAY = 1500, AUTO_DELAY = 4000, RETRY = 1500;
const SNOOZE_DAYS = 3, MAX_DISMISS = 3;

type Seen = { n: number; at: number };
export const readSeen = (): Seen => { try { return { n: 0, at: 0, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { n: 0, at: 0 }; } };
export const writeSeen = (s: Seen) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };

// Opens the sheet by itself on Home for everyone who has not installed the app: 1.5 s in on the first visit, 4 s on later
// ones; at most once per SNOOZE_DAYS after a "later", and never after MAX_DISMISS of them. If another dialog is open
// (the major or track picker), it waits until that one closes.
export function useAutoInstallSheet() {
  const { kind } = useInstall();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!kind) return;
    const s = readSeen();
    if (s.n >= MAX_DISMISS || Date.now() - s.at < SNOOZE_DAYS * 864e5) return;
    let id = 0;
    const tryOpen = () => {
      if (document.querySelector(".pp-modal") || document.visibilityState === "hidden") id = window.setTimeout(tryOpen, RETRY);
      else setOpen(true);
    };
    id = window.setTimeout(tryOpen, s.at === 0 ? FIRST_DELAY : AUTO_DELAY);
    return () => window.clearTimeout(id);
  }, [kind]);
  return { open, setOpen };
}
