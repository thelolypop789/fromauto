import { useEffect, useMemo, useState } from "react";
import { rpc, thaiError, type Track } from "./api";
import { IconX } from "./icons";
import Mascot from "./Mascot";
import { useBackClose } from "./router";
import { CommunityLinks } from "./Community";

export type AreaKind = "spp" | "spm" | "sped" | "vec" | "none";
export type MyArea = {
  code: string | null; kind: AreaKind | null; label: string | null; ask: boolean;
  same?: number | null; same_major?: number | null;   // null = fewer than 5 people (hidden)
} | null;
type Area = { code: string; kind: Exclude<AreaKind, "none">; provinces: string[]; amphoes: string[] };

const KINDS: { key: Area["kind"]; title: string; desc: string; hint: string }[] = [
  { key: "spp", title: "สพป.", desc: "เขตพื้นที่การศึกษาประถมศึกษา", hint: "พิมพ์ชื่อจังหวัดหรืออำเภอ เช่น หนองคาย, ท่าบ่อ" },
  { key: "spm", title: "สพม.", desc: "เขตพื้นที่การศึกษามัธยมศึกษา", hint: "พิมพ์ชื่อจังหวัด เช่น ลำพูน" },
  { key: "sped", title: "การศึกษาพิเศษ", desc: "สำนักบริหารงานการศึกษาพิเศษ", hint: "" },
  { key: "vec", title: "อาชีวศึกษา (สอศ.)", desc: "จังหวัดที่ตั้งวิทยาลัย", hint: "พิมพ์ชื่อจังหวัด" },
];

// "ลงสอบเขตไหน": popup = asked once after sign-in ("ไว้ทีหลัง" asks again in 3 days); edit = opened from the account page.
// Saving shows how many people in the app chose the same area (and major) when there are at least 5, and the group links.
export default function AreaSurvey({ mode, track, onClose, onSaved }: {
  mode: "popup" | "edit"; track?: Track; onClose: () => void; onSaved?: (a: MyArea) => void;
}) {
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [kind, setKind] = useState<Area["kind"] | null>(track === "vec" ? "vec" : null);
  const [picked, setPicked] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<MyArea>(null);

  useEffect(() => { rpc<Area[]>("prep_exam_areas").then(setAreas).catch(e => setError(thaiError(e))); }, []);
  useBackClose(onClose, mode === "edit" || !!done);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && (mode === "edit" || done)) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, mode, done]);

  // รายชื่อเขตของสังกัดที่เลือก ค้นได้ทั้งชื่อเขต จังหวัด และอำเภอ (สพป.)
  const list = useMemo(() => {
    const t = q.trim().replace(/^(จ\.|จังหวัด|อ\.|อำเภอ)\s*/, "");
    return (areas ?? []).filter(a => a.kind === kind).map(a => ({ a, hit: t ? a.amphoes.find(x => x.includes(t)) : undefined }))
      .filter(({ a, hit }) => !t || a.code.includes(t) || a.provinces.some(p => p.includes(t)) || !!hit);
  }, [areas, kind, q]);
  const pickKind = (k: Area["kind"]) => {
    setKind(k); setQ("");
    const only = (areas ?? []).filter(a => a.kind === k);
    setPicked(only.length === 1 ? only[0].code : null);   // การศึกษาพิเศษมีหน่วยเดียว
  };

  const save = async (code: string) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const a = await rpc<MyArea>("prep_set_area", { p_code: code });
      onSaved?.(a);
      if (code === "none") onClose(); else setDone(a);
    } catch (e) { setError(thaiError(e)); }
    setBusy(false);
  };
  const later = async () => {
    rpc("prep_snooze_area").catch(() => { /* asked again next visit */ });
    onClose();
  };
  const hint = KINDS.find(k => k.key === kind)?.hint;

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
            <button key={k.key} role="radio" aria-checked={kind === k.key} className={kind === k.key ? "on" : ""} onClick={() => pickKind(k.key)}>
              {k.title}<small className="pp-area-sub">{k.desc}</small>
            </button>
          ))}
        </div>

        {kind && kind !== "sped" && <>
          <div className="pp-area-step">2. เลือกเขต{picked && <> · <b>{picked}</b></>}</div>
          <input className="pp-input" placeholder={hint} value={q} onChange={e => setQ(e.target.value)} />
          {!areas && !error && <p className="pp-muted small">กำลังโหลดรายชื่อเขต…</p>}
          <div className="pp-area-list" role="radiogroup" aria-label="เขตพื้นที่">
            {list.map(({ a, hit }) => (
              <button key={a.code} role="radio" aria-checked={picked === a.code} className={picked === a.code ? "on" : ""} onClick={() => setPicked(a.code)}>
                <b>{a.code}</b>
                {a.amphoes.length > 0 && <small>{hit ? <>มีอำเภอ<mark>{hit}</mark> · </> : null}{a.amphoes.length} อำเภอ: {a.amphoes.join(" ")}</small>}
                {a.kind === "spp" && a.amphoes.length === 0 && a.code.indexOf(" เขต ") < 0 && <small>ทุกอำเภอในจังหวัด</small>}
              </button>
            ))}
            {areas && list.length === 0 && <span className="pp-muted small">ไม่พบ ลองพิมพ์ชื่อจังหวัดอย่างเดียว</span>}
          </div>
        </>}
        {kind === "sped" && picked && <p className="pp-note">ภาค ค ประเมินโดย อ.ก.ค.ศ. สำนักบริหารงานการศึกษาพิเศษ</p>}

        {error && <div className="pp-error">{error}</div>}
        <button className="pp-btn pp-btn-primary pp-wide" disabled={!picked || busy} onClick={() => picked && save(picked)}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
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
