import { useEffect, useState } from "react";
import { rpc, thaiError } from "./api";
import { CARDS, EXAM_DAYS, POSITIONS, cardScore, overall, type TarotCard } from "./tarotCards";
import "./tarot.css";

// /prep/tarot (signed in): pick 3 of the 22 Major Arcana face down, flip them, read past / present / future.
// One reading a day per account: the draw is random in the browser, prep_tarot_draw stores it, and a second draw the
// same day (another tab or device) gets the stored one back. Card pictures: src/prep/tarot/NN.webp (scripts/prep/tarot).
type Pick = { c: number; r: boolean };

const EXAM = "2026-11-14";
const SITE = "sobprep.com/prep";
const PICS = import.meta.glob("./tarot/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const pic = (c: number): string | undefined => PICS[`./tarot/${String(c).padStart(2, "0")}.webp`];

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const daysLeft = () => Math.max(0, Math.round((Date.parse(EXAM) - Date.parse(today())) / 86400000));
const fill = (s: string) => s.replace(/\{d\}/g, String(daysLeft()));
const rand = (n: number) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const reading = (p: Pick, i: number) => fill((p.r ? CARDS[p.c].rev : CARDS[p.c].up)[i]);

function shuffled(): Pick[] {
  const d = CARDS.map((_, c) => ({ c, r: rand(100) < 30 }));
  for (let i = d.length - 1; i > 0; i--) { const j = rand(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

function Face({ card, idx, rev }: { card: TarotCard; idx: number; rev: boolean }) {
  const src = pic(idx);
  return (
    <div className={`tt-face ${rev ? "rev" : ""}`} style={{ ["--h" as string]: card.hue }}>
      <div className="tt-art">{src ? <img src={src} alt="" draggable={false} /> : <span className="tt-sym" aria-hidden>{card.sym}</span>}</div>
      <span className="tt-name"><small>{card.n}</small>{card.en}<em>{card.th}</em></span>
    </div>
  );
}
const BACK = PICS["./tarot/back.webp"];
const Back = () => <div className="tt-back">{BACK ? <img src={BACK} alt="" draggable={false} /> : <span aria-hidden>🔮</span>}</div>;

// ---------- share picture (1080×1920): the three cards, each reading, the overall verdict ----------
function wrap(g: CanvasRenderingContext2D, text: string, width: number): string[] {
  const seg = typeof Intl.Segmenter === "function" ? [...new Intl.Segmenter("th", { granularity: "word" }).segment(text)].map(s => s.segment) : text.split(/(?<=\s)/);
  const lines: string[] = []; let line = "";
  for (const w of seg) {
    if (g.measureText(line + w).width > width && line) { lines.push(line.trimEnd()); line = w.trimStart(); } else line += w;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}
const loadImg = (src: string) => new Promise<HTMLImageElement | null>(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

async function shareImage(picks: Pick[], verdict: { t: string; d: string }) {
  await document.fonts?.ready;
  const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1B0B2E"); bg.addColorStop(1, "#4A0B16");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.textAlign = "center";
  g.fillStyle = "#F3D98A"; g.font = "700 58px Prompt, sans-serif"; g.fillText("🔮 ไพ่ดวงสอบครูผู้ช่วย", W / 2, 110);
  g.fillStyle = "rgba(255,255,255,.8)"; g.font = "400 32px Prompt, sans-serif"; g.fillText(`เหลืออีก ${daysLeft()} วันถึงวันสอบ ภาค ก`, W / 2, 165);
  const imgs = await Promise.all(picks.map(p => (pic(p.c) ? loadImg(pic(p.c)!) : Promise.resolve(null))));
  const cw = 300, ch = 450, top = 210;
  picks.forEach((p, i) => {
    const card = CARDS[p.c], x = 45 + i * (cw + 30);
    g.save(); g.beginPath(); g.roundRect(x, top, cw, ch, 22); g.clip();
    g.fillStyle = `hsl(${card.hue} 60% 22%)`; g.fillRect(x, top, cw, ch);
    const im = imgs[i];
    g.translate(x + cw / 2, top + ch / 2); if (p.r) g.rotate(Math.PI);
    if (im) g.drawImage(im, -cw / 2, -ch / 2, cw, ch);
    else { g.fillStyle = "#fff"; g.font = "140px sans-serif"; g.fillText(card.sym, 0, 50); }
    g.restore();
    g.strokeStyle = "#D4AF37"; g.lineWidth = 5; g.beginPath(); g.roundRect(x, top, cw, ch, 22); g.stroke();
    g.fillStyle = "#F3D98A"; g.font = "600 28px Prompt, sans-serif"; g.fillText(POSITIONS[i].s, x + cw / 2, top + ch + 42);
    g.fillStyle = "#fff"; g.font = "700 30px Prompt, sans-serif"; g.fillText(card.en, x + cw / 2, top + ch + 82);
    g.fillStyle = "rgba(255,255,255,.75)"; g.font = "400 24px Prompt, sans-serif"; g.fillText(card.th + (p.r ? " (กลับหัว)" : ""), x + cw / 2, top + ch + 114);
  });
  let y = top + ch + 175;
  g.textAlign = "left";
  picks.forEach((p, i) => {
    g.fillStyle = "#F3D98A"; g.font = "700 30px Prompt, sans-serif"; g.fillText(`${POSITIONS[i].s} · ${CARDS[p.c].en}`, 70, y);
    g.fillStyle = "#fff"; g.font = "400 29px Prompt, sans-serif";
    for (const l of wrap(g, reading(p, i), W - 140).slice(0, 3)) { y += 42; g.fillText(l, 70, y); }
    y += 58;
  });
  g.textAlign = "center";
  g.fillStyle = "rgba(212,175,55,.18)"; g.beginPath(); g.roundRect(50, y - 20, W - 100, 230, 28); g.fill();
  g.fillStyle = "#F3D98A"; g.font = "700 44px Prompt, sans-serif"; g.fillText(verdict.t, W / 2, y + 40);
  g.fillStyle = "#fff"; g.font = "400 28px Prompt, sans-serif";
  let vy = y + 88;
  for (const l of wrap(g, fill(verdict.d), W - 160).slice(0, 3)) { g.fillText(l, W / 2, vy); vy += 40; }
  g.fillStyle = "#D4AF37"; g.beginPath(); g.roundRect(170, H - 150, 740, 96, 48); g.fill();
  g.fillStyle = "#4A0B16"; g.font = "700 36px Prompt, sans-serif"; g.fillText("เปิดไพ่ของคุณที่ " + SITE, W / 2, H - 90);

  const blob: Blob | null = await new Promise(res => cv.toBlob(res, "image/png"));
  if (!blob) return;
  const file = new File([blob], "sobprep-tarot.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text: `เปิดไพ่ดวงสอบครูผู้ช่วย 🔮 https://${SITE}?src=tarot-share` }); return; }
    catch (e) { if ((e as Error).name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- page ----------
export default function Tarot({ onBack, onPractice }: { onBack: () => void; onPractice: () => void }) {
  const [phase, setPhase] = useState<"load" | "intro" | "shuffle" | "pick" | "read">("load");
  const [deck, setDeck] = useState<Pick[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    rpc<Pick[] | null>("prep_tarot_today")
      .then(p => { if (p?.length === 3) { setPicks(p); setShown(3); setPhase("read"); } else setPhase("intro"); })
      .catch(e => { setError(thaiError(e)); setPhase("intro"); });
  }, []);

  const start = () => { setDeck(shuffled()); setPhase("shuffle"); window.setTimeout(() => setPhase("pick"), 1600); };
  const pick = async (d: Pick) => {
    if (picks.length >= 3 || picks.some(p => p.c === d.c)) return;
    const next = [...picks, d];
    setPicks(next);
    if (next.length < 3) return;
    try {
      const saved = await rpc<Pick[]>("prep_tarot_draw", { p_picks: next });   // another device may have drawn first today
      setPicks(saved);
    } catch (e) { setError(thaiError(e)); }
    window.setTimeout(() => { setPhase("read"); [1, 2, 3].forEach(k => window.setTimeout(() => setShown(k), k * 750)); }, 450);
  };

  const verdict = overall(cardScore(picks));
  const lucky = picks.length === 3 ? String((picks[0].c * 7 + picks[1].c * 3 + picks[2].c * 11 + 13) % 90 + 10) : "";
  const done = phase === "read" && shown >= 3;

  return (
    <div className="tt-page">
      <button className="tt-backlink" onClick={onBack}>‹ กลับ</button>
      <h1>🔮 เปิดไพ่ดวงสอบครูผู้ช่วย</h1>
      <p className="tt-sub">ไพ่ยิปซี 3 ใบ · อดีต · ปัจจุบัน · อนาคต · เหลือ {daysLeft()} วัน</p>
      {error && <p className="tt-err">{error}</p>}

      {phase === "load" && <p className="tt-sub">กำลังเตรียมไพ่…</p>}

      {phase === "intro" && (
        <section className="tt-intro">
          <div className="tt-stack" aria-hidden><Back /><Back /><Back /></div>
          <p>ตั้งจิตให้นิ่ง นึกถึงการสอบครูผู้ช่วยวันที่ 14–15 พ.ย.<br />ถามในใจว่า <b>“การสอบครั้งนี้จะเป็นอย่างไร”</b> แล้วกดสับไพ่</p>
          <button className="tt-btn" onClick={start}>สับไพ่</button>
          <small className="tt-note">เปิดได้วันละ 1 ครั้ง</small>
        </section>
      )}

      {phase === "shuffle" && (
        <section className="tt-intro">
          <div className="tt-stack shuffling" aria-hidden><Back /><Back /><Back /><Back /></div>
          <p>กำลังสับไพ่… ตั้งจิตไว้นะ</p>
        </section>
      )}

      {phase === "pick" && (
        <section>
          <p className="tt-hint">{picks.length < 3 ? <>เลือกไพ่ที่รู้สึกว่าใช่อีก <b>{3 - picks.length}</b> ใบ</> : "กำลังเปิดไพ่…"}</p>
          <div className="tt-slots">
            {POSITIONS.map((pos, i) => <div key={i} className={`tt-slot ${picks[i] ? "on" : ""}`}>{picks[i] ? <Back /> : <span>{pos.s}</span>}</div>)}
          </div>
          <div className="tt-deck">
            {deck.map((d, i) => (
              <button key={d.c} className={`tt-pick ${picks.some(p => p.c === d.c) ? "taken" : ""}`} onClick={() => pick(d)}
                aria-label={`ไพ่ใบที่ ${i + 1}`} style={{ animationDelay: `${i * 25}ms` }}><Back /></button>
            ))}
          </div>
        </section>
      )}

      {phase === "read" && (
        <section>
          <div className="tt-spread">
            {picks.map((p, i) => (
              <div key={i} className="tt-spot">
                <div className={`tt-card ${shown > i ? "flip" : ""}`}><div className="tt-in"><Back /><Face card={CARDS[p.c]} idx={p.c} rev={p.r} /></div></div>
                <span className="tt-pos">{POSITIONS[i].s}</span>
              </div>
            ))}
          </div>

          {done && (
            <div className="tt-reading">
              {picks.map((p, i) => {
                const c = CARDS[p.c];
                return (
                  <article key={i} className="tt-read">
                    <h3><span>{POSITIONS[i].t}</span>{c.en} · {c.th}{p.r && <em>กลับหัว</em>}</h3>
                    <p className="tt-key">{p.r ? c.rkey : c.key}</p>
                    <p>{reading(p, i)}</p>
                  </article>
                );
              })}

              <article className="tt-sum">
                <h2>{verdict.t}</h2>
                <p>{fill(verdict.d)}</p>
                <div className="tt-lucky">
                  <div><small>เลขนำโชค</small><b>{lucky}</b></div>
                  {EXAM_DAYS.map(d => <div key={d.day}><small>สีมงคล {d.day}</small><b><i style={{ background: d.hex }} />{d.color}</b></div>)}
                </div>
              </article>

              <article className="tt-cta">
                <h3>เสริมดวงด้วยการซ้อม 💪</h3>
                <p>ไพ่บอกทาง แต่คะแนนมาจากการฝึก ทำข้อสอบสักชุด แล้วดูว่าหมวดไหนควรทวนก่อนวันสอบ</p>
                <button className="tt-btn" onClick={onPractice}>ทำข้อสอบเลย</button>
                <button className="tt-btn ghost" disabled={busy} onClick={async () => { setBusy(true); try { await shareImage(picks, verdict); } finally { setBusy(false); } }}>
                  {busy ? "กำลังสร้างรูป…" : "แชร์ไพ่และคำทำนาย"}
                </button>
              </article>
              <p className="tt-note">เปิดไพ่ใหม่ได้พรุ่งนี้ · ดูเพื่อความสนุกและเป็นแนวทาง ผลสอบจริงขึ้นกับการเตรียมตัวของคุณ</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
