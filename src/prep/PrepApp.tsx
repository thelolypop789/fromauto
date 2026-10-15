import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { rpc, supabase, thaiError, type Me, type Round, type SubmitResult } from "./api";
import Login from "./Login";
import Home from "./Home";
import CreateSet from "./CreateSet";
import Player from "./Player";
import RoundResult from "./RoundResult";
import Stats from "./Stats";
import Account from "./Account";
import Admin from "./Admin";
import "./prep.css";

type View =
  | { name: "home" }
  | { name: "create" }
  | { name: "play"; round: Round }
  | { name: "result"; result: SubmitResult; title: string }
  | { name: "stats" }
  | { name: "account" }
  | { name: "admin" };

export default function PrepApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<View>({ name: "home" });
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "ซ้อมข้อสอบครูผู้ช่วย | FormAuto";
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshMe = useCallback(async () => {
    try { setMe(await rpc<Me>("prep_me")); setError(""); }
    catch (e) { setError(thaiError(e)); }
  }, []);

  useEffect(() => { if (session) refreshMe(); else setMe(null); }, [session, refreshMe]);

  const startRound = async (setId: string, mode: "full" | "wrong") => {
    try {
      const round = await rpc<Round>("prep_start_round", { p_set: setId, p_mode: mode });
      setView({ name: "play", round });
      window.scrollTo(0, 0);
    } catch (e) { alert(thaiError(e)); }
  };

  if (session === undefined) return <div className="pp-center"><div className="pp-spinner" /></div>;
  if (!session) return <Login />;
  if (!me) {
    return (
      <div className="pp-center">
        {error ? <div className="pp-card"><div className="pp-error">{error}</div>
          <button className="pp-btn pp-btn-primary" onClick={refreshMe}>ลองใหม่</button></div>
          : <div className="pp-spinner" />}
      </div>
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

  const tabs: { key: View["name"]; label: string }[] = [
    { key: "home", label: "ชุดของฉัน" },
    { key: "stats", label: "วิเคราะห์" },
    { key: "account", label: me.plan === "paid" ? "บัญชี" : "อัปเกรด" },
    ...(me.is_admin ? [{ key: "admin" as const, label: "แอดมิน" }] : []),
  ];

  return (
    <div className="pp-app">
      <header className="pp-top">
        <div className="pp-brand" onClick={() => setView({ name: "home" })}>📝 ซ้อมครูผู้ช่วย</div>
        <span className={`pp-plan ${me.plan}`}>{me.plan === "paid" ? "สมาชิก" : `ฟรี ${Math.max(0, me.free_sets_limit - me.free_sets_used)}/${me.free_sets_limit} ชุด`}</span>
      </header>
      <nav className="pp-tabs">
        {tabs.map(t => (
          <button key={t.key} className={view.name === t.key || (t.key === "home" && (view.name === "create" || view.name === "result")) ? "on" : ""}
            onClick={() => setView({ name: t.key } as View)}>{t.label}</button>
        ))}
      </nav>
      <main className="pp-main">
        {view.name === "home" && <Home me={me} onCreate={() => setView({ name: "create" })} onStart={startRound} onUpgrade={() => setView({ name: "account" })} />}
        {view.name === "create" && <CreateSet me={me} onCancel={() => setView({ name: "home" })}
          onCreated={async id => { await refreshMe(); startRound(id, "full"); }} onUpgrade={() => setView({ name: "account" })} />}
        {view.name === "result" && <RoundResult result={view.result} title={view.title} me={me} onStart={startRound}
          onHome={() => setView({ name: "home" })} onUpgrade={() => setView({ name: "account" })} />}
        {view.name === "stats" && <Stats me={me} onWeakSet={() => setView({ name: "create" })} />}
        {view.name === "account" && <Account me={me} email={session.user.email ?? ""} onChanged={refreshMe} />}
        {view.name === "admin" && me.is_admin && <Admin />}
      </main>
    </div>
  );
}
