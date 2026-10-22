import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { rpc, supabase, thaiError, startPing, track, type Me, type MockPayload, type Profile, type Round, type SubmitResult } from "./api";
import Login from "./Login";
import Home from "./Home";
import CreateSet, { type Preset } from "./CreateSet";
import Player from "./Player";
import RoundResult from "./RoundResult";
import Stats from "./Stats";
import Account from "./Account";
import Admin from "./Admin";
import Guide from "./Guide";
import Calendar from "./Calendar";
import Privacy from "./Privacy";
import MovedBanner from "./MovedBanner";
import DailyQuiz from "./DailyQuiz";
import MockHome from "./MockHome";
import MockPlayer from "./MockPlayer";
import MockResult from "./MockResult";
import { IconCalendar, IconChart, IconCrown, IconHome, IconShield, IconUser, Logo } from "./icons";
import { setupPwa } from "./pwa";
import Waiting from "./Waiting";
import MajorPicker from "./MajorPicker";
import "./prep.css";

setupPwa();

type View =
  | { name: "home" }
  | { name: "create"; preset?: Preset }
  | { name: "play"; round: Round }
  | { name: "result"; result: SubmitResult; title: string }
  | { name: "stats" }
  | { name: "daily" }
  | { name: "mock" }
  | { name: "mockplay"; payload: MockPayload }
  | { name: "mockresult"; payload: MockPayload }
  | { name: "calendar" }
  | { name: "account" }
  | { name: "admin" };

// "ครบทุกภาค" / "ภาค ข + วิชาเอก" / "ภาค ก + ข" for the header badge.
function planLabel(me: Me) {
  const ks = new Set((me.packages ?? []).map(p => p.package));
  if (ks.has("ALL") || (ks.has("A") && ks.has("B"))) return "ครบทุกภาค";
  if (ks.has("A")) return "ภาค ก";
  if (ks.has("B")) return "ภาค ข";
  return "สมาชิก";
}

function PrepShell() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Profile>({ major: null, major_name: null });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [skipMajor, setSkipMajor] = useState(() => { try { return sessionStorage.getItem("pp-major-skip") === "1"; } catch { return false; } });
  const [view, setView] = useState<View>({ name: "home" });
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "ซ้อมสอบ SOBPREP | ซ้อมข้อสอบครูผู้ช่วย";
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshMe = useCallback(async () => {
    try { setMe(await rpc<Me>("prep_me")); setError(""); }
    catch (e) { setError(thaiError(e)); }
    rpc<Profile>("prep_profile").then(p => { setProfile(p); setProfileLoaded(true); }).catch(() => { /* major is optional: without a profile we never block the app */ });
  }, []);
  const setMajor = (code: string, name: string) => setProfile({ major: code, major_name: name });

  useEffect(() => { if (session) { refreshMe(); track("visit"); } else setMe(null); }, [session, refreshMe]);
  const [unread, setUnread] = useState(0);
  const signedIn = !!session;
  useEffect(() => (signedIn ? startPing() : undefined), [signedIn]);
  const clearUnread = useCallback(() => setUnread(0), []);

  useEffect(() => {
    if (!signedIn || view.name === "account") return;
    rpc<{ unread: number }>("prep_my_notifications").then(r => setUnread(r.unread)).catch(() => { /* the dot is optional */ });
  }, [signedIn, view.name]);

  const startRound = async (setId: string, mode: "full" | "wrong") => {
    try {
      const round = await rpc<Round>("prep_start_round", { p_set: setId, p_mode: mode });
      setView({ name: "play", round });
      window.scrollTo(0, 0);
    } catch (e) {
      alert(thaiError(e));
      if (e instanceof Error && e.message === "pack_expired") go("account");
    }
  };

  const startReview = async (kind: "due" | "wrong") => {
    try {
      const id = await rpc<string>("prep_create_review_set", { p_kind: kind });
      await startRound(id, "full");
    } catch (e) { alert(thaiError(e)); }
  };

  if (session === undefined) return <Waiting />;
  if (!session) return <Login />;
  if (!me) {
    return (
      <div className="pp-center">
        {error ? <div className="pp-card"><div className="pp-error">{error}</div>
          <button className="pp-btn pp-btn-primary" onClick={refreshMe}>ลองใหม่</button></div>
          : <Waiting />}
      </div>
    );
  }

  // Everyone without a major is asked to choose one at the start of each visit (first visit, and old accounts that never did).
  // "Skip" only lasts for this browser session, so the next visit asks again.
  if (profileLoaded && !profile.major && !skipMajor) {
    return (
      <div className="pp-center">
        <MajorPicker forced current={null} onClose={() => { /* forced: not dismissible */ }} onSaved={setMajor}
          onSkip={() => { try { sessionStorage.setItem("pp-major-skip", "1"); } catch { /* ignore */ } setSkipMajor(true); }} />
      </div>
    );
  }

  if (view.name === "mockplay") {
    return (
      <MockPlayer
        key={view.payload.attempt_id}
        payload={view.payload}
        onExit={() => setView({ name: "mock" })}
        onDone={payload => { setView({ name: "mockresult", payload }); window.scrollTo(0, 0); refreshMe(); }}
      />
    );
  }

  if (view.name === "play") {
    return (
      <Player
        round={view.round}
        onExit={() => { setView({ name: "home" }); refreshMe(); }}
        onSubmitted={result => { setView({ name: "result", result, title: view.round.title }); refreshMe(); }}
      />
    );
  }

  const tabs: { key: View["name"]; label: string; icon: ReactNode }[] = [
    { key: "home", label: "ทำข้อสอบ", icon: <IconHome /> },
    { key: "calendar", label: "ปฏิทิน", icon: <IconCalendar /> },
    { key: "stats", label: "วิเคราะห์", icon: <IconChart /> },
    { key: "account", label: me.plan === "paid" ? "บัญชี" : "อัปเกรด", icon: me.plan === "paid" ? <IconUser /> : <IconCrown /> },
    ...(me.is_admin ? [{ key: "admin" as const, label: "แอดมิน", icon: <IconShield /> }] : []),
  ];
  const active = (k: View["name"]) => view.name === k || (k === "home" && (view.name === "create" || view.name === "result" || view.name === "daily" || view.name === "mock" || view.name === "mockresult"));
  const go = (k: View["name"]) => { setView({ name: k } as View); window.scrollTo(0, 0); };
  const practice = (preset?: Preset) => { setView({ name: "create", preset }); window.scrollTo(0, 0); };

  return (
    <div className="pp-app">
      <header className="pp-top">
        <div className="pp-top-in">
          <button className="pp-brand" onClick={() => go("home")}>
            <Logo size={36} />
            <span className="pp-brand-t">ซ้อมสอบ<small>SOBPREP</small></span>
          </button>
          <nav className="pp-tabs">
            {tabs.map(t => (
              <button key={t.key} className={active(t.key) ? "on" : ""} onClick={() => go(t.key)}>{t.icon}{t.label}{t.key === "account" && unread > 0 && <i className="pp-dot" aria-label="มีข่าวใหม่" />}</button>
            ))}
          </nav>
          <span className="pp-spacer" />
          <span className={`pp-plan ${me.plan}`}>{me.plan === "paid" ? `★ ${planLabel(me)}` : `ฟรี ${Math.max(0, me.free_sets_limit - me.free_sets_used)}/${me.free_sets_limit} ชุด`}</span>
        </div>
      </header>
      <main className="pp-main">
        {view.name === "home" && <Home me={me} profile={profile} onMajor={setMajor} onCreate={practice} onStart={startRound} onReview={startReview} onDaily={() => go("daily")} onMock={() => go("mock")} onCalendar={() => go("calendar")} onUpgrade={() => go("account")} onStats={() => go("stats")} />}
        {view.name === "create" && <CreateSet me={me} major={profile.major} preset={view.preset} onCancel={() => go("home")}
          onCreated={async id => { await refreshMe(); startRound(id, "full"); }} onUpgrade={() => go("account")} />}
        {view.name === "result" && <RoundResult result={view.result} title={view.title} me={me} onStart={startRound}
          onHome={() => go("home")} onUpgrade={() => go("account")} />}
        {view.name === "daily" && <DailyQuiz onBack={() => go("home")} />}
        {view.name === "mock" && <MockHome onBack={() => go("home")} onUpgrade={() => go("account")} onAccount={() => go("account")}
          onOpen={payload => { setView(payload.submitted ? { name: "mockresult", payload } : { name: "mockplay", payload }); window.scrollTo(0, 0); }} />}
        {view.name === "mockresult" && <MockResult payload={view.payload} onBack={() => go("mock")} onReview={() => startReview("wrong")} />}
        {view.name === "calendar" && <Calendar onBack={() => go("home")} />}
        {view.name === "stats" && <Stats me={me} profile={profile} onPractice={practice} />}
        {view.name === "account" && <Account me={me} email={session.user.email ?? ""} profile={profile} onMajor={setMajor} onChanged={refreshMe} onNotifRead={clearUnread} />}
        {view.name === "admin" && me.is_admin && <Admin />}
      </main>
      <nav className="pp-nav" aria-label="เมนูหลัก">
        {tabs.map(t => (
          <button key={t.key} className={active(t.key) ? "on" : ""} onClick={() => go(t.key)} aria-current={active(t.key) ? "page" : undefined}>
            {t.icon}<span>{t.label}</span>{t.key === "account" && unread > 0 && <i className="pp-dot" aria-label="มีข่าวใหม่" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

// The guide and the privacy page are public: they must open without signing in, so they are chosen before any auth work starts.
export default function PrepApp() {
  const path = window.location.pathname;
  const page = /^\/prep\/guide\/?$/.test(path) ? <Guide /> : /^\/prep\/privacy\/?$/.test(path) ? <Privacy /> : <PrepShell />;
  return <><MovedBanner />{page}</>;
}
