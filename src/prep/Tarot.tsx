import { useEffect, useMemo, useState } from "react";
import { CARDS, EXAM_DAYS, POSITIONS, overall, type TarotCard } from "./tarotCards";
import "./tarot.css";

// Public page at /prep/tarot: draw 3 of the 22 Major Arcana face down, flip them, read past / now / exam day.
// No sign-in, no server: the draw is random in the browser and kept for the day in localStorage, so a revisit the same
// day shows the same reading (one reading a day, like asking a fortune teller once). For fun; the CTA leads to practice.
const KEY = "pp-tarot";
const EXAM = "2026-11-14";
const SITE = "sobprep.com/prep/tarot";

type Pick = { c: number; r: boolean };
type Saved = { date: string; picks: Pick[] };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const daysLeft = () => Math.max(0, Math.round((Date.parse(EXAM) - Date.parse(today())) / 86400000));
const fill = (s: string) => s.replace(/\{d\}/g, String(daysLeft()));
const rand = (n: number) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };

function shuffled(): Pick[] {
  const d = CARDS.map((_, c) => ({ c, r: rand(100) < 30 }));
  for (let i = d.length - 1; i > 0; i--) { const j = rand(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

function load(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null") as Saved | null;
    return s && s.date === today() && s.picks?.length === 3 ? s : null;
  } catch { return null; }
}
const save = (picks: Pick[]) => { try { localStorage.setItem(KEY, JSON.stringify({ date: today(), picks })); } catch { /* private mode */ } };

function Face({ card, rev }: { card: TarotCard; rev: boolean }) {
  return (
    <div className={`tt-face ${rev ? "rev" : ""}`} style={{ ["--h" as string]: card.hue }}>
      <span className="tt-num">{card.n}</span>
      <span className="tt-sym" aria-hidden>{card.sym}</span>
      <span className="tt-name">{card.th}<small>{card.en}</small></span>
    </div>
  );
}

function Back() {
  return <div className="tt-back"><span aria-hidden>🔮</span></div>;
}

// Share picture: the three cards, the overall verdict and the address, drawn on a canvas.
async function shareImage(picks: Pick[], verdict: string) {
  const W = 1080, H = 1350, cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1B0B2E"); bg.addColorStop(1, "#4A0B16");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.textAlign = "center";
  g.fillStyle = "#F3D98A"; g.font = "700 60px Prompt, sans-serif";
  g.fillText("🔮 ไพ่ดวงสอบครูผู้ช่วย", W / 2, 130);
  g.fillStyle = "#fff"; g.font = "400 34px Prompt, sans-serif";
  g.fillText("อดีต · ปัจจุบัน · วันสอบ", W / 2, 190);
  picks.forEach((p, i) => {
    const card = CARDS[p.c], cw = 300, ch = 480, x = 45 + i * (cw + 30), y = 250;
    const fg = g.createLinearGradient(x, y, x, y + ch);
    fg.addColorStop(0, `hsl(${card.hue} 70% 32%)`); fg.addColorStop(1, `hsl(${card.hue} 60% 16%)`);
    g.fillStyle = fg; g.beginPath(); g.roundRect(x, y, cw, ch, 24); g.fill();
    g.strokeStyle = "#D4AF37"; g.lineWidth = 6; g.stroke();
    g.save(); g.translate(x + cw / 2, y + ch / 2); if (p.r) g.rotate(Math.PI);
    g.fillStyle = "#F3D98A"; g.font = "600 36px Prompt, sans-serif"; g.fillText(card.n, 0, -ch / 2 + 60);
    g.font = "140px sans-serif"; g.fillText(card.sym, 0, 40);
    g.fillStyle = "#fff"; g.font = "700 38px Prompt, sans-serif"; g.fillText(card.th, 0, ch / 2 - 60);
    g.restore();
    g.fillStyle = "#F3D98A"; g.font = "500 30px Prompt, sans-serif";
    g.fillText(POSITIONS[i].s + (p.r ? " · กลับหัว" : ""), x + cw / 2, y + ch + 50);
  });
  g.fillStyle = "#fff"; g.font = "700 56px Prompt, sans-serif";
  g.fillText(verdict, W / 2, 940);
  g.font = "400 34px Prompt, sans-serif"; g.fillStyle = "rgba(255,255,255,.85)";
  g.fillText(`เหลืออีก ${daysLeft()} วันถึงวันสอบ ภาค ก`, W / 2, 1010);
  g.fillStyle = "#D4AF37"; g.beginPath(); g.roundRect(190, 1110, 700, 110, 55); g.fill();
  g.fillStyle = "#4A0B16"; g.font = "700 40px Prompt, sans-serif";
  g.fillText("เปิดไพ่ของคุณ · " + SITE, W / 2, 1180);
  const blob: Blob | null = await new Promise(res => cv.toBlob(res, "image/png"));
  if (!blob) return;
  const file = new File([blob], "sobprep-tarot.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], text: `เปิดไพ่ดวงสอบครูผู้ช่วย 🔮 https://${SITE}?src=tarot-share` }); return; } catch { /* cancelled */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export default function Tarot() {
  const saved = useMemo(load, []);
  const [phase, setPhase] = useState<"intro" | "shuffle" | "pick" | "read">(saved ? "read" : "intro");
  const [deck, setDeck] = useState<Pick[]>(() => shuffled());
  const [picks, setPicks] = useState<Pick[]>(saved?.picks ?? []);
  const [shown, setShown] = useState(saved ? 3 : 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "เปิดไพ่ดวงสอบครูผู้ช่วย | ซ้อมสอบ SOBPREP"; }, []);

  const start = () => {
    setDeck(shuffled()); setPhase("shuffle");
    window.setTimeout(() => setPhase("pick"), 1600);
  };
  const pick = (i: number) => {
    if (picks.length >= 3 || picks.some(p => p.c === deck[i].c)) return;
    const next = [...picks, deck[i]];
    setPicks(next);
    if (next.length === 3) {
      save(next);
      window.setTimeout(() => { setPhase("read"); [1, 2, 3].forEach(k => window.setTimeout(() => setShown(k), k * 700)); }, 500);
    }
  };

  const score = picks.reduce((s, p) => s + CARDS[p.c].tone - (p.r ? 1 : 0), 0);
  const verdict = overall(score);
  const lucky = picks.length === 3 ? String((picks[0].c * 7 + picks[1].c * 3 + picks[2].c * 11 + 13) % 90 + 10) : "";
  const done = phase === "read" && shown >= 3;

  return (
    <div className="pp-app tt-page">
      <header className="tt-top">
        <a className="tt-brand" href="/prep?src=tarot">ซ้อมสอบ <b>SOBPREP</b></a>
        <span className="tt-days">เหลือ {daysLeft()} วัน</span>
      </header>
      <main className="tt-main">
        <h1>🔮 เปิดไพ่ดวงสอบครูผู้ช่วย</h1>
        <p className="tt-sub">ไพ่ยิปซี 3 ใบ · อดีต · ปัจจุบัน · วันสอบ</p>

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
            <p className="tt-hint">เลือกไพ่ที่รู้สึกว่าใช่ <b>{3 - picks.length}</b> ใบ</p>
            <div className="tt-slots">
              {POSITIONS.map((pos, i) => (
                <div key={i} className={`tt-slot ${picks[i] ? "on" : ""}`}>{picks[i] ? <Back /> : <span>{pos.s}</span>}</div>
              ))}
            </div>
            <div className="tt-deck">
              {deck.map((d, i) => (
                <button key={d.c} className={`tt-pick ${picks.some(p => p.c === d.c) ? "taken" : ""}`} onClick={() => pick(i)}
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
                  <div className={`tt-card ${shown > i ? "flip" : ""}`}><div className="tt-in"><Back /><Face card={CARDS[p.c]} rev={p.r} /></div></div>
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
                      <h3><span>{i + 1}. {POSITIONS[i].t}</span>{c.sym} {c.th}{p.r && <em>กลับหัว</em>}</h3>
                      <p className="tt-key">{p.r ? c.rkey : c.key}</p>
                      <p>{fill((p.r ? c.rev : c.up)[i])}</p>
                    </article>
                  );
                })}

                <article className="tt-sum">
                  <h2>{verdict.t}</h2>
                  <p>{fill(verdict.d)}</p>
                  <div className="tt-lucky">
                    <div><small>เลขนำโชค</small><b>{lucky}</b></div>
                    {EXAM_DAYS.map(d => (
                      <div key={d.day}><small>สีมงคล {d.day}</small><b><i style={{ background: d.hex }} />{d.color}</b></div>
                    ))}
                  </div>
                </article>

                <article className="tt-cta">
                  <h3>เสริมดวงด้วยการซ้อม 💪</h3>
                  <p>ไพ่บอกทาง แต่คะแนนมาจากการฝึก ลองทำข้อสอบฟรี แล้วดูว่าหมวดไหนควรทวนก่อนวันสอบ</p>
                  <a className="tt-btn" href="/prep?src=tarot">ลองทำข้อสอบฟรี</a>
                  <button className="tt-btn ghost" disabled={busy} onClick={async () => { setBusy(true); await shareImage(picks, verdict.t); setBusy(false); }}>
                    {busy ? "กำลังสร้างรูป…" : "แชร์ไพ่ของฉัน"}
                  </button>
                </article>
                <p className="tt-note">เปิดไพ่ใหม่ได้พรุ่งนี้ · ดูเพื่อความสนุกและเป็นกำลังใจ ผลสอบจริงขึ้นกับการเตรียมตัวของคุณ</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
