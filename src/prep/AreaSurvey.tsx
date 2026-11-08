import { useEffect, useMemo, useState } from "react";
import { rpc, thaiError, type Track } from "./api";
import { IconX } from "./icons";
import Mascot from "./Mascot";
import { useBackClose } from "./router";
import { CommunityLinks } from "./Community";

export type AreaKind = "spp" | "spm" | "sped" | "vec" | "none";
export type MyArea = {
  kind: AreaKind | null; province?: string; zone?: number | null; label: string | null; ask: boolean;
  same?: number | null; same_major?: number | null;   // null = fewer than 5 people (hidden)
} | null;

// 77 จังหวัด (ตรงกับ prep.provinces() ในฐานข้อมูล)
const PROVINCES = [
  "กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท",
  "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช",
  "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน", "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี",
  "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "ภูเก็ต", "มหาสารคาม",
  "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ",
  "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี",
  "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี",
];

const KINDS: { key: Exclude<AreaKind, "none">; title: string; desc: string }[] = [
  { key: "spp", title: "สพป.", desc: "เขตพื้นที่การศึกษาประถมศึกษา" },
  { key: "spm", title: "สพม.", desc: "เขตพื้นที่การศึกษามัธยมศึกษา" },
  { key: "sped", title: "การศึกษาพิเศษ", desc: "สำนักบริหารงานการศึกษาพิเศษ" },
  { key: "vec", title: "อาชีวศึกษา (สอศ.)", desc: "วิทยาลัยในจังหวัด" },
];

// สพป. ต้องเลือกเขต (กทม. ไม่มี สพป.) · สพม. เลือกเขตเฉพาะ กทม. (เขต 1–2)
const zonesFor = (k: AreaKind | null, prov: string | null) =>
  k === "spp" ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : k === "spm" && prov === "กรุงเทพมหานคร" ? [1, 2] : [];

// "ลงสอบเขตไหน": popup = asked once after sign-in ("ไว้ทีหลัง" asks again in 3 days); edit = opened from the account page.
// Saving shows how many people in the app chose the same area (and major) when there are at least 5, and the group links.
export default function AreaSurvey({ mode, track, onClose, onSaved }: {
  mode: "popup" | "edit"; track?: Track; onClose: () => void; onSaved?: (a: MyArea) => void;
}) {
  const [kind, setKind] = useState<AreaKind | null>(track === "vec" ? "vec" : null);
  const [prov, setProv] = useState<string | null>(null);
  const [zone, setZone] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<MyArea>(null);

  useBackClose(onClose, mode === "edit" || !!done);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && (mode === "edit" || done)) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mode, done]);

  const zones = zonesFor(kind, prov);
  const provList = useMemo(() => PROVINCES.filter(p => p.includes(q.trim()) && !(kind === "spp" && p === "กรุงเทพมหานคร")), [q, kind]);
  const ready = !!kind && !!prov && (zones.length === 0 || zone !== null);

  const save = async (k: AreaKind) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const a = await rpc<MyArea>("prep_set_area", k === "none" ? { p_kind: "none" } : { p_kind: k, p_province: prov, p_zone: zones.length ? zone : null });
      onSaved?.(a);
      if (k === "none") onClose(); else setDone(a);
    } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };
  const later = async () => {
    rpc("prep_snooze_area").catch(() => { /* asked again next visit */ });
    onClose();
  };

  if (done) {
    return (
      <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-area-h" onClick={onClose}>
        <div className="pp-modal-box" onClick={e => e.stopPropagation()}>
          <div className="pp-modal-h">
            <h3 id="pp-area-h">บันทึกแล้ว</h3>
            <button className="pp-x" onClick={onClose} aria-label="ปิด"><IconX /></button>
          </div>
          <div className="pp-greet">
            <Mascot costume={kind === "vec" ? "vocational" : "teacher"} mood="cheer" size={64} />
            <div className="pp-greet-bubble">
              <b>{done.label}</b><br />
              {done.same
                ? <>ในแอปมีคนลงเขตนี้ <b>{done.same.toLocaleString()} คน</b>{done.same_major ? <> · เอกเดียวกับคุณ <b>{done.same_major.toLocaleString()} คน</b></> : null}</>
                : "ตอนนี้ยังมีคนลงเขตนี้ไม่ถึง 5 คน ชวนเพื่อนมาซ้อมด้วยกันได้นะ"}
            </div>
          </div>
          <CommunityLinks title="เข้ากลุ่มเตรียมสอบ by SOBPREP" />
          <button className="pp-btn pp-btn-primary pp-wide" onClick={onClose}>เรียบร้อย</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="pp-area-h" onClick={mode === "edit" ? onClose : undefined}>
      <div className="pp-modal-box" onClick={e => e.stopPropagation()}>
        <div className="pp-modal-h">
          <h3 id="pp-area-h">คุณลงสอบเขตไหน?</h3>
          {mode === "edit" && <button className="pp-x" onClick={onClose} aria-label="ปิด"><IconX /></button>}
        </div>
        <p className="pp-muted small">ดูได้จากบัตรประจำตัวผู้สมัครสอบ · ใช้แสดงจำนวนคนที่ลงเขตเดียวกันและจัดกลุ่มเตรียมสอบ ไม่แสดงชื่อใคร · เปลี่ยนได้ที่หน้า "ฉัน"</p>

        <div className="pp-area-step">1. สังกัดที่สมัคร</div>
        <div className="pp-seg pp-seg-sub" role="radiogroup" aria-label="สังกัดที่สมัคร">
          {KINDS.map(k => (
            <button key={k.key} role="radio" aria-checked={kind === k.key} className={kind === k.key ? "on" : ""}
              onClick={() => { setKind(k.key); setZone(null); if (k.key === "spp" && prov === "กรุงเทพมหานคร") setProv(null); }}>
              {k.title}<small className="pp-area-sub">{k.desc}</small>
            </button>
          ))}
        </div>

        {kind && <>
          <div className="pp-area-step">2. จังหวัด{prov && <> · <b>{prov}</b> <button className="pp-link" onClick={() => { setProv(null); setZone(null); }}>เปลี่ยน</button></>}</div>
          {!prov && <>
            <input className="pp-input" placeholder="พิมพ์ชื่อจังหวัด เช่น หนองคาย" value={q} onChange={e => setQ(e.target.value)} />
            <div className="pp-area-provs">
              {provList.map(p => <button key={p} className="pp-chip-btn" onClick={() => { setProv(p); setZone(null); setQ(""); }}>{p}</button>)}
              {provList.length === 0 && <span className="pp-muted small">ไม่พบจังหวัดนี้</span>}
            </div>
          </>}
        </>}

        {prov && zones.length > 0 && <>
          <div className="pp-area-step">3. เขตที่</div>
          <div className="pp-seg pp-seg-sub" role="radiogroup" aria-label="เขตที่">
            {zones.map(z => <button key={z} role="radio" aria-checked={zone === z} className={zone === z ? "on" : ""} onClick={() => setZone(z)}>เขต {z}</button>)}
          </div>
        </>}

        {error && <div className="pp-error">{error}</div>}
        <button className="pp-btn pp-btn-primary pp-wide" disabled={!ready || busy} onClick={() => kind && save(kind)}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
        <div className="pp-row pp-area-foot">
          <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={() => save("none")}>ไม่ได้สมัครรอบนี้</button>
          {mode === "popup" && <button className="pp-btn pp-btn-ghost" disabled={busy} onClick={later}>ไว้ทีหลัง</button>}
        </div>
      </div>
    </div>
  );
}

// หน้า "ฉัน": เขตที่ลงสอบ + ปุ่มเปลี่ยน
export function AreaCard({ track }: { track?: Track }) {
  const [a, setA] = useState<MyArea | undefined>(undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => { rpc<MyArea>("prep_my_area").then(setA).catch(() => setA(null)); }, []);
  if (a === undefined) return null;
  return (
    <>
      <div className="pp-card pp-major-card">
        <div>
          <div className="pp-muted small">เขตที่ลงสอบ{a?.same ? ` · ในแอปลงเขตนี้ ${a.same.toLocaleString()} คน` : ""}</div>
          <b>{a?.label ?? "ยังไม่ได้บอก"}</b>
        </div>
        <button className="pp-btn pp-btn-outline" onClick={() => setOpen(true)}>{a?.kind ? "เปลี่ยน" : "เลือกเขต"}</button>
      </div>
      {open && <AreaSurvey mode="edit" track={track} onClose={() => setOpen(false)} onSaved={setA} />}
    </>
  );
}

// ป๊อปอัปที่ PrepApp แสดงครั้งเดียวต่อการเปิดแอป เมื่อยังไม่เคยตอบ (และไม่ได้กด "ไว้ทีหลัง" ใน 3 วัน)
export function AreaPrompt({ track }: { track?: Track }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("pp-area-asked") === "1"; } catch { /* ask anyway */ }
    if (seen) return;
    rpc<MyArea>("prep_my_area").then(a => { if (a?.ask) setShow(true); }).catch(() => { /* older database: no survey */ });
  }, []);
  if (!show) return null;
  const close = () => { try { sessionStorage.setItem("pp-area-asked", "1"); } catch { /* ignore */ } setShow(false); };
  return <AreaSurvey mode="popup" track={track} onClose={close} />;
}
