import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { rpc, supabase, thaiError, startPing, track, type Me, type MockPayload, type Profile, type Round, type SubmitResult } from "./api";
import Login from "./Login";
import Home from "./Home";
import CreateSet, { type Preset } from "./CreateSet";
import Player from "./Player";
import RoundResult from "./RoundResult";
import Stats from "./Stats";
import Account from "./Account";
import Buy from "./Buy";
import Guide from "./Guide";
import Calendar from "./Calendar";
import Privacy from "./Privacy";
import MovedBanner from "./MovedBanner";
import DailyQuiz from "./DailyQuiz";
import Leaderboard from "./Leaderboard";
import MockHome from "./MockHome";
import MockPlayer from "./MockPlayer";
import MockResult from "./MockResult";
import { IconCalendar, IconChart, IconCrown, IconHome, IconMap, IconShield, IconUser, Logo } from "./icons";
import Feedback from "./Feedback";
import { setupPwa } from "./pwa";
import { goBack, navigate, usePath } from "./router";
import Waiting from "./Waiting";
import PastExams from "./PastExams";
import MajorPicker from "./MajorPicker";
import TrackPicker from "./TrackPicker";
import "./prep.css";
import { notify } from "./dialog";
import { DialogHost } from "./DialogHost";
import { applyReadScale } from "./readScale";
import Skeleton from "./Skeleton";

// Loaded on first open: the admin screens are for staff only, and the summaries bring their own font and styles.
const Admin = lazy(() => import("./Admin"));
const Summary = lazy(() => import("./Summary"));

setupPwa();
applyReadScale();

// Screens and their URLs (router.ts). play / result / mockplay / mockresult show data held in memory: opened from a
// refresh or a bookmark without it, they fall back to home (an open round can be resumed from there).
const PATHS = {
  home: "/prep", create: "/prep/create", play: "/prep/play", result: "/prep/result", stats: "/prep/stats", daily: "/prep/daily",
  board: "/prep/board", mock: "/prep/mock", mockplay: "/prep/mock/play", mockresult: "/prep/mock/result", calendar: "/prep/calendar",
  feedback: "/prep/feedback", account: "/prep/me", buy: "/prep/buy", summary: "/prep/summary", past: "/prep/past", admin: "/prep/admin",
} as const;
type ViewName = keyof typeof PATHS;
function viewFromPath(path: string): ViewName {
  const p = path.replace(/\/+$/, "") || "/prep";
  if (p === "/prep/account") return "account";   // the old name of /prep/me
  if (p.startsWith("/prep/summary")) return "summary";
  const hit = (Object.entries(PATHS) as [ViewName, string][]).find(([, v]) => v === p);
  return hit ? hit[0] : "home";
}
type Held = { preset?: Preset; round?: Round; result?: SubmitResult; title?: string; mock?: MockPayload };

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
  const [profile, setProfile] = useState<Profile>({ major: null, major_name: null, track: "obec" });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [skipMajor, setSkipMajor] = useState(() => { try { return sessionStorage.getItem("pp-major-skip") === "1"; } catch { return false; } });
  const path = usePath();
  const [held, setHeld] = useState<Held>({});
  const routed = viewFromPath(path);
  const missing = (routed === "play" && !held.round) || (routed === "result" && !held.result)
    || ((routed === "mockplay" || routed === "mockresult") && !held.mock);
  const view = { name: missing ? "home" as const : routed };
  useEffect(() => { if (missing) navigate(PATHS.home, { replace: true }); }, [missing]);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
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
  const setMajor = (code: string, name: string) => setProfile(p => ({ ...p, major: code, major_name: name }));
  // A track switch changes which topics, majors and mock mix apply: remount the page so every card reloads.
  const [reloadKey, setReloadKey] = useState(0);
  const changeProfile = (p: Profile) => { setProfile(p); setReloadKey(k => k + 1); };

  useEffect(() => { if (session) { refreshMe(); track("visit"); } else setMe(null); }, [session, refreshMe]);
  // Back from sign-in: continue to the screen the visitor opened before signing in (Login.tsx remembers it).
  useEffect(() => {
    if (!session) return;
    let to: string | null = null;
    try { to = sessionStorage.getItem("pp-after-login"); sessionStorage.removeItem("pp-after-login"); } catch { /* storage blocked */ }
    if (to && location.pathname === "/prep" && to.startsWith("/prep/")) navigate(to, { replace: true });
  }, [session]);
  const [unread, setUnread] = useState(0);
  const signedIn = !!session;
  // The สรุป tab appears once an admin has approved at least one map (admins always see it).
  const [summaries, setSummaries] = useState(0);
  useEffect(() => {
    if (signedIn) rpc<string[]>("prep_summary_approved").then(ids => setSummaries(ids.length)).catch(() => { /* optional tab */ });
  }, [signedIn]);
  useEffect(() => (signedIn ? startPing() : undefined), [signedIn]);
  const clearUnread = useCallback(() => setUnread(0), []);

  useEffect(() => {
    if (!signedIn || view.name === "account") return;
    rpc<{ unread: number }>("prep_my_notifications").then(r => setUnread(r.unread)).catch(() => { /* the dot is optional */ });
  }, [signedIn, view.name]);

  const startRound = async (setId: string, mode: "full" | "wrong") => {
    try {
      const round = await rpc<Round>("prep_start_round", { p_set: setId, p_mode: mode });
      setHeld({ round });
      // A round started from "create" replaces it: back from the round should not reopen the create form.
      navigate(PATHS.play, { replace: viewFromPath(location.pathname) === "create" });
    } catch (e) {
      notify(thaiError(e));
      if (e instanceof Error && e.message === "pack_expired") go("buy");
    }
  };

  const startReview = async (kind: "due" | "wrong") => {
    try {
      const id = await rpc<string>("prep_create_review_set", { p_kind: kind });
      await startRound(id, "full");
    } catch (e) { notify(thaiError(e)); }
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

  // The exam (สพฐ./สอศ.) is asked once. First-time users (and returning users who still have no major) get it as the
  // first screen, before the major picker; everyone else sees it as a popup over the app (see below).
  const askTrack = profileLoaded && profile.track_chosen === false;
  if (askTrack && (!profile.returning || !profile.major)) {
    return (
      <div className="pp-center">
        <TrackPicker variant={profile.returning ? "popup" : "first"} current={profile.track} onDone={changeProfile} />
      </div>
    );
  }

  // Everyone without a major is asked to choose one at the start of each visit (first visit, and old accounts that never did).
  // "Skip" lasts for this browser session and can be used only MAX_MAJOR_SKIPS times on a device: after that a choice is required.
  if (profileLoaded && !profile.major && !skipMajor) {
    return (
      <div className="pp-center">
        <MajorPicker forced current={null} track={profile.track} onTrack={changeProfile} onClose={() => { /* forced: not dismissible */ }} onSaved={setMajor}
          skipsLeft={Math.max(0, MAX_MAJOR_SKIPS - readSkips())}
          onSkip={() => { writeSkips(readSkips() + 1); try { sessionStorage.setItem("pp-major-skip", "1"); } catch { /* ignore */ } setSkipMajor(true); }} />
      </div>
    );
  }

  if (view.name === "mockplay" && held.mock) {
    return (
      <MockPlayer
        key={held.mock.attempt_id}
        payload={held.mock}
        onExit={() => navigate(PATHS.mock, { replace: true })}
        onDone={payload => { setHeld({ mock: payload }); navigate(PATHS.mockresult, { replace: true }); refreshMe(); }}
      />
    );
  }

  if (view.name === "play" && held.round) {
    const round = held.round;
    return (
      <Player
        round={round}
        onExit={() => { navigate(PATHS.home, { replace: true }); refreshMe(); }}
        onSubmitted={result => { setHeld({ result, title: round.title }); navigate(PATHS.result, { replace: true }); refreshMe(); }}
      />
    );
  }

  // Five tabs at most for users (a sixth for admins). Feedback lives on the "ฉัน" page, buying behind the header button.
  const tabs: { key: ViewName; label: string; icon: ReactNode }[] = [
    { key: "home", label: "ทำข้อสอบ", icon: <IconHome /> },
    ...(me.is_admin || summaries > 0 ? [{ key: "summary" as const, label: "สรุป", icon: <IconMap /> }] : []),
    { key: "stats", label: "วิเคราะห์", icon: <IconChart /> },
    { key: "calendar", label: "ปฏิทิน", icon: <IconCalendar /> },
    { key: "account", label: "ฉัน", icon: <IconUser /> },
    ...(me.is_admin ? [{ key: "admin" as const, label: "แอดมิน", icon: <IconShield /> }] : []),
  ];
  const active = (k: ViewName) => view.name === k || (k === "home" && (view.name === "create" || view.name === "result" || view.name === "daily" || view.name === "board" || view.name === "mock" || view.name === "mockresult" || view.name === "past"))
    || (k === "account" && (view.name === "buy" || view.name === "feedback"));
  const freeLeft = Math.max(0, me.free_sets_limit - me.free_sets_used);
  const go = (k: ViewName) => navigate(PATHS[k]);
  const back = (k: ViewName) => goBack(PATHS[k]);
  const practice = (preset?: Preset) => { setHeld({ preset }); navigate(PATHS.create); };

  return (
    <div className="pp-app">
      {askTrack && <TrackPicker variant="popup" current={profile.track} onDone={changeProfile} />}
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
          {me.plan === "paid"
            ? <span className="pp-plan paid">★ {planLabel(me)}</span>
            : (
              <button className="pp-plan free pp-plan-up" onClick={() => go("buy")} aria-label={`เหลือชุดฟรี ${freeLeft} ชุด · ดูแพ็ก`}>
                <IconCrown size={15} /><span>อัปเกรด</span><small>เหลือฟรี {freeLeft} ชุด</small>
              </button>
            )}
        </div>
      </header>
      <main className="pp-main" key={reloadKey}>
        <Suspense fallback={<Skeleton kind="cards" n={2} />}>
        {view.name === "home" && <Home me={me} profile={profile} onMajor={setMajor} onProfile={changeProfile} onCreate={practice} onStart={startRound} onReview={startReview} onDaily={() => go("daily")} onMock={() => go("mock")} onPast={() => go("past")} onCalendar={() => go("calendar")} onUpgrade={() => go("buy")} onStats={() => go("stats")} onBoard={() => go("board")} joined={session.user.created_at} />}
        {view.name === "create" && <CreateSet me={me} major={profile.major} preset={held.preset} onCancel={() => go("home")}
          onCreated={async id => { await refreshMe(); startRound(id, "full"); }} onUpgrade={() => go("buy")} />}
        {view.name === "result" && held.result && <RoundResult result={held.result} title={held.title ?? ""} me={me} onStart={startRound}
          onHome={() => go("home")} onUpgrade={() => go("buy")} />}
        {view.name === "daily" && <DailyQuiz onBack={() => back("home")} />}
        {view.name === "board" && <Leaderboard onBack={() => back("home")} isAdmin={me.is_admin} />}
        {view.name === "mock" && <MockHome onBack={() => back("home")} onUpgrade={() => go("buy")} onAccount={() => go("account")}
          onOpen={payload => { setHeld({ mock: payload }); navigate(payload.submitted ? PATHS.mockresult : PATHS.mockplay); }} />}
        {view.name === "mockresult" && held.mock && <MockResult payload={held.mock} onBack={() => back("mock")} onReview={() => startReview("wrong")} />}
        {view.name === "calendar" && <Calendar onBack={() => back("home")} />}
        {view.name === "feedback" && <Feedback page="tab" />}
        {view.name === "past" && <PastExams onBack={() => back("home")} onUpgrade={() => go("buy")}
          onCreated={async id => { await refreshMe(); startRound(id, "full"); }} />}
        {view.name === "summary" && <Summary isAdmin={me.is_admin} onPractice={practice} onUpgrade={() => go("buy")}
          onPastSet={async id => { await refreshMe(); startRound(id, "full"); }} />}
        {view.name === "stats" && <Stats me={me} profile={profile} onPractice={practice} />}
        {view.name === "account" && <Account me={me} email={session.user.email ?? ""} profile={profile} onMajor={setMajor} onProfile={changeProfile} onChanged={refreshMe} onNotifRead={clearUnread} onBuy={() => go("buy")} />}
        {view.name === "buy" && <Buy me={me} email={session.user.email ?? ""} onChanged={refreshMe} />}
        {view.name === "admin" && me.is_admin && <Admin />}
        </Suspense>
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
const MAX_MAJOR_SKIPS = 2;
const readSkips = () => { try { return Number(localStorage.getItem("pp-major-skips")) || 0; } catch { return 0; } };
const writeSkips = (n: number) => { try { localStorage.setItem("pp-major-skips", String(n)); } catch { /* storage blocked: the session flag still applies */ } };

export default function PrepApp() {
  const path = window.location.pathname;
  const page = /^\/prep\/guide\/?$/.test(path) ? <Guide /> : /^\/prep\/privacy\/?$/.test(path) ? <Privacy /> : <PrepShell />;
  return <><MovedBanner />{page}<DialogHost /></>;
}
