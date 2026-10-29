import { useEffect, useRef, useState } from "react";
import { useBackClose } from "./router";
import { useOnline, useUpdateReady } from "./pwa";
import { listeners, emit, state, type Pending } from "./dialog";

function AskDialog({ p }: { p: Pending }) {
  const box = useRef<HTMLDivElement>(null);
  const done = (v: boolean) => { if (state.pending === p) { state.pending = null; emit(); } p.resolve(v); };
  useBackClose(() => done(false));
  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>(".pp-ask-ok")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") done(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="pp-modal pp-ask" role="alertdialog" aria-modal="true" aria-labelledby="pp-ask-h" onClick={() => done(false)}>
      <div className="pp-modal-box" ref={box} onClick={e => e.stopPropagation()}>
        <h3 id="pp-ask-h">{p.title}</h3>
        {p.body && <p>{p.body}</p>}
        <div className="pp-ask-btns">
          {p.cancel !== "" && <button className="pp-btn pp-btn-ghost" onClick={() => done(false)}>{p.cancel ?? "ยกเลิก"}</button>}
          <button className={`pp-btn pp-ask-ok ${p.danger ? "pp-btn-danger" : "pp-btn-primary"}`} onClick={() => done(true)}>{p.ok ?? "ตกลง"}</button>
        </div>
      </div>
    </div>
  );
}

// The in-app confirm dialog and toasts of dialog.ts. Mounted once by PrepApp: the open question, the toast, the offline strip and the "new version" bar.
export function DialogHost() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const f = () => rerender(n => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  const online = useOnline();
  const update = useUpdateReady();
  return (
    <>
      {state.pending && <AskDialog key={state.pending.title} p={state.pending} />}
      <div className="pp-toasts" aria-live="polite">
        {!online && <div className="pp-toast warn">ไม่มีการเชื่อมต่ออินเทอร์เน็ต · ข้อที่ตอบไปแล้วบันทึกไว้แล้ว ต่อเน็ตแล้วทำต่อได้เลย</div>}
        {update && online && (
          <div className="pp-toast">มีเวอร์ชันใหม่ <button className="pp-link" onClick={() => window.location.reload()}>แตะเพื่ออัปเดต</button></div>
        )}
        {state.toast && <div className="pp-toast" key={state.toast.id} role="status">{state.toast.text}</div>}
      </div>
    </>
  );
}
