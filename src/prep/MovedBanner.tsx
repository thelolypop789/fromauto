import { useEffect, useState } from "react";

const OLD_HOST = "fromauto.vercel.app";
const NEW_ORIGIN = "https://sobprep.com";
const KEY = "pp-moved-dismissed";

// Shown only to people who open the app from the old address, and only once the new address answers, so nobody is
// sent to a dead page while DNS is still being set up. Sessions and the installed app cannot move between addresses,
// so the text says what to do.
export default function MovedBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (window.location.hostname !== OLD_HOST) return;
    try { if (sessionStorage.getItem(KEY)) return; } catch { /* storage blocked: just show it */ }
    let live = true;
    // no-cors: we only need to know the host answers, not read the response.
    fetch(`${NEW_ORIGIN}/prep-manifest.webmanifest`, { mode: "no-cors", cache: "no-store" })
      .then(() => { if (live) setShow(true); })
      .catch(() => { /* new address not reachable yet: stay quiet */ });
    return () => { live = false; };
  }, []);
  if (!show) return null;
  const target = `${NEW_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  return (
    <div className="pp-moved" role="status">
      <div className="pp-moved-in">
        <b>เราย้ายบ้านใหม่แล้ว: sobprep.com</b>
        <ul>
          <li>ข้อมูล สถิติ และสิทธิ์แพ็กของคุณอยู่ครบ แค่<b>ล็อกอินด้วยบัญชีเดิม</b>อีกครั้งที่ที่อยู่ใหม่</li>
          <li>ถ้าติดตั้งแอปไว้บนหน้าจอโฮม ให้<b>ลบไอคอนเดิม</b>แล้ว<b>ติดตั้งใหม่</b>จาก sobprep.com</li>
          <li>ที่อยู่เดิมยังใช้ได้ระยะหนึ่ง แต่ข้อมูลที่ทำที่นี่หลังจากนี้ควรไปทำที่ที่อยู่ใหม่</li>
        </ul>
        <div className="pp-row">
          <a className="pp-btn pp-btn-gold" href={target}>ไปที่ sobprep.com</a>
          <button className="pp-btn pp-btn-ghost" onClick={() => { try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ } setShow(false); }}>ไว้ทีหลัง</button>
        </div>
      </div>
    </div>
  );
}
