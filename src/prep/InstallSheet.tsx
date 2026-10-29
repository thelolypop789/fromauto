import { useEffect, useRef, useState } from "react";
import Mascot from "./Mascot";
import { IconBolt, IconCheck, IconDownload, IconExpand, IconFeather, IconShare, IconX } from "./icons";
import { track } from "./api";
import { readSeen, useInstall, writeSeen } from "./pwa";
import { useBackClose } from "./router";

// Bottom sheet that asks the user to add the app to the home screen.
// Chrome/Android installs with one tap; iPhone and in-app browsers (Facebook, LINE) can't, so the sheet shows the steps instead.
export default function InstallSheet({ onClose }: { onClose: () => void }) {
  const { kind, install } = useInstall();
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const later = () => { const s = readSeen(); writeSeen({ n: s.n + 1, at: Date.now() }); onClose(); };
  useBackClose(later);
  useEffect(() => { track("install_view"); box.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") later(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // Installed meanwhile (or never installable here): nothing to show.
  useEffect(() => { if (!kind && !done) onClose(); }, [kind, done, onClose]);

  const doInstall = async () => { if (await install()) setDone(true); };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.origin + "/prep"); setCopied(true); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-inst-h" onClick={later}>
      <div className="pp-modal-box pp-inst" ref={box} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <span className="pp-inst-grip" aria-hidden="true" />
        <button className="pp-x pp-inst-x" onClick={later} aria-label="ปิด"><IconX /></button>

        <div className="pp-inst-hero">
          <div className="pp-inst-glow" aria-hidden="true" />
          <Mascot mood={done ? "cheer" : "wave"} size={124} motion={done ? "cheer" : "pop"} />
        </div>

        {done ? (
          <>
            <h3 id="pp-inst-h" className="pp-inst-h">ติดตั้งเรียบร้อย!</h3>
            <p className="pp-inst-sub">ไอคอน “ซ้อมสอบ” อยู่บนหน้าจอโฮมแล้ว แตะเพื่อเปิดซ้อมได้ทุกเมื่อ</p>
            <button className="pp-btn pp-inst-go" onClick={onClose}><IconCheck />เยี่ยมเลย</button>
          </>
        ) : (
          <>
            <h3 id="pp-inst-h" className="pp-inst-h">เพิ่ม <b>ซ้อมสอบ</b> ไว้บนหน้าจอโฮม</h3>
            <p className="pp-inst-sub">แตะไอคอนเดียวก็เข้าซ้อมได้เลย ใช้ได้ทั้ง iPhone และ Android</p>

            <div className="pp-inst-perks">
              <div><i><IconBolt /></i><span>แตะเดียว<br />เข้าซ้อมทันที</span></div>
              <div><i><IconExpand /></i><span>เต็มจอ<br />เหมือนแอป</span></div>
              <div><i><IconFeather /></i><span>ไม่ต้องโหลด<br />จาก Store</span></div>
            </div>

            {kind === "prompt" && (
              <button className="pp-btn pp-inst-go" onClick={doInstall}><span className="pp-inst-go-i"><IconDownload size={18} /></span>ติดตั้งแอป</button>
            )}

            {kind === "ios" && (
              <ol className="pp-inst-steps">
                <li><em>1</em><span>แตะปุ่ม <b className="pp-inst-key"><IconShare size={16} />แชร์</b> ที่แถบด้านล่างของ Safari</span></li>
                <li><em>2</em><span>เลื่อนลงแล้วเลือก <b className="pp-inst-key">เพิ่มไปยังหน้าจอโฮม</b></span></li>
                <li><em>3</em><span>แตะ <b className="pp-inst-key">เพิ่ม</b> มุมขวาบน เสร็จแล้ว!</span></li>
              </ol>
            )}

            {kind === "inapp" && (
              <div className="pp-inst-inapp">
                <p>ตอนนี้เปิดอยู่ในแอป Facebook หรือ LINE ซึ่งติดตั้งไม่ได้ ให้แตะ <b>⋯</b> มุมขวาบน แล้วเลือก <b>เปิดในเบราว์เซอร์</b> (Safari หรือ Chrome) ก่อน</p>
                <button className="pp-btn pp-inst-go" onClick={copyLink}>{copied ? <><IconCheck />คัดลอกลิงก์แล้ว</> : "คัดลอกลิงก์ไปเปิดในเบราว์เซอร์"}</button>
              </div>
            )}

            <button className="pp-btn pp-inst-later" onClick={later}>ไว้ทีหลัง</button>
            <p className="pp-inst-note">ติดตั้งภายหลังได้ที่หน้า “บัญชี”</p>
          </>
        )}
        {kind === "ios" && !done && <span className="pp-inst-arrow" aria-hidden="true" />}
      </div>
    </div>
  );
}
