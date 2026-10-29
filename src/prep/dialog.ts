// In-app replacements for alert() / confirm(). The browser's own dialogs show the site address, look out of place in
// the installed app and can be suppressed on iOS. ask() resolves true on the confirm button, false on cancel, the
// backdrop, Escape or the back button; notify() shows a short message above the bottom bar. DialogHost.tsx renders them.
export type Ask = { title: string; body?: string; ok?: string; cancel?: string; danger?: boolean };
export type Pending = Ask & { resolve: (v: boolean) => void };

export const state: { pending: Pending | null; toast: { text: string; id: number } | null } = { pending: null, toast: null };
export const listeners = new Set<() => void>();
export const emit = () => listeners.forEach(f => f());

export function ask(a: Ask): Promise<boolean> {
  state.pending?.resolve(false);
  return new Promise(resolve => { state.pending = { ...a, resolve }; emit(); });
}

let toastId = 0;
export function notify(text: string) {
  const id = ++toastId;
  state.toast = { text, id };
  emit();
  window.setTimeout(() => { if (state.toast?.id === id) { state.toast = null; emit(); } }, 4500);
}

