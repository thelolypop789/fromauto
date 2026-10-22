import { useCallback, useEffect, useState } from "react";
import { PACKAGE_LABEL, TERM_LABEL, rpc, thaiError, type GroupKeys as Data } from "./api";

const share = (key: string, d: Data) => [
  `รหัสเปิดใช้งาน ซ้อมสอบ SOBPREP: ${key}`,
  `แพ็ก: ${PACKAGE_LABEL[d.package]} · ${TERM_LABEL[d.term]}`,
  "วิธีใช้: เข้า sobprep.com/prep → เข้าสู่ระบบ → หน้าบัญชี → กรอกรหัสในช่อง “มีคีย์แล้ว? เปิดใช้งาน”",
  "รหัสใช้ได้ 1 ครั้ง",
].join("\n");

// The keys of the buyer's group orders ("คู่หูไฟลุก", "แก๊งเปลวไฟ"): use one yourself, copy the rest to friends.
export default function GroupKeys({ onChanged }: { onChanged: () => void }) {
  const [list, setList] = useState<Data[] | null>(null);
  const [copied, setCopied] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => rpc<Data[]>("prep_my_group_keys").then(setList).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);

  if (!list || list.length === 0) return null;
  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(""), 1500); } catch { /* no clipboard */ }
  };
  const redeemMine = async (key: string) => {
    try {
      const r = await rpc<{ ok: boolean; error?: string }>("prep_redeem_key", { p_key: key });
      if (!r.ok) { setMsg({ ok: false, text: thaiError(r.error ?? "invalid_key") }); return; }
      setMsg({ ok: true, text: "เปิดใช้งานให้บัญชีนี้แล้ว" }); onChanged(); load();
    } catch (e) { setMsg({ ok: false, text: thaiError(e) }); }
  };

  return (
    <div className="pp-card pp-gk">
      <h3>คีย์แพ็กกลุ่มของคุณ</h3>
      <p className="pp-muted small">กด “ใช้ให้ฉัน” เพื่อเปิดสิทธิ์ให้บัญชีนี้ หรือกด “คัดลอกข้อความ” แล้วส่งให้เพื่อน แต่ละคีย์ใช้ได้ครั้งเดียว และอายุเริ่มนับเมื่อกรอกคีย์</p>
      {list.map(o => (
        <div key={o.order_id} className="pp-gk-order">
          <div><b>{o.name ?? "แพ็กกลุ่ม"}</b> · {o.seats} คน · {PACKAGE_LABEL[o.package]} · {TERM_LABEL[o.term]}
            <span className="pp-muted small"> · ใช้แล้ว {o.keys.filter(k => k.used).length}/{o.seats}</span></div>
          {o.keys.map(k => (
            <div key={k.key} className={`pp-gk-key ${k.used || k.revoked ? "used" : ""}`}>
              <code>{k.key}</code>
              {k.revoked ? <span className="pp-chip bad">ถูกยกเลิก</span>
                : k.used ? <span className="pp-chip ok">{k.mine ? "คุณใช้แล้ว" : "เพื่อนใช้แล้ว"}</span>
                  : <span className="pp-gk-act">
                      <button className="pp-btn pp-btn-primary sm" onClick={() => redeemMine(k.key)}>ใช้ให้ฉัน</button>
                      <button className="pp-btn pp-btn-ghost sm" onClick={() => copy(share(k.key, o), k.key)}>{copied === k.key ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}</button>
                    </span>}
            </div>
          ))}
        </div>
      ))}
      {msg && <div className={msg.ok ? "pp-success" : "pp-error"}>{msg.text}</div>}
    </div>
  );
}
