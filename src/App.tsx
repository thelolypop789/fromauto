import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function genKey(role: string) {
  const prefix = role === "admin" ? "ADMIN" : "USER";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(36).padStart(2,"0")).join("").toUpperCase();
  return `${prefix}-${hex.slice(0,6)}-${hex.slice(6,10)}`;
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Prompt:wght@500;600;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --blue:#7C3AED; --blue-dark:#6D28D9; --blue-light:#EDE9FE;
    --green:#1e8e3e; --green-light:#e6f4ea;
    --red:#d93025; --red-light:#fce8e6;
    --yellow:#f9ab00; --yellow-light:#fef7e0;
    --purple:#9333EA; --purple-light:#F3E8FF;
    --gray-50:#F5F3FF; --gray-100:#f1f3f4; --gray-200:#e8eaed;
    --gray-400:#9aa0a6; --gray-600:#5f6368; --gray-800:#3c4043; --gray-900:#202124;
    --shadow-sm:0 1px 3px rgba(60,64,67,.15); --shadow-lg:0 4px 12px rgba(60,64,67,.15);
    --radius:8px; --radius-lg:12px;
  }
  body { font-family:'Sarabun',sans-serif; background:var(--gray-50); color:var(--gray-900); }
  .app { min-height:100vh; display:flex; flex-direction:column; }
  .login-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#EDE9FE 0%,#F5F3FF 50%,#F3E8FF 100%); }
  .login-card { background:white; border-radius:var(--radius-lg); padding:48px 40px; width:100%; max-width:420px; box-shadow:var(--shadow-lg); animation:slideUp .4s ease; }
  @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  .login-logo { display:flex; align-items:center; gap:12px; margin-bottom:32px; }
  .login-logo-title { font-family:'Prompt',sans-serif; font-size:20px; font-weight:600; }
  .login-logo-sub { font-size:12px; color:var(--gray-600); }
  .login-title { font-size:24px; font-weight:600; margin-bottom:8px; }
  .login-sub { font-size:14px; color:var(--gray-600); margin-bottom:28px; }
  .field { margin-bottom:18px; }
  .field label { display:block; font-size:13px; font-weight:500; color:var(--gray-800); margin-bottom:6px; }
  .field input, .field textarea, .field select { width:100%; padding:10px 14px; border:1.5px solid var(--gray-200); border-radius:var(--radius); font-size:14px; font-family:'Sarabun',sans-serif; outline:none; transition:border-color .2s; background:white; color:var(--gray-900); }
  .field input:focus, .field textarea:focus, .field select:focus { border-color:var(--blue); }
  .field input.error { border-color:var(--red); }
  .field textarea { resize:vertical; min-height:80px; }
  .error-msg { font-size:12px; color:var(--red); margin-top:4px; }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:10px 20px; border-radius:var(--radius); border:none; cursor:pointer; font-family:'Sarabun',sans-serif; font-size:14px; font-weight:600; transition:all .15s; white-space:nowrap; }
  .btn-primary { background:var(--blue); color:white; width:100%; padding:12px; font-size:15px; }
  .btn-primary:hover { background:var(--blue-dark); }
  .btn-secondary { background:var(--gray-100); color:var(--gray-800); }
  .btn-secondary:hover { background:var(--gray-200); }
  .btn-green { background:var(--green); color:white; }
  .btn-green:hover { background:#1a7a35; }
  .btn-red { background:var(--red-light); color:var(--red); }
  .btn-red:hover { background:#f5c6c3; }
  .btn-purple { background:var(--purple); color:white; }
  .btn-purple:hover { background:#6d28d9; }
  .btn-sm { padding:6px 14px; font-size:13px; }
  .btn-icon { padding:7px; background:transparent; border:1px solid var(--gray-200); color:var(--gray-600); border-radius:6px; }
  .btn-icon:hover { background:var(--gray-100); }
  .btn:disabled { opacity:.5; cursor:not-allowed; }
  .topbar { background:linear-gradient(135deg,#7C3AED 0%,#6D28D9 100%); border-bottom:none; display:flex; align-items:center; padding:0 24px; height:60px; position:sticky; top:0; z-index:100; box-shadow:0 2px 12px rgba(124,58,237,.3); }
  .topbar-brand { display:flex; align-items:center; gap:10px; flex:1; }
  .topbar-title { font-family:'Prompt',sans-serif; font-size:17px; font-weight:600; color:white; }
  .topbar-user { display:flex; align-items:center; gap:10px; }
  .role-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; }
  .role-admin { background:var(--purple-light); color:var(--purple); }
  .role-user { background:var(--blue-light); color:var(--blue); }
  .main-layout { display:flex; flex:1; min-height:calc(100vh - 60px); }
  .sidebar { width:220px; background:white; border-right:1px solid var(--gray-200); padding:16px 12px; flex-shrink:0; }
  .sidebar-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:var(--radius); cursor:pointer; font-size:14px; font-weight:500; color:var(--gray-600); transition:all .15s; margin-bottom:2px; border:none; background:none; width:100%; text-align:left; }
  .sidebar-item:hover { background:var(--gray-100); color:var(--gray-900); }
  .sidebar-item.active { background:var(--blue-light); color:var(--blue); font-weight:600; }
  .sidebar-item.admin-active { background:var(--purple-light); color:var(--purple); font-weight:600; }
  .sidebar-section { font-size:11px; font-weight:600; color:var(--gray-400); padding:8px 12px 4px; text-transform:uppercase; letter-spacing:.8px; margin-top:8px; }
  .content { flex:1; padding:28px; overflow-y:auto; }
  .stepper { display:flex; align-items:center; margin-bottom:28px; }
  .step-dot { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; transition:all .2s; }
  .step-dot.done { background:var(--green); color:white; }
  .step-dot.active { background:var(--blue); color:white; box-shadow:0 0 0 4px rgba(124,58,237,.2); }
  .step-dot.pending { background:var(--gray-200); color:var(--gray-600); }
  .step-label { font-size:12px; font-weight:500; }
  .step-label.active { color:var(--blue); font-weight:600; }
  .step-label.done { color:var(--green); }
  .step-label.pending { color:var(--gray-400); }
  .step-line { flex:1; height:2px; background:var(--gray-200); margin:0 6px; min-width:16px; }
  .step-line.done { background:var(--green); }
  .card { background:white; border-radius:var(--radius-lg); padding:24px; box-shadow:var(--shadow-sm); border:1px solid var(--gray-200); margin-bottom:20px; }
  .card-title { font-family:'Prompt',sans-serif; font-size:16px; font-weight:600; margin-bottom:4px; }
  .card-sub { font-size:13px; color:var(--gray-600); margin-bottom:20px; }
  .header-list { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }
  .header-row { display:flex; align-items:center; gap:8px; }
  .header-input { flex:1; padding:8px 12px; border:1.5px solid var(--gray-200); border-radius:var(--radius); font-size:14px; font-family:'Sarabun',sans-serif; outline:none; }
  .header-input:focus { border-color:var(--blue); }
  .header-badge { font-size:11px; font-weight:600; padding:3px 8px; border-radius:20px; background:var(--blue-light); color:var(--blue); cursor:pointer; white-space:nowrap; }
  .header-badge.required { background:var(--red-light); color:var(--red); }
  .upload-zone { border:2px dashed var(--gray-200); border-radius:var(--radius-lg); padding:40px; text-align:center; cursor:pointer; transition:all .2s; background:var(--gray-50); }
  .upload-zone:hover { border-color:var(--blue); background:var(--blue-light); }
  .upload-zone.has-file { border-color:var(--green); background:var(--green-light); border-style:solid; }
  .upload-text { font-size:15px; font-weight:500; color:var(--gray-700); margin-bottom:4px; margin-top:12px; }
  .upload-hint { font-size:13px; color:var(--gray-500); }
  .question-list { display:flex; flex-direction:column; gap:12px; }
  .question-card { border:1.5px solid var(--gray-200); border-radius:var(--radius); padding:16px; background:white; }
  .question-card:hover { border-color:var(--blue); }
  .q-header { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
  .q-num { font-size:12px; font-weight:700; color:var(--blue); background:var(--blue-light); padding:2px 8px; border-radius:20px; white-space:nowrap; }
  .q-text-input { flex:1; padding:8px 12px; border:1.5px solid var(--gray-200); border-radius:var(--radius); font-size:14px; font-family:'Sarabun',sans-serif; outline:none; }
  .q-text-input:focus { border-color:var(--blue); }
  .choices-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
  .choice-row { display:flex; align-items:center; gap:6px; }
  .choice-label { width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; cursor:pointer; transition:all .15s; border:2px solid var(--gray-200); color:var(--gray-600); }
  .choice-label.correct { background:var(--green); border-color:var(--green); color:white; }
  .choice-label.wrong { background:var(--gray-100); }
  .choice-input { flex:1; padding:6px 10px; border:1.5px solid var(--gray-200); border-radius:6px; font-size:13px; font-family:'Sarabun',sans-serif; outline:none; }
  .choice-input:focus { border-color:var(--blue); }
  .choice-input.correct { border-color:var(--green); background:var(--green-light); }
  .result-card { background:linear-gradient(135deg,#1a73e8 0%,#0d47a1 100%); border-radius:var(--radius-lg); padding:32px; color:white; text-align:center; margin-bottom:20px; animation:slideUp .4s ease; }
  .result-title { font-family:'Prompt',sans-serif; font-size:22px; font-weight:700; margin-bottom:8px; }
  .result-sub { font-size:14px; opacity:.85; margin-bottom:24px; }
  .link-box { background:white; border-radius:var(--radius); padding:14px 16px; display:flex; align-items:center; gap:10px; margin-bottom:10px; text-align:left; }
  .link-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; margin-bottom:3px; }
  .link-label.edit { color:var(--blue); }
  .link-label.view { color:var(--green); }
  .link-url { font-size:12px; color:var(--gray-600); font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
  .copy-btn { font-size:13px; padding:7px 14px; border-radius:6px; border:none; cursor:pointer; display:flex; align-items:center; gap:5px; font-family:'Sarabun',sans-serif; white-space:nowrap; font-weight:600; transition:opacity .15s; }
  .copy-btn:hover { opacity:.85; }
  .copy-btn.copied { background:#1e8e3e !important; color:white !important; }
  .loading-overlay { position:fixed; inset:0; background:rgba(255,255,255,.85); display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:200; }
  .spinner { width:48px; height:48px; border:4px solid var(--gray-200); border-top-color:var(--blue); border-radius:50%; animation:spin .8s linear infinite; margin-bottom:16px; }
  @keyframes spin { to{transform:rotate(360deg)} }
  .loading-text { font-size:15px; font-weight:500; color:var(--gray-700); }
  .loading-sub { font-size:13px; color:var(--gray-500); margin-top:4px; }
  .empty-state { text-align:center; padding:60px 20px; color:var(--gray-500); }
  .empty-icon { font-size:40px; margin-bottom:12px; }
  .progress-bar { height:4px; background:var(--gray-200); border-radius:2px; margin-top:8px; overflow:hidden; }
  .progress-fill { height:100%; background:var(--blue); border-radius:2px; transition:width .3s; }
  .nav-row { display:flex; gap:12px; align-items:center; justify-content:space-between; margin-top:8px; }
  .license-table { width:100%; border-collapse:collapse; }
  .license-table th { text-align:left; font-size:12px; font-weight:600; color:var(--gray-600); padding:8px 12px; border-bottom:2px solid var(--gray-200); }
  .license-table td { padding:12px; border-bottom:1px solid var(--gray-100); font-size:14px; vertical-align:middle; }
  .license-table tr:last-child td { border:none; }
  .license-table tr:hover td { background:var(--gray-50); }
  .badge { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:3px 8px; border-radius:20px; }
  .badge-green { background:var(--green-light); color:var(--green); }
  .badge-red { background:var(--red-light); color:var(--red); }
  .badge-blue { background:var(--blue-light); color:var(--blue); }
  .badge-purple { background:var(--purple-light); color:var(--purple); }
  .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); display:flex; align-items:center; justify-content:center; z-index:300; }
  .modal { background:white; border-radius:var(--radius-lg); padding:28px; width:100%; max-width:440px; box-shadow:var(--shadow-lg); animation:slideUp .3s ease; }
  .modal-title { font-family:'Prompt',sans-serif; font-size:18px; font-weight:600; margin-bottom:20px; }
  .modal-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:20px; }
  .stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px; }
  .stat-card { background:white; border-radius:var(--radius-lg); padding:20px; box-shadow:var(--shadow-sm); border:1px solid var(--gray-200); text-align:center; }
  .stat-number { font-family:'Prompt',sans-serif; font-size:32px; font-weight:700; margin-bottom:4px; }
  .stat-label { font-size:13px; color:var(--gray-600); }
@media (max-width:768px) {
    .main-layout { flex-direction:column; }
    .sidebar { width:100%; border-right:none; border-bottom:1px solid var(--gray-200); padding:8px; display:flex; flex-wrap:wrap; gap:4px; }
    .sidebar-section { display:none; }
    .sidebar-item { width:auto; padding:7px 12px; font-size:13px; }
    .content { padding:16px; }
    .stepper { overflow-x:auto; padding-bottom:8px; }
    .step-label { display:none; }
    .stats-grid { grid-template-columns:repeat(3,1fr); gap:8px; }
    .stat-number { font-size:22px; }
    .choices-grid { grid-template-columns:1fr; }
    .login-card { padding:32px 20px; }
    .topbar { padding:0 12px; }
    .topbar-title { font-size:15px; }
    .license-table { font-size:12px; }
    .license-table th, .license-table td { padding:8px 6px; }
    .result-card { padding:20px 16px; }
    .link-box { flex-direction:column; align-items:flex-start; gap:8px; }
    .modal { margin:16px; width:calc(100% - 32px); }
    .nav-row { flex-wrap:wrap; gap:8px; }
    .card { padding:16px; }
    .history-table { font-size:12px; }
    .history-table th, .history-table td { padding:8px 6px; }
  }
  @media (max-width:480px) {
    .stats-grid { grid-template-columns:1fr; }
    .topbar-user span[style*="monospace"] { display:none; }
    .upload-zone { padding:24px 16px; }
  }
  .history-table { width:100%; border-collapse:collapse; }
  .history-table th { text-align:left; font-size:12px; font-weight:600; color:var(--gray-600); padding:8px 12px; border-bottom:2px solid var(--gray-200); }
  .history-table td { padding:12px; border-bottom:1px solid var(--gray-100); font-size:14px; vertical-align:middle; }
  .history-table tr:last-child td { border:none; }
  .history-table tr:hover td { background:var(--gray-50); }`;

// ICONS
const Logo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="#7C3AED"/>
    <path d="M8 10h16M8 16h10M8 22h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="24" cy="22" r="4" fill="#A78BFA"/>
    <path d="M22 22l1.5 1.5L26 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const TrashIcon = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 4h9M5 4V3h5v1M6 7v4M9 7v4M4 4l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const CopyIcon = () => <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M3 10V3h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ExternalIcon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M7 2h4v4M11 2L6 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 3H3a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const LogoutIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3h3a1 1 0 011 1v8a1 1 0 01-1 1h-3M7 11l3-3-3-3M10 8H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const KeyIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/><path d="M9 8h5M12 8v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const FormIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const UploadIcon = () => <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 18V8M10 12l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const RefreshIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8A5 5 0 113 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 4v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const SheetIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2" width="11" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M2.5 6h11M6.5 6v8M10.5 6v8" stroke="currentColor" strokeWidth="1.2"/></svg>;

// ============ LOGIN ============
function LoginPage({ onLogin }: { onLogin: (u: any) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleGoogleUser(session.user);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) handleGoogleUser(session.user);
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  const handleGoogleUser = (user: any) => {
    if (user.email && user.email.endsWith("@wangluangpitt.ac.th")) {
      const isAdmin = user.email.toLowerCase() === "pongsarkon@wangluangpitt.ac.th";
      onLogin({
        key: user.email, // Use email as tracking key
        role: isAdmin ? "admin" : "user", // Admin for pongsarkon, User for other teachers
        note: user.user_metadata?.full_name || user.email,
        daily_limit: 999999, // Unlimited quota
        is_google: true
      });
    } else {
      setError("ขออภัย! อนุญาตเฉพาะอีเมล @wangluangpitt.ac.th เท่านั้น");
      supabase.auth.signOut();
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
    if (err) { setError(err.message); setLoading(false); }
  };

  const handleLogin = async () => {
    if (!key.trim()) { setError("กรุณากรอก License Key"); return; }
    setLoading(true); setError("");
    try {
      const { data: rows, error: err } = await supabase.rpc("validate_license", { p_key: key.trim().toUpperCase() });
      const data = Array.isArray(rows) ? (rows[0] ?? null) : (rows ?? null);
      if (err || !data) { setError("License Key ไม่ถูกต้องหรือถูกปิดใช้งาน"); setLoading(false); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setError("License Key หมดอายุแล้ว"); setLoading(false); return; }
      setLoading(false);
      onLogin({ key: data.key, role: data.role, note: data.note, daily_limit: data.daily_limit ?? 10 });
    } catch { setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); setLoading(false); }
  };

  return (
    <div className="login-page">
      {/* Decorative bg circles */}
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
        <div style={{position:"absolute",top:"-8%",right:"-4%",width:420,height:420,borderRadius:"50%",background:"rgba(124,58,237,.07)"}}/>
        <div style={{position:"absolute",bottom:"-8%",left:"-4%",width:320,height:320,borderRadius:"50%",background:"rgba(147,51,234,.05)"}}/>
        <div style={{position:"absolute",top:"40%",left:"5%",width:180,height:180,borderRadius:"50%",background:"rgba(167,139,250,.06)"}}/>
      </div>

      <div className="login-card" style={{position:"relative",zIndex:1}}>
        {/* Brand */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:72,height:72,background:"linear-gradient(135deg,#7C3AED 0%,#9333EA 100%)",borderRadius:20,marginBottom:14,boxShadow:"0 8px 28px rgba(124,58,237,.35)"}}>
            <svg width="38" height="38" viewBox="0 0 32 32" fill="none">
              <path d="M8 10h16M8 16h10M8 22h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="24" cy="22" r="4" fill="#A78BFA"/>
              <path d="M22 22l1.5 1.5L26 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{fontFamily:"'Prompt',sans-serif",fontSize:28,fontWeight:700,color:"var(--gray-900)",lineHeight:1.2}}>FormAuto</div>
          <div style={{fontSize:14,color:"var(--gray-500)",marginTop:6}}>สร้าง Google Form ข้อสอบ ใน 1 นาที</div>
        </div>

        {/* Feature chips */}
        <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:28,flexWrap:"wrap"}}>
          <span style={{fontSize:11,background:"var(--blue-light)",color:"var(--blue)",padding:"4px 11px",borderRadius:20,fontWeight:600}}>⚡ AI อ่านข้อสอบ</span>
          <span style={{fontSize:11,background:"var(--green-light)",color:"var(--green)",padding:"4px 11px",borderRadius:20,fontWeight:600}}>✅ มีเฉลยอัตโนมัติ</span>
          <span style={{fontSize:11,background:"var(--purple-light)",color:"var(--purple)",padding:"4px 11px",borderRadius:20,fontWeight:600}}>📋 .docx .pdf .txt</span>
        </div>

        {/* Google Login for Teachers */}
        <button className="btn btn-secondary" onClick={handleGoogleLogin} disabled={loading}
          style={{borderRadius:12,fontSize:15,padding:"13px",marginBottom:16,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"white",border:"1.5px solid var(--gray-200)"}}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          เข้าสู่ระบบด้วยอีเมลโรงเรียน
        </button>

        <div style={{display:"flex",alignItems:"center",margin:"20px 0",color:"var(--gray-400)",fontSize:13}}>
          <div style={{flex:1,height:1,background:"var(--gray-200)"}}></div>
          <span style={{padding:"0 10px"}}>หรือใช้ License Key</span>
          <div style={{flex:1,height:1,background:"var(--gray-200)"}}></div>
        </div>

        {/* Input */}
        <div className="field">
          <label style={{fontWeight:600}}>License Key</label>
          <div style={{position:"relative"}}>
            <input type={showKey?"text":"password"} placeholder="XXXX-XXXXXX-XXXX" value={key}
              onChange={e => { setKey(e.target.value); setError(""); }}
              onKeyDown={e => e.key==="Enter" && handleLogin()}
              className={error?"error":""}
              style={{paddingRight:52,letterSpacing:showKey?"normal":"0.12em",fontFamily:"monospace",fontSize:15}}/>
            <button onClick={() => setShowKey(v => !v)}
              style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"6px 10px",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6}}>
              {showKey?"🙈":"👁️"}
            </button>
          </div>
          {error && <div className="error-msg">⚠️ {error}</div>}
        </div>

        <button className="btn btn-primary" onClick={handleLogin} disabled={loading}
          style={{borderRadius:12,fontSize:15,padding:"13px",marginTop:4}}>
          {loading
            ? <><span style={{display:"inline-block",width:15,height:15,border:"2px solid rgba(255,255,255,.35)",borderTopColor:"white",borderRadius:"50%",animation:"spin .7s linear infinite",marginRight:8,verticalAlign:"middle"}}/>กำลังตรวจสอบ...</>
            : "🔓 เข้าใช้งาน"}
        </button>

        <div style={{textAlign:"center",marginTop:18,fontSize:12,color:"var(--gray-400)"}}>
          กรุณาติดต่อผู้ดูแลระบบเพื่อรับ Key
        </div>
      </div>
    </div>
  );
}

// ============ ADMIN PANEL ============
const GLOBAL_DAILY_LIMIT = 200;
const USER_DAILY_LIMIT = 10;

function AdminPanel({ adminKey }: { adminKey: string }) {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState({ role:"user", note:"", expires_at:"" });
  const [generatedKey, setGeneratedKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [usageToday, setUsageToday] = useState<Record<string, number>>({});
  const [totalToday, setTotalToday] = useState(0);

  const adminCall = async (action: string, params?: any) => {
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { admin_key: adminKey, action, params },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const [{ data: licenses }, { data: usage }] = await Promise.all([
        adminCall("list_licenses"),
        adminCall("get_usage"),
      ]);
      setLicenses(licenses || []);
      const map: Record<string, number> = {};
      let total = 0;
      for (const row of usage ?? []) { map[row.license_key] = row.requests; total += row.requests; }
      setUsageToday(map);
      setTotalToday(total);
    } catch (e: any) { alert("โหลดข้อมูลล้มเหลว: " + e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchLicenses(); }, []);

  const createLicense = async () => {
    const key = genKey(newKey.role);
    try {
      await adminCall("create_license", { key, role: newKey.role, note: newKey.note, expires_at: newKey.expires_at });
      setGeneratedKey(key);
      fetchLicenses();
    } catch (e: any) { alert("สร้าง Key ไม่สำเร็จ: " + e.message); }
  };

  const toggleActive = async (id: string, current: boolean, role: string) => {
    try {
      await adminCall("toggle_license", { id, is_active: current, role });
      fetchLicenses();
    } catch (e: any) { alert(e.message); }
  };

  const deleteLicense = async (id: string) => {
    if (!confirm("ต้องการลบ Key นี้ไหม?")) return;
    try {
      await adminCall("delete_license", { id });
      fetchLicenses();
    } catch (e: any) { alert("ลบ Key ไม่สำเร็จ: " + e.message); }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number" style={{color:"var(--blue)"}}>{licenses.length}</div>
          <div className="stat-label">Key ทั้งหมด</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{color:"var(--green)"}}>{licenses.filter(l=>l.is_active).length}</div>
          <div className="stat-label">ใช้งานได้</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{color:"var(--purple)"}}>{licenses.filter(l=>l.role==="admin").length}</div>
          <div className="stat-label">Admin</div>
        </div>
      </div>

      <div className="stats-grid" style={{marginBottom:24}}>
        <div className="stat-card">
          <div className="stat-number" style={{color:"var(--blue)"}}>{totalToday}</div>
          <div className="stat-label">AI ใช้วันนี้</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{color: GLOBAL_DAILY_LIMIT - totalToday <= 20 ? "var(--red)" : "var(--green)"}}>
            {GLOBAL_DAILY_LIMIT - totalToday}
          </div>
          <div className="stat-label">เหลือวันนี้</div>
        </div>
        <div className="stat-card">
          <div style={{position:"relative",height:8,background:"var(--gray-200)",borderRadius:4,margin:"8px 0 6px"}}>
            <div style={{
              position:"absolute",inset:0,right:"auto",
              width:`${Math.min(100, Math.round(totalToday/GLOBAL_DAILY_LIMIT*100))}%`,
              background: totalToday/GLOBAL_DAILY_LIMIT > 0.8 ? "var(--red)" : "var(--blue)",
              borderRadius:4,transition:"width .3s"
            }}/>
          </div>
          <div className="stat-label">{Math.round(totalToday/GLOBAL_DAILY_LIMIT*100)}% ของโควต้ารายวัน</div>
        </div>
      </div>

      <div className="card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div className="card-title">🔑 จัดการ License Keys</div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={fetchLicenses}><RefreshIcon /> รีเฟรช</button>
            <button className="btn btn-purple btn-sm" onClick={() => { setShowModal(true); setGeneratedKey(""); setNewKey({role:"user",note:"",expires_at:""}); }}>
              <PlusIcon /> สร้าง Key ใหม่
            </button>
          </div>
        </div>
        {loading ? (
          <div className="empty-state"><div className="spinner" style={{margin:"0 auto"}}/></div>
        ) : licenses.length===0 ? (
          <div className="empty-state"><div className="empty-icon">🔑</div><p>ยังไม่มี Key</p></div>
        ) : (
          <table className="license-table">
            <thead><tr>
              <th>Key</th><th>Role</th><th>หมายเหตุ</th><th>หมดอายุ</th><th>โควต้า/วัน</th><th>วันนี้</th><th>สถานะ</th><th>จัดการ</th>
            </tr></thead>
            <tbody>
              {licenses.map(l => (
                <tr key={l.id}>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontFamily:"monospace",fontSize:13,fontWeight:600}}>{l.key}</span>
                      <button className="btn btn-icon" style={{padding:"3px 6px"}} onClick={() => copy(l.key)}><CopyIcon /></button>
                    </div>
                  </td>
                  <td><span className={`badge ${l.role==="admin"?"badge-purple":"badge-blue"}`}>{l.role==="admin"?"👑 Admin":"👤 User"}</span></td>
                  <td style={{fontSize:13,color:"var(--gray-600)"}}>{l.note||"-"}</td>
                  <td style={{fontSize:13,color:"var(--gray-600)"}}>{l.expires_at?new Date(l.expires_at).toLocaleDateString("th-TH"):"ไม่มีวันหมดอายุ"}</td>
                  <td>
                    {l.role === "admin"
                      ? <span className="badge badge-purple">∞</span>
                      : <input
                          type="number" min={1} max={9999}
                          defaultValue={l.daily_limit ?? 10}
                          style={{width:60,padding:"3px 6px",border:"1.5px solid var(--gray-200)",borderRadius:6,fontSize:13,textAlign:"center",fontFamily:"inherit"}}
                          onBlur={async e => {
                            const val = parseInt(e.target.value);
                            if (!val || val < 1) { e.target.value = String(l.daily_limit ?? 10); return; }
                            await adminCall("update_quota", { id: l.id, daily_limit: val });
                          }}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        />
                    }
                  </td>
                  <td>
                    {l.role === "admin"
                      ? <span className="badge badge-purple">∞</span>
                      : <span className={`badge ${(usageToday[l.key]??0) >= (l.daily_limit ?? USER_DAILY_LIMIT) ? "badge-red" : "badge-blue"}`}>
                          {usageToday[l.key]??0}/{l.daily_limit ?? USER_DAILY_LIMIT}
                        </span>
                    }
                  </td>
                  <td><span className={`badge ${l.is_active?"badge-green":"badge-red"}`}>{l.is_active?"✅ ใช้งานได้":"❌ ปิดแล้ว"}</span></td>
                  <td>
                    <div style={{display:"flex",gap:6}}>
                      <button className={`btn btn-sm ${l.is_active?"btn-red":"btn-green"}`} onClick={() => toggleActive(l.id, l.is_active, l.role)}>
                        {l.is_active?"ปิด":"เปิด"}
                      </button>
                      <button className="btn btn-sm btn-red" onClick={() => deleteLicense(l.id)}><TrashIcon /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🔑 สร้าง License Key ใหม่</div>
            {generatedKey ? (
              <div>
                <div style={{background:"var(--green-light)",border:"2px solid var(--green)",borderRadius:"var(--radius)",padding:16,marginBottom:16,textAlign:"center"}}>
                  <div style={{fontSize:12,color:"var(--green)",fontWeight:600,marginBottom:8}}>Key ที่สร้างได้</div>
                  <div style={{fontFamily:"monospace",fontSize:20,fontWeight:700,letterSpacing:"0.1em"}}>{generatedKey}</div>
                </div>
                <button className="btn btn-green" style={{width:"100%"}} onClick={() => copy(generatedKey)}>
                  {copied ? <><CheckIcon /> คัดลอกแล้ว!</> : <><CopyIcon /> คัดลอก Key</>}
                </button>
                <div style={{marginTop:10}}>
                  <button className="btn btn-secondary" style={{width:"100%"}} onClick={() => { setGeneratedKey(""); setNewKey({role:"user",note:"",expires_at:""}); }}>
                    + สร้าง Key อีก
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Role</label>
                  <select value={newKey.role} onChange={e => setNewKey({...newKey,role:e.target.value})}>
                    <option value="user">👤 User — ใช้สร้างฟอร์ม</option>
                    <option value="admin">👑 Admin — จัดการระบบ</option>
                  </select>
                </div>
                <div className="field">
                  <label>หมายเหตุ (ชื่อลูกค้า)</label>
                  <input type="text" placeholder="เช่น ครูสมศรี โรงเรียนบ้านนา" value={newKey.note} onChange={e => setNewKey({...newKey,note:e.target.value})}/>
                </div>
                <div className="field">
                  <label>วันหมดอายุ (ไม่บังคับ)</label>
                  <input type="date" value={newKey.expires_at} onChange={e => setNewKey({...newKey,expires_at:e.target.value})}/>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                  <button className="btn btn-purple" onClick={createLicense}>✨ สร้าง Key</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ STEP 0: DETAILS ============
function StepDetails({
  formTitle, setFormTitle,
  formDesc, setFormDesc,
  targetGrade, setTargetGrade,
  targetRooms, setTargetRooms,
  onRoomsChange
}: any) {
  const grades = [
    { id: "", label: "ทั่วไป / ไม่ระบุ" },
    { id: "ม.1", label: "ม.1" },
    { id: "ม.2", label: "ม.2" },
    { id: "ม.3", label: "ม.3" },
    { id: "ม.4", label: "ม.4" },
    { id: "ม.5", label: "ม.5" },
    { id: "ม.6", label: "ม.6" },
  ];

  const getAvailableRooms = (g: string) => {
    if (!g) return [];
    const counts: Record<string, number> = { "ม.1": 10, "ม.2": 10, "ม.3": 10, "ม.4": 6, "ม.5": 6, "ม.6": 6 };
    const count = counts[g] || 10;
    return Array.from({ length: count }, (_, i) => `${g}/${i + 1}`);
  };

  const handleSelectGrade = (g: string) => {
    setTargetGrade(g);
    if (!g) {
      setTargetRooms([]);
      onRoomsChange?.([]);
    } else {
      const allRooms = getAvailableRooms(g);
      setTargetRooms(allRooms);
      onRoomsChange?.(allRooms);
    }
  };

  const toggleRoom = (room: string) => {
    let updated: string[];
    if (targetRooms.includes(room)) {
      updated = targetRooms.filter((r: string) => r !== room);
    } else {
      updated = [...targetRooms, room].sort();
    }
    setTargetRooms(updated);
    onRoomsChange?.(updated);
  };

  const selectAllRooms = () => {
    const all = getAvailableRooms(targetGrade);
    setTargetRooms(all);
    onRoomsChange?.(all);
  };

  const clearAllRooms = () => {
    setTargetRooms([]);
    onRoomsChange?.([]);
  };

  const availableRooms = getAvailableRooms(targetGrade);
  const isAllSelected = availableRooms.length > 0 && availableRooms.every(r => targetRooms.includes(r));

  return (
    <div className="card">
      <div className="card-title">📄 รายละเอียดชุดข้อสอบ</div>
      <div className="card-sub">กรอกข้อมูลพื้นฐาน และเลือกห้องเรียนที่ใช้ข้อสอบชุดนี้ (สามารถเลือกได้หลายห้อง)</div>

      <div className="field">
        <label>ชื่อชุดข้อสอบ *</label>
        <input
          type="text"
          placeholder="เช่น แบบทดสอบวิชาภาษาไทย ม.1 กลางภาค"
          value={formTitle}
          onChange={e => setFormTitle(e.target.value)}
        />
      </div>

      <div className="field" style={{background:"var(--gray-50)", padding:"16px", borderRadius:"var(--radius)", border:"1px solid var(--gray-200)"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:6}}>
          <label style={{fontWeight:700, margin:0, color:"var(--gray-800)"}}>
            🏫 เลือกระดับชั้น & ห้องเรียนที่ใช้ข้อสอบชุดนี้ (เลือกได้หลายห้อง):
          </label>
          {targetGrade && (
            <div style={{display:"flex", gap:6}}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{fontSize:11, padding:"3px 8px"}}
                onClick={selectAllRooms}>
                ✓ เลือกทุกห้อง ({availableRooms.length})
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{fontSize:11, padding:"3px 8px", color:"var(--gray-500)"}}
                onClick={clearAllRooms}>
                ✕ ล้าง
              </button>
            </div>
          )}
        </div>

        {/* Grade buttons */}
        <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:12}}>
          {grades.map(g => (
            <button
              key={g.id}
              type="button"
              className={`btn btn-sm ${targetGrade === g.id ? "btn-green" : "btn-secondary"}`}
              style={{padding:"6px 14px", fontWeight: targetGrade === g.id ? 700 : 500}}
              onClick={() => handleSelectGrade(g.id)}>
              {g.label}
            </button>
          ))}
        </div>

        {/* Multi-room selector chips */}
        {targetGrade && availableRooms.length > 0 && (
          <div style={{borderTop:"1px dashed var(--gray-200)", paddingTop:12}}>
            <div style={{fontSize:12, color:"var(--gray-600)", marginBottom:8, display:"flex", alignItems:"center", gap:6}}>
              <span>👉 คลิกเลือกห้องที่ใช้ข้อสอบชุดนี้:</span>
              <span style={{color:"#0F9D58", fontWeight:700}}>
                {targetRooms.length === 0
                  ? "(ยังไม่ได้เลือกห้อง)"
                  : isAllSelected
                  ? `(เลือกครบทุกห้อง ${availableRooms.length} ห้อง)`
                  : `(เลือกแล้ว ${targetRooms.length} ห้อง)`}
              </span>
            </div>

            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              {availableRooms.map(r => {
                const checked = targetRooms.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRoom(r)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "20px",
                      fontSize: "13px",
                      cursor: "pointer",
                      border: checked ? "1.5px solid #0F9D58" : "1.5px solid var(--gray-300)",
                      background: checked ? "#E6F4EA" : "white",
                      color: checked ? "#0F9D58" : "var(--gray-700)",
                      fontWeight: checked ? 700 : 500,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all .15s"
                    }}>
                    <span>{checked ? "✓" : "+"}</span>
                    <span>ห้อง {r}</span>
                  </button>
                );
              })}
            </div>

            {targetRooms.length > 0 && (
              <div style={{fontSize:12, color:"var(--gray-600)", marginTop:10, background:"white", padding:"8px 12px", borderRadius:6, border:"1px solid var(--gray-200)"}}>
                📌 <strong>ห้องที่ใช้ข้อสอบนี้:</strong> {targetRooms.join(", ")}
                <div style={{fontSize:11, color:"var(--gray-400)", marginTop:2}}>
                  (ระบบจะนำห้องเหล่านี้ไปใส่ในเมนูตัวเลือกของนักเรียนในฟอร์ม และจัดเข้าเมนูผลสอบของทุกห้องที่เลือก)
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="field" style={{marginBottom:0}}>
        <label>คำอธิบาย / คำชี้แจง</label>
        <textarea
          placeholder="เช่น ให้นักเรียนเลือกคำตอบที่ถูกที่สุดเพียงข้อเดียว เวลา 30 นาที"
          value={formDesc}
          onChange={e => setFormDesc(e.target.value)}
        />
      </div>
    </div>
  );
}

// ============ STEP 1: HEADERS ============
function StepHeaders({ headers, setHeaders }: any) {
  const defaults = ["ชื่อ-สกุล", "ชั้น", "เลขที่", "เลขประจำตัว"];
  const presets: Record<string, string[]> = {
    "ม.1 (1-10)": Array.from({ length: 10 }, (_, i) => `ม.1/${i + 1}`),
    "ม.2 (1-10)": Array.from({ length: 10 }, (_, i) => `ม.2/${i + 1}`),
    "ม.3 (1-10)": Array.from({ length: 10 }, (_, i) => `ม.3/${i + 1}`),
    "ม.4 (1-6)": Array.from({ length: 6 }, (_, i) => `ม.4/${i + 1}`),
    "ม.5 (1-6)": Array.from({ length: 6 }, (_, i) => `ม.5/${i + 1}`),
    "ม.6 (1-6)": Array.from({ length: 6 }, (_, i) => `ม.6/${i + 1}`),
  };

  const addHeader = (type = "text", label = "") =>
    setHeaders([...headers, { id: Date.now(), label, required: true, type, choices: type === "dropdown" ? presets["ม.1 (1-10)"] : [] }]);

  const removeHeader = (id: number) => setHeaders(headers.filter((h: any) => h.id !== id));
  const updateHeader = (id: number, patch: any) =>
    setHeaders(headers.map((h: any) => h.id === id ? { ...h, ...patch } : h));
  const toggleRequired = (id: number) =>
    setHeaders(headers.map((h: any) => h.id === id ? { ...h, required: !h.required } : h));

  const addDefault = (label: string) => {
    if (!headers.find((h: any) => h.label === label)) {
      if (label === "ชั้น") {
        setHeaders([...headers, { id: Date.now(), label: "ชั้น", required: true, type: "dropdown", choices: presets["ม.1 (1-10)"] }]);
      } else {
        setHeaders([...headers, { id: Date.now(), label, required: true, type: "text", choices: [] }]);
      }
    }
  };

  return (
    <div className="card">
      <div className="card-title">📋 กำหนดส่วนหัวของฟอร์ม</div>
      <div className="card-sub">กำหนดช่องข้อมูลที่ต้องการให้นักเรียนกรอก เช่น ชื่อ เลขที่ และเลือกห้องเรียน (Dropdown)</div>

      <div style={{marginBottom:16}}>
        <div style={{fontSize:13, color:"var(--gray-600)", marginBottom:8}}>เพิ่มช่องข้อมูลที่ใช้บ่อย:</div>
        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
          {defaults.map(d => (
            <button key={d} className="btn btn-secondary btn-sm" onClick={() => addDefault(d)}
              style={{opacity: headers.find((h: any) => h.label === d) ? ".4" : "1"}}>
              + {d} {d === "ชั้น" ? "(เมนูเลือกห้อง)" : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="header-list">
        {headers.map((h: any, i: number) => (
          <div key={h.id} style={{
            background: "var(--gray-50)",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            border: "1px solid var(--gray-200)",
            marginBottom: 8
          }}>
            <div className="header-row" style={{marginBottom: h.type === "dropdown" ? 10 : 0}}>
              <span style={{fontSize:12, color:"var(--gray-400)", width:20, textAlign:"center", fontWeight:700}}>{i+1}</span>
              <input
                className="header-input"
                placeholder="เช่น ชื่อ-สกุล, ชั้น, เลขที่..."
                value={h.label}
                onChange={e => updateHeader(h.id, { label: e.target.value })}
              />
              <select
                value={h.type || "text"}
                onChange={e => updateHeader(h.id, {
                  type: e.target.value,
                  choices: e.target.value === "dropdown" && (!h.choices || h.choices.length === 0) ? presets["ม.1 (1-10)"] : (h.choices || [])
                })}
                style={{
                  padding: "7px 10px",
                  borderRadius: "var(--radius)",
                  border: "1.5px solid var(--gray-200)",
                  fontSize: 13,
                  fontWeight: 500,
                  background: "white"
                }}>
                <option value="text">✏️ ข้อความสั้น</option>
                <option value="dropdown">🔽 เมนูเลื่อนลง (Dropdown)</option>
              </select>
              <span
                className={`header-badge ${h.required ? "required" : ""}`}
                onClick={() => toggleRequired(h.id)}
                title="คลิกเพื่อสลับ จำเป็น / ไม่จำเป็น">
                {h.required ? "จำเป็น" : "ไม่จำเป็น"}
              </span>
              <button className="btn btn-icon" onClick={() => removeHeader(h.id)}><TrashIcon /></button>
            </div>

            {h.type === "dropdown" && (
              <div style={{paddingLeft:28, borderTop:"1px dashed var(--gray-200)", paddingTop:10, marginTop:6}}>
                <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:6, flexWrap:"wrap"}}>
                  <span style={{fontSize:12, color:"var(--gray-600)", fontWeight:600}}>⚡ ตัวเลือกด่วน:</span>
                  {Object.entries(presets).map(([k, vals]) => (
                    <button
                      key={k}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{padding:"2px 8px", fontSize:11}}
                      onClick={() => updateHeader(h.id, { choices: vals })}>
                      {k}
                    </button>
                  ))}
                </div>
                <div style={{fontSize:12, color:"var(--gray-500)", marginBottom:4}}>
                  ตัวเลือก (คั่นด้วยจุลภาค <code>,</code>):
                </div>
                <input
                  type="text"
                  className="header-input"
                  style={{width:"100%", fontSize:13, background:"white"}}
                  placeholder="เช่น ม.1/1, ม.1/2, ม.1/3"
                  value={Array.isArray(h.choices) ? h.choices.join(", ") : (h.choices || "")}
                  onChange={e => updateHeader(h.id, {
                    choices: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean)
                  })}
                />
                <div style={{fontSize:11, color:"var(--gray-400)", marginTop:4}}>
                  จะปรากฏใน Google Form เป็นเมนูเลื่อนลงให้นักเรียนเลือกห้อง {Array.isArray(h.choices) && h.choices.length > 0 && `(ทั้งหมด ${h.choices.length} ตัวเลือก)`}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
        <button className="btn btn-secondary" onClick={() => addHeader("text")}>
          <PlusIcon /> เพิ่มช่องข้อความสั้น
        </button>
        <button className="btn btn-secondary" onClick={() => addHeader("dropdown", "ชั้น")}>
          <PlusIcon /> เพิ่มเมนูเลื่อนลง (Dropdown)
        </button>
      </div>
    </div>
  );
}

// ============ STEP 2: QUESTIONS ============
function StepQuestions({ questions, setQuestions, licenseKey, onParsed }: any) {
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [hasAnswer, setHasAnswer] = useState<boolean | null>(null);
  const labels = ["ก","ข","ค","ง"];

  const PROMPT = `อ่านข้อสอบต่อไปนี้แล้วแปลงเป็น JSON ตามรูปแบบนี้เท่านั้น ไม่ต้องมีข้อความอื่นนอกจาก JSON:
{
  "hasAnswer": true,
  "questions": [
    {
      "text": "คำถาม",
      "choices": ["ตัวเลือก1","ตัวเลือก2","ตัวเลือก3","ตัวเลือก4"],
      "answer": 0
    }
  ]
}
กฎสำคัญ:
- answer คือ index ของตัวเลือกที่ถูก (0=ตัวเลือกแรก, 1=ตัวเลือกที่สอง ...)
- ถ้าไม่มีเฉลยในไฟล์เลย ให้ hasAnswer = false และ answer = -1 ทุกข้อ
- ถ้ามีเฉลย ให้ hasAnswer = true และใส่ answer ให้ถูกต้อง
- รองรับตัวเลือกแบบ ก ข ค ง และ A B C D และ 1 2 3 4
- จับเฉลยจากเฉลยท้ายไฟล์ หรือสีตัวอักษร หรือไฮไลต์ หรือเครื่องหมายใดๆ
- ตัดข้อความที่ไม่ใช่ข้อสอบออก เช่น คำชี้แจง หัวข้อ คำอวยพร`;

  const callGemini = async (parts: any[]) => {
    // If user is google authenticated, attach their JWT token
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const { data, error } = await supabase.functions.invoke("parse-exam", {
      body: { parts, license_key: licenseKey },
      headers,
    });
    if (error) {
      try {
        const body = await (error as any).context?.json();
        if (body?.error) throw new Error(body.error);
      } catch (e: any) {
        if (e.message && e.message !== error.message) throw e;
      }
      throw new Error(error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setParseError("ไฟล์ใหญ่เกินไป (สูงสุด 5 MB)");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setParseError("");
    setHasAnswer(null);
    setQuestions([]);

    try {
      let parsed: any;

      const fname = file.name.toLowerCase();
      if (fname.endsWith(".docx") || fname.endsWith(".txt")) {
        let text = "";
        if (fname.endsWith(".docx")) {
          const mammoth = await import("mammoth");
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
        } else {
          text = await file.text();
        }
        parsed = await callGemini([{ text: PROMPT + "\n\nข้อสอบ:\n" + text }]);

      } else if (fname.endsWith(".pdf")) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.readAsDataURL(file);
        });
        parsed = await callGemini([
          { inline_data: { mime_type: "application/pdf", data: base64 } },
          { text: PROMPT }
        ]);
      } else {
        throw new Error("รองรับเฉพาะไฟล์ .docx .pdf .txt เท่านั้น");
      }

      // แปลงผลลัพธ์
      const qs = parsed.questions.map((q: any, i: number) => ({
        id: Date.now() + i,
        text: q.text || "",
        choices: q.choices || ["","","",""],
        answer: q.answer >= 0 ? q.answer : 0,
      }));

      setHasAnswer(parsed.hasAnswer);
      setQuestions(qs);
      onParsed?.();

    } catch(err: any) {
      setParseError(err.message);
    }
    setParsing(false);
  };

  const updateQ = (id: number, field: string, val: any) =>
    setQuestions(questions.map((q: any) => q.id===id ? {...q,[field]:val} : q));
  const updateChoice = (qid: number, ci: number, val: string) =>
    setQuestions(questions.map((q: any) => q.id===qid ? {...q, choices: q.choices.map((c: string, i: number) => i===ci ? val : c)} : q));
  const addQuestion = () =>
    setQuestions([...questions, {id:Date.now(), text:"", choices:["","","",""], answer:0}]);
  const removeQ = (id: number) =>
    setQuestions(questions.filter((q: any) => q.id!==id));

  return (
    <div>
      {/* Upload Zone */}
      <div className="card">
        <div className="card-title">📁 อัปโหลดไฟล์ข้อสอบ</div>
        <div className="card-sub">รองรับ .docx .pdf .txt — AI จะอ่านและแปลงข้อสอบให้อัตโนมัติ</div>
        <div style={{marginBottom:14, padding:"10px 14px", background:"var(--yellow-light)", borderRadius:"var(--radius)", fontSize:13, color:"#92400e", display:"flex", alignItems:"flex-start", gap:8}}>
          <span style={{flexShrink:0}}>📌</span>
          <span><strong>ข้อสอบที่มีรูปภาพ:</strong> รูปจะไม่ถูกส่งไปยัง Google Form — แนะนำให้ใช้เฉพาะข้อสอบที่เป็นข้อความเท่านั้น</span>
        </div>
        <div
          className={`upload-zone ${fileName && !parsing ? "has-file" : ""} ${parsing ? "drag" : ""}`}
          onClick={() => !parsing && document.getElementById("file-input")?.click()}
        >
          <div style={{color: parsing ? "var(--blue)" : fileName ? "var(--green)" : "var(--gray-400)"}}>
            <UploadIcon />
          </div>
          {parsing ? (
            <>
              <div className="upload-text" style={{color:"var(--blue)"}}>🤖 AI กำลังอ่านข้อสอบ...</div>
              <div className="upload-hint">กรุณารอสักครู่</div>
              <div className="spinner" style={{margin:"12px auto 0", width:28, height:28, borderWidth:3}}/>
            </>
          ) : fileName ? (
            <>
              <div className="upload-text" style={{color:"var(--green)"}}>✅ {fileName}</div>
              <div className="upload-hint">กดเพื่อเปลี่ยนไฟล์</div>
            </>
          ) : (
            <>
              <div className="upload-text">คลิกหรือลากไฟล์มาวางที่นี่</div>
              <div className="upload-hint">รองรับ .docx .pdf .txt · ไม่เกิน 5 MB</div>
            </>
          )}
        </div>
        <input id="file-input" type="file" accept=".docx,.pdf,.txt"
          style={{display:"none"}} onChange={e => handleFile(e.target.files?.[0] || null)}/>

        {/* แจ้งเตือนเฉลย */}
        {hasAnswer === true && !parsing && (
          <div style={{marginTop:12, padding:"10px 16px", background:"var(--green-light)", borderRadius:"var(--radius)", fontSize:13, color:"var(--green)", fontWeight:600, display:"flex", alignItems:"center", gap:8}}>
            ✅ พบเฉลยในไฟล์ — ระบบตั้งเฉลยให้อัตโนมัติแล้ว สามารถตรวจสอบและแก้ไขได้
          </div>
        )}
        {hasAnswer === false && !parsing && (
          <div style={{marginTop:12, padding:"10px 16px", background:"var(--yellow-light)", borderRadius:"var(--radius)", fontSize:13, color:"#92400e", fontWeight:600, display:"flex", alignItems:"center", gap:8}}>
            ⚠️ ไม่พบเฉลยในไฟล์ — กรุณาคลิกวงกลมเพื่อเลือกเฉลยแต่ละข้อด้วยตัวเอง
          </div>
        )}

        {/* DOCX image warning */}
        {fileName.toLowerCase().endsWith(".docx") && !parsing && (
          <div style={{marginTop:12, padding:"10px 16px", background:"var(--blue-light)", borderRadius:"var(--radius)", fontSize:13, color:"var(--blue)", display:"flex", alignItems:"center", gap:8}}>
            🖼️ ถ้าข้อสอบมีรูปภาพ กรุณาบันทึกเป็น .pdf ก่อนอัปโหลด <span style={{opacity:.7}}>(File → Save As → PDF)</span>
          </div>
        )}


        {/* Error */}
        {parseError && (
          <div style={{marginTop:10, padding:"10px 14px", background:"var(--red-light)", borderRadius:"var(--radius)", fontSize:13, color:"var(--red)"}}>
            ⚠️ {parseError}
          </div>
        )}
      </div>

      {/* รายการข้อสอบ */}
      <div className="card">
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
          <div className="card-title">❓ รายการข้อสอบ ({questions.length} ข้อ)</div>
          <button className="btn btn-secondary btn-sm" onClick={addQuestion}><PlusIcon /> เพิ่มข้อ</button>
        </div>

        {questions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>อัปโหลดไฟล์หรือกด "เพิ่มข้อ" เพื่อกรอกเอง</p>
          </div>
        ) : (
          <div className="question-list">
            {(() => {
              const allTexts = questions.map((q: any) => q.text.trim());
              const dupSet = new Set(allTexts.filter((t: string, i: number) => t !== "" && allTexts.indexOf(t) !== i));
              return questions.map((q: any, qi: number) => {
              const isEmpty = !q.text.trim();
              const isDup = dupSet.has(q.text.trim());
              const warn = isEmpty || isDup;
              return (
              <div className="question-card" key={q.id} style={warn ? {borderColor:"var(--yellow)"} : {}}>
                <div className="q-header">
                  <span className="q-num">ข้อ {qi+1}</span>
                  {warn && (
                    <div style={{width:20,height:20,borderRadius:"50%",background:"var(--yellow)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0}}>!</div>
                  )}
                  <input className="q-text-input" placeholder="กรอกคำถาม..." value={q.text}
                    onChange={e => updateQ(q.id, "text", e.target.value)} style={{flex:1}}/>
                  <button className="btn btn-icon" onClick={() => removeQ(q.id)}><TrashIcon /></button>
                </div>
                {warn && (
                  <div style={{fontSize:12,color:"#92400e",background:"var(--yellow-light)",borderRadius:6,padding:"4px 10px",marginBottom:8}}>
                    ⚠️ {isEmpty ? "คำถามว่างเปล่า" : "ข้อความซ้ำกับข้ออื่น — จะเติม (2), (3) ให้อัตโนมัติตอนสร้างฟอร์ม"}
                  </div>
                )}
                <div style={{fontSize:11, color:"var(--gray-500)", marginBottom:8}}>
                  คลิกวงกลมเพื่อเลือกเฉลย {q.answer >= 0 ? `(เฉลย: ${labels[q.answer]})` : "(ยังไม่มีเฉลย)"}
                </div>
                <div className="choices-grid">
                  {q.choices.map((c: string, ci: number) => (
                    <div className="choice-row" key={ci}>
                      <div
                        className={`choice-label ${q.answer===ci ? "correct" : "wrong"}`}
                        onClick={() => updateQ(q.id, "answer", ci)}
                      >
                        {q.answer===ci ? <CheckIcon /> : labels[ci]}
                      </div>
                      <input
                        className={`choice-input ${q.answer===ci ? "correct" : ""}`}
                        placeholder={`ตัวเลือก ${labels[ci]}`} value={c}
                        onChange={e => updateChoice(q.id, ci, e.target.value)}/>
                    </div>
                  ))}
                </div>
              </div>
              );
            });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
// ============ HISTORY ============
function HistoryTab({ user }: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<Record<string,boolean>>({});

  const fetchHistory = async () => {
    setLoading(true);
    let query = supabase.from("form_history").select("*").order("created_at", { ascending:false });
    if (user.role !== "admin") query = query.eq("license_key", user.key);
    const { data } = await query;
    setHistory(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, []);

  const copy = (k: string, val: string) => {
    navigator.clipboard.writeText(val).catch(()=>{});
    setCopied(c => ({...c,[k]:true}));
    setTimeout(() => setCopied(c => ({...c,[k]:false})), 2000);
  };

  const deleteHistory = async (id: string) => {
    if (!confirm("ต้องการลบประวัตินี้ไหม?")) return;
    await supabase.from("form_history").delete().eq("id", id);
    fetchHistory();
  };

  return (
    <div className="card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <div className="card-title">📜 ประวัติการสร้างฟอร์ม</div>
          <div style={{fontSize:13,color:"var(--gray-600)"}}>
            {user.role==="admin" ? "ประวัติทั้งหมดในระบบ" : "ประวัติของคุณ"}
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchHistory}><RefreshIcon /> รีเฟรช</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{margin:"0 auto"}}/></div>
      ) : history.length===0 ? (
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <p>ยังไม่มีประวัติการสร้างฟอร์ม</p>
        </div>
      ) : (
        <div style={{overflowX:"auto"}}>
          <table className="history-table">
            <thead>
              <tr>
                <th>#</th>
                {user.role==="admin" && <th>Key</th>}
                <th>ชื่อข้อสอบ</th>
                <th>ข้อ</th>
                <th>วันที่</th>
                <th>ลิงก์</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={h.id}>
                  <td style={{color:"var(--gray-400)",fontSize:13}}>{i+1}</td>
                  {user.role==="admin" && (
                    <td style={{fontFamily:"monospace",fontSize:11,color:"var(--gray-600)"}}>{h.license_key}</td>
                  )}
                  <td>
                    <div style={{fontWeight:600,fontSize:14}}>{h.form_title}</div>
                    {h.form_desc && <div style={{fontSize:12,color:"var(--gray-500)",marginTop:2}}>{h.form_desc}</div>}
                  </td>
                  <td><span className="badge badge-blue">{h.question_count} ข้อ</span></td>
                  <td style={{fontSize:12,color:"var(--gray-600)",whiteSpace:"nowrap"}}>
                    {new Date(h.created_at).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit"})}
                  </td>
                  <td>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <button className={`copy-btn ${copied[h.id+"e"]?"copied":""}`}
                        style={{background:copied[h.id+"e"]?"#1e8e3e":"var(--blue)",color:"white"}}
                        onClick={() => copy(h.id+"e", h.edit_url)}>
                        {copied[h.id+"e"]?<><CheckIcon/>คัดลอก</>:<><CopyIcon/>Edit</>}
                      </button>
                      <button className="copy-btn" style={{background:"var(--blue)",color:"white"}}
                        onClick={() => window.open(h.edit_url,"_blank")}>
                        <ExternalIcon/> เปิด
                      </button>
                      <button className={`copy-btn ${copied[h.id+"v"]?"copied":""}`}
                        style={{background:copied[h.id+"v"]?"#1e8e3e":"var(--green)",color:"white"}}
                        onClick={() => copy(h.id+"v", h.view_url)}>
                        {copied[h.id+"v"]?<><CheckIcon/>คัดลอก</>:<><CopyIcon/>View</>}
                      </button>
                      <button className="copy-btn" style={{background:"var(--green)",color:"white"}}
                        onClick={() => window.open(h.view_url,"_blank")}>
                        <ExternalIcon/> เปิด
                      </button>
                      {h.sheet_url && (
                        <>
                          <button className={`copy-btn ${copied[h.id+"s"]?"copied":""}`}
                            style={{background:copied[h.id+"s"]?"#1e8e3e":"#0F9D58",color:"white"}}
                            onClick={() => copy(h.id+"s", h.sheet_url)}>
                            {copied[h.id+"s"]?<><CheckIcon/>คัดลอก</>:<><CopyIcon/>ชีต</>}
                          </button>
                          <button className="copy-btn" style={{background:"#0F9D58",color:"white"}}
                            onClick={() => window.open(h.sheet_url,"_blank")}>
                            <SheetIcon/> ชีตคะแนน
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-icon" onClick={() => deleteHistory(h.id)}><TrashIcon/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ SHEETS & CLASSROOM HELPERS ============
const getRoomsForGrade = (grade: string) => {
  const counts: Record<string, number> = {
    m1: 10, m2: 10, m3: 10, m4: 6, m5: 6, m6: 6
  };
  const count = counts[grade] || 10;
  const num = grade.replace("m", "");
  return Array.from({ length: count }, (_, i) => `ม.${num}/${i + 1}`);
};

const GRADE_LABELS: Record<string, string> = {
  all: "ทุกระดับชั้น",
  m1: "ม.1 (มัธยมศึกษาปีที่ 1)",
  m2: "ม.2 (มัธยมศึกษาปีที่ 2)",
  m3: "ม.3 (มัธยมศึกษาปีที่ 3)",
  m4: "ม.4 (มัธยมศึกษาปีที่ 4)",
  m5: "ม.5 (มัธยมศึกษาปีที่ 5)",
  m6: "ม.6 (มัธยมศึกษาปีที่ 6)",
};

function matchRoom(item: any, grade: string, room: string) {
  if (grade === "all" && room === "all") return true;
  const text = `${item.form_title || ""} ${item.form_desc || ""}`.toLowerCase();

  if (room !== "all") {
    const rLower = room.toLowerCase();
    const rShort = room.replace("ม.", "").toLowerCase();
    return text.includes(rLower) || text.includes(rShort);
  }

  const gradeMap: Record<string, string[]> = {
    m1: ["ม.1", "ม1", "ม 1", "ม. 1", "grade 7", "g7"],
    m2: ["ม.2", "ม2", "ม 2", "ม. 2", "grade 8", "g8"],
    m3: ["ม.3", "ม3", "ม 3", "ม. 3", "grade 9", "g9"],
    m4: ["ม.4", "ม4", "ม 4", "ม. 4", "grade 10", "g10"],
    m5: ["ม.5", "ม5", "ม 5", "ม. 5", "grade 11", "g11"],
    m6: ["ม.6", "ม6", "ม 6", "ม. 6", "grade 12", "g12"],
  };

  const keywords = gradeMap[grade] || [];
  if (keywords.length === 0) return true;
  return keywords.some(kw => text.includes(kw));
}

// ============ EXAM SCORE DASHBOARD (IN-APP) ============
function ExamScoreDashboard({ exam, onBack }: { exam: any; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "sheet">("overview");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");

  const loadData = async () => {
    if (!exam.sheet_url) return;
    setLoading(true);
    setError("");
    try {
      // ใช้ POST ส่ง action: get_summary เหมือนตอนสร้างฟอร์ม เพื่อหลีกเลี่ยง CORS ของ GET redirect
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "get_summary",
          sheetUrl: exam.sheet_url
        })
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "ไม่สามารถอ่านข้อมูลสรุปคะแนนได้");
      }
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [exam.sheet_url]);

  const rawStudents: any[] = data?.students || [];

  // คำนวณสถิติจากคะแนนนักเรียนจริงโดยตรง (Real-time Calculation)
  const studentScores = rawStudents.map(s => {
    const scoreVal = s["คะแนน"] || s["Score"] || "";
    return parseFloat(scoreVal.toString().split("/")[0]);
  }).filter(n => !isNaN(n));

  const totalMax = exam.question_count || 20;
  const passThresh = Math.ceil(totalMax * 0.5);
  const totalCount = studentScores.length;
  const computedAvg = totalCount > 0 ? (studentScores.reduce((a, b) => a + b, 0) / totalCount).toFixed(2) + " คะแนน" : "-";
  const computedMax = totalCount > 0 ? Math.max(...studentScores) + " คะแนน" : "-";
  const computedMin = totalCount > 0 ? Math.min(...studentScores) + " คะแนน" : "-";
  const computedPass = studentScores.filter(s => s >= passThresh).length;
  const computedFail = totalCount - computedPass;
  const computedPassRate = totalCount > 0 ? ((computedPass / totalCount) * 100).toFixed(1) + "%" : "0%";

  const stats = {
    totalStudents: totalCount > 0 ? `${totalCount} คน` : (data?.stats?.totalStudents || "0 คน"),
    totalScore: data?.stats?.totalScore || `${totalMax} คะแนน`,
    average: totalCount > 0 ? computedAvg : (data?.stats?.average || "-"),
    maxScore: totalCount > 0 ? computedMax : (data?.stats?.maxScore || "-"),
    minScore: totalCount > 0 ? computedMin : (data?.stats?.minScore || "-"),
    passCount: totalCount > 0 ? `${computedPass} คน` : (data?.stats?.passCount || "0 คน"),
    failCount: totalCount > 0 ? `${computedFail} คน` : (data?.stats?.failCount || "0 คน"),
    passRate: totalCount > 0 ? computedPassRate : (data?.stats?.passRate || "0%"),
    rooms: data?.stats?.rooms && data.stats.rooms.length > 0 ? data.stats.rooms : []
  };

  const students = rawStudents;

  // Extract rooms from stats or students
  const roomList: string[] = stats?.rooms?.map((r: any) => r.room) ||
    Array.from(new Set(students.map(s => s["ชั้น"] || s["ห้องเรียน"] || s["ห้อง"]).filter(Boolean)));

  const filteredStudents = students.filter(s => {
    const text = Object.values(s).join(" ").toLowerCase();
    const matchSearch = !searchTerm || text.includes(searchTerm.toLowerCase());
    const studentRoom = (s["ชั้น"] || s["ห้องเรียน"] || s["ห้อง"] || "").toString();
    const matchR = roomFilter === "all" || studentRoom.includes(roomFilter);
    return matchSearch && matchR;
  });

  const embedUrl = exam.sheet_url?.replace(/\/edit.*$/, "/preview") || exam.sheet_url;

  return (
    <div>
      {/* Top Navigation & Header */}
      <div style={{
        background: "white",
        borderRadius: "var(--radius-lg)",
        padding: "20px 24px",
        marginBottom: 20,
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
        border: "1px solid var(--gray-200)"
      }}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16}}>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{fontWeight: 600}}>
            ← กลับไปหน้ารายการข้อสอบ
          </button>
          <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
              <RefreshIcon /> รีเฟรชคะแนน
            </button>
            <button className="btn btn-sm" onClick={() => window.open(exam.sheet_url, "_blank")} style={{background:"#0F9D58", color:"white", fontWeight:600}}>
              <SheetIcon /> เปิดใน Google Sheets
            </button>
          </div>
        </div>

        <div style={{display: "flex", alignItems: "flex-start", gap: 12}}>
          <div style={{
            background: "#E6F4EA",
            color: "#0F9D58",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            📊
          </div>
          <div style={{flex: 1}}>
            <h2 style={{margin: 0, fontSize: 20, fontWeight: 700, color: "var(--gray-900)"}}>
              {exam.form_title}
            </h2>
            <div style={{fontSize: 13, color: "var(--gray-600)", marginTop: 4}}>
              {exam.form_desc || "ข้อสอบออนไลน์"} • คำถาม {exam.question_count} ข้อ • อัปเดตล่าสุด {new Date().toLocaleTimeString("th-TH")}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "flex",
          gap: 8,
          marginTop: 20,
          borderBottom: "1px solid var(--gray-200)",
          paddingBottom: 2
        }}>
          {[
            { id: "overview", label: "📊 ภาพรวมสถิติคะแนน", count: null },
            { id: "students", label: "👥 รายชื่อและคะแนนรายคน", count: students.length },
            { id: "sheet", label: "📑 แผ่นงาน Google Sheets ตัวจริง", count: null }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === t.id ? "3px solid #0F9D58" : "3px solid transparent",
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? "#0F9D58" : "var(--gray-600)",
                cursor: "pointer",
                transition: "all .2s"
              }}>
              {t.label} {t.count !== null && <span style={{
                background: activeTab === t.id ? "#0F9D58" : "var(--gray-200)",
                color: activeTab === t.id ? "white" : "var(--gray-700)",
                padding: "2px 8px",
                borderRadius: 12,
                fontSize: 11,
                marginLeft: 4
              }}>{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview Dashboard */}
      {activeTab === "overview" && (
        <div>
          {error && (
            <div style={{marginBottom: 16, padding: "12px 16px", background: "var(--red-light)", borderRadius: "var(--radius)", color: "var(--red)", fontSize: 13}}>
              ⚠️ {error} — สามารถคลิกแท็บ "แผ่นงาน Google Sheets ตัวจริง" เพื่อดูชีตโดยตรงได้ครับ
            </div>
          )}
          {loading ? (
            <div className="card" style={{textAlign:"center", padding: "40px 20px"}}>
              <div className="spinner" style={{margin: "0 auto 12px"}}/>
              <div style={{fontSize: 14, color: "var(--gray-600)"}}>กำลังดึงข้อมูลสถิติคะแนนล่าสุดจาก Google Sheets...</div>
            </div>
          ) : (
            <>
              {/* 4 Hero KPI Cards */}
              <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20}}>
                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #2563EB", background: "linear-gradient(135deg, #FFFFFF 0%, #F0F7FF 100%)"}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--gray-600)"}}>👥 ส่งข้อสอบแล้ว</span>
                    <span style={{fontSize: 20}}>📝</span>
                  </div>
                  <div style={{fontSize: 26, fontWeight: 800, color: "#1E3A8A"}}>
                    {stats?.totalStudents || `${students.length} คน`}
                  </div>
                  <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                    จากข้อสอบทั้งหมด {stats?.totalScore || `${exam.question_count} คะแนน`}
                  </div>
                </div>

                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #0F9D58", background: "linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)"}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--gray-600)"}}>📈 คะแนนเฉลี่ย (Mean)</span>
                    <span style={{fontSize: 20}}>🎯</span>
                  </div>
                  <div style={{fontSize: 26, fontWeight: 800, color: "#0F9D58"}}>
                    {stats?.average || "-"}
                  </div>
                  <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                    ระดับชั้น ม.1/1-1/4
                  </div>
                </div>

                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #F59E0B", background: "linear-gradient(135deg, #FFFFFF 0%, #FEFCE8 100%)"}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--gray-600)"}}>🏆 สูงสุด / ต่ำสุด</span>
                    <span style={{fontSize: 20}}>🥇</span>
                  </div>
                  <div style={{fontSize: 22, fontWeight: 800, color: "#D97706"}}>
                    {stats?.maxScore || "-"} / {stats?.minScore || "-"}
                  </div>
                  <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                    คะแนนสูงสุด / คะแนนต่ำสุด
                  </div>
                </div>

                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #8B5CF6", background: "linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)"}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--gray-600)"}}>✅ อัตราการผ่านเกณฑ์</span>
                    <span style={{fontSize: 20}}>📊</span>
                  </div>
                  <div style={{fontSize: 26, fontWeight: 800, color: "#6D28D9"}}>
                    {stats?.passRate || "0%"}
                  </div>
                  <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                    ผ่าน: {stats?.passCount || 0} • ไม่ผ่าน: {stats?.failCount || 0}
                  </div>
                </div>
              </div>

              {/* Classroom breakdown table */}
              {stats?.rooms && stats.rooms.length > 0 && (
                <div className="card" style={{marginBottom: 20}}>
                  <div className="card-title" style={{display: "flex", alignItems: "center", gap: 8}}>
                    <span>🏫 สรุปผลแยกตามห้องเรียน</span>
                  </div>
                  <div className="card-sub">ติดตามจำนวนนักเรียนที่ส่งข้อสอบในแต่ละห้องเรียน</div>
                  <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 14}}>
                    {stats.rooms.map((rm: any, idx: number) => {
                      const hasSubmitted = parseInt(rm.count) > 0 || rm.status?.includes("มีผู้ส่ง");
                      return (
                        <div
                          key={idx}
                          style={{
                            border: "1.5px solid",
                            borderColor: hasSubmitted ? "#A7F3D0" : "var(--gray-200)",
                            background: hasSubmitted ? "#ECFDF5" : "#F9FAFB",
                            borderRadius: "var(--radius)",
                            padding: "14px 16px",
                            textAlign: "center"
                          }}>
                          <div style={{fontSize: 16, fontWeight: 700, color: hasSubmitted ? "#065F46" : "var(--gray-700)"}}>
                            {rm.room}
                          </div>
                          <div style={{fontSize: 20, fontWeight: 800, color: hasSubmitted ? "#059669" : "var(--gray-500)", margin: "4px 0"}}>
                            {rm.count}
                          </div>
                          <span style={{
                            display: "inline-block",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: hasSubmitted ? "#10B981" : "var(--gray-300)",
                            color: "white"
                          }}>
                            {rm.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 2: Individual Student Scores */}
      {activeTab === "students" && (
        <div className="card">
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16}}>
            <div>
              <div className="card-title">👥 รายชื่อและคะแนนสอบรายบุคคล</div>
              <div className="card-sub">คำตอบและคะแนนของนักเรียนทั้งหมด {students.length} คน</div>
            </div>
            {/* Search & Filter */}
            <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
              <input
                type="text"
                placeholder="🔍 ค้นหาชื่อ หรือเลขที่..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--gray-200)",
                  fontSize: 13,
                  outline: "none"
                }}
              />
              {roomList.length > 0 && (
                <select
                  value={roomFilter}
                  onChange={e => setRoomFilter(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--gray-200)",
                    fontSize: 13,
                    background: "white"
                  }}>
                  <option value="all">ทุกห้องเรียน</option>
                  {roomList.map((r: string) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div style={{textAlign: "center", padding: "40px 20px", color: "var(--gray-500)"}}>
              {students.length === 0 ? "⏳ ยังไม่มีนักเรียนส่งข้อสอบ" : "ไม่พบนักเรียนตามคำค้นหา"}
            </div>
          ) : (
            <div style={{overflowX: "auto"}}>
              <table style={{width: "100%", borderCollapse: "collapse", fontSize: 13}}>
                <thead>
                  <tr style={{background: "var(--gray-50)", borderBottom: "2px solid var(--gray-200)"}}>
                    <th style={{padding: "10px 12px", textAlign: "left", width: 50}}>#</th>
                    <th style={{padding: "10px 12px", textAlign: "left"}}>วัน-เวลา</th>
                    <th style={{padding: "10px 12px", textAlign: "left"}}>ชื่อ-นามสกุล</th>
                    <th style={{padding: "10px 12px", textAlign: "center", width: 90}}>ห้อง</th>
                    <th style={{padding: "10px 12px", textAlign: "center", width: 70}}>เลขที่</th>
                    <th style={{padding: "10px 12px", textAlign: "center", width: 110}}>คะแนน</th>
                    <th style={{padding: "10px 12px", textAlign: "center", width: 110}}>ผลประเมิน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, idx) => {
                    const scoreStr = s["คะแนน"] || s["Score"] || "";
                    const scoreNum = parseInt(scoreStr.split("/")[0]) || 0;
                    const totalNum = parseInt(scoreStr.split("/")[1]) || (exam.question_count || 20);
                    const isPass = scoreNum >= Math.ceil(totalNum * 0.5);

                    return (
                      <tr key={idx} style={{borderBottom: "1px solid var(--gray-100)"}}>
                        <td style={{padding: "10px 12px", color: "var(--gray-500)"}}>{idx + 1}</td>
                        <td style={{padding: "10px 12px", color: "var(--gray-600)"}}>{s["ประทับเวลา"] || s["Timestamp"] || "-"}</td>
                        <td style={{padding: "10px 12px", fontWeight: 600, color: "var(--gray-900)"}}>{s["ชื่อ-สกุล"] || s["ชื่อ-นามสกุล"] || s["ชื่อ"] || "-"}</td>
                        <td style={{padding: "10px 12px", textAlign: "center"}}>{s["ชั้น"] || s["ห้องเรียน"] || s["ห้อง"] || "-"}</td>
                        <td style={{padding: "10px 12px", textAlign: "center"}}>{s["เลขที่"] || "-"}</td>
                        <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 14, color: isPass ? "#059669" : "#DC2626"}}>
                          {scoreStr || "-"}
                        </td>
                        <td style={{padding: "10px 12px", textAlign: "center"}}>
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: isPass ? "#DEF7EC" : "#FDE8E8",
                            color: isPass ? "#03543F" : "#9B1C1C"
                          }}>
                            {isPass ? "✅ ผ่าน" : "❌ ปรับปรุง"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Embedded Google Sheet Preview */}
      {activeTab === "sheet" && (
        <div className="card" style={{padding: 12}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "4px 8px"}}>
            <span style={{fontSize: 13, color: "var(--gray-600)"}}>
              💡 นี่คือหน้าจอ Google Sheets ที่อัปเดตแบบสดๆ สามารถเลื่อนดูแท็บคะแนนดิบและแท็บสรุปผลได้โดยตรง
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => window.open(exam.sheet_url, "_blank")}>
              <ExternalIcon /> ขยายเปิดในแท็บใหม่
            </button>
          </div>
          <iframe
            src={embedUrl}
            style={{
              width: "100%",
              height: "680px",
              border: "1px solid var(--gray-200)",
              borderRadius: "var(--radius)",
              background: "white"
            }}
            title="Google Sheets Preview"
          />
        </div>
      )}
    </div>
  );
}

// ============ SHEETS & RESULTS TAB ============
function SheetsTab({ user, selectedGrade, setSelectedGrade, selectedRoom, setSelectedRoom }: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [viewingExam, setViewingExam] = useState<any>(null);

  const fetchHistory = async () => {
    setLoading(true);
    let query = supabase.from("form_history").select("*").order("created_at", { ascending: false });
    if (user.role !== "admin") query = query.eq("license_key", user.key);
    const { data } = await query;
    setHistory(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, []);

  if (viewingExam) {
    return <ExamScoreDashboard exam={viewingExam} onBack={() => setViewingExam(null)} />;
  }

  const copy = (k: string, val: string) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopied(c => ({ ...c, [k]: true }));
    setTimeout(() => setCopied(c => ({ ...c, [k]: false })), 2000);
  };

  const filtered = history.filter(h => {
    const matchSearch = !search ||
      h.form_title?.toLowerCase().includes(search.toLowerCase()) ||
      h.form_desc?.toLowerCase().includes(search.toLowerCase());
    const matchR = matchRoom(h, selectedGrade, selectedRoom);
    return matchSearch && matchR;
  });

  const gradeList = [
    { id: "all", label: "ทุกระดับชั้น" },
    { id: "m1", label: "ม.1" },
    { id: "m2", label: "ม.2" },
    { id: "m3", label: "ม.3" },
    { id: "m4", label: "ม.4" },
    { id: "m5", label: "ม.5" },
    { id: "m6", label: "ม.6" },
  ];

  return (
    <div>
      {/* Top Banner */}
      <div style={{
        background: "linear-gradient(135deg, #0F9D58 0%, #0B8043 100%)",
        borderRadius: "var(--radius-lg)",
        padding: "24px 28px",
        color: "white",
        marginBottom: 20,
        boxShadow: "0 4px 16px rgba(15,157,88,.25)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16
      }}>
        <div>
          <div style={{display:"flex", alignItems:"center", gap:10, marginBottom: 6}}>
            <div style={{background:"rgba(255,255,255,.2)", borderRadius:8, padding:6, display:"flex", alignItems:"center", justifyContent:"center"}}>
              <SheetIcon />
            </div>
            <h2 style={{fontFamily:"'Prompt',sans-serif", fontSize:22, fontWeight:700, margin:0}}>
              📊 ผลการสอบ & ชีตคะแนน (Google Sheets)
            </h2>
          </div>
          <p style={{fontSize:14, opacity:.9, margin:0, maxWidth:600}}>
            ชีตคะแนนและคำตอบของนักเรียนจะซิงค์อัตโนมัติแบบเรียลไทม์ คุณครูสามารถเลือกดูตามระดับชั้นและห้องเรียนจากแถบเมนูด้านซ้ายได้ทันที
          </p>
        </div>
        <div style={{display:"flex", gap:12, alignItems:"center"}}>
          <div style={{background:"rgba(255,255,255,.18)", borderRadius:12, padding:"10px 18px", textAlign:"center"}}>
            <div style={{fontSize:20, fontWeight:700}}>{filtered.length}</div>
            <div style={{fontSize:11, opacity:.85}}>แสดง {filtered.length}/{history.length} ชีต</div>
          </div>
          <button className="btn btn-sm" onClick={fetchHistory} style={{background:"white", color:"#0F9D58", fontWeight:600}}>
            <RefreshIcon /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Grade & Room Quick Filter Bar */}
      <div className="card" style={{padding: "16px 20px", marginBottom: 16}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom: selectedGrade !== "all" ? 12 : 0}}>
          <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
            <span style={{fontSize:13, fontWeight:700, color:"var(--gray-700)"}}>🏫 ระดับชั้น:</span>
            {gradeList.map(g => (
              <button
                key={g.id}
                type="button"
                className={`btn btn-sm ${selectedGrade === g.id ? "btn-green" : "btn-secondary"}`}
                style={{fontSize: 12, padding: "4px 12px", borderRadius: 20}}
                onClick={() => {
                  setSelectedGrade(g.id);
                  setSelectedRoom("all");
                }}>
                {g.label}
              </button>
            ))}
          </div>

          {(selectedGrade !== "all" || selectedRoom !== "all") && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              style={{fontSize: 12, color: "var(--red)"}}
              onClick={() => {
                setSelectedGrade("all");
                setSelectedRoom("all");
              }}>
              ✕ ดูทั้งหมด
            </button>
          )}
        </div>

        {/* Room sub-filter when a grade is selected */}
        {selectedGrade !== "all" && (
          <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", paddingTop: 10, borderTop: "1px dashed var(--gray-200)"}}>
            <span style={{fontSize:12, fontWeight:600, color:"#0F9D58"}}>📍 ห้องเรียน:</span>
            <button
              type="button"
              className={`btn btn-sm ${selectedRoom === "all" ? "btn-green" : "btn-secondary"}`}
              style={{fontSize: 11, padding: "3px 10px", borderRadius: 16}}
              onClick={() => setSelectedRoom("all")}>
              ทุกห้อง ({selectedGrade.replace("m", "ม.")})
            </button>
            {getRoomsForGrade(selectedGrade).map(r => (
              <button
                key={r}
                type="button"
                className={`btn btn-sm ${selectedRoom === r ? "btn-green" : "btn-secondary"}`}
                style={{fontSize: 11, padding: "3px 10px", borderRadius: 16}}
                onClick={() => setSelectedRoom(r)}>
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search box */}
      <div style={{display:"flex", gap:12, marginBottom:18, alignItems:"center"}}>
        <input
          type="text"
          placeholder="🔍 ค้นหาชื่อข้อสอบเพิ่มเติม..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex:1,
            padding:"10px 16px",
            border:"1.5px solid var(--gray-200)",
            borderRadius:"var(--radius)",
            fontSize:14,
            outline:"none",
            background:"white"
          }}
        />
        {search && (
          <button className="btn btn-secondary btn-sm" onClick={() => setSearch("")}>
            ล้างค้นหา
          </button>
        )}
      </div>

      {/* List / Cards */}
      {loading ? (
        <div className="empty-state"><div className="spinner" style={{margin:"0 auto"}}/></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{textAlign:"center", padding:"48px 20px"}}>
          <div style={{fontSize:44, marginBottom:12}}>📊</div>
          <div style={{fontSize:16, fontWeight:600, color:"var(--gray-800)", marginBottom:4}}>
            ไม่พบข้อสอบในห้องที่เลือก
          </div>
          <div style={{fontSize:13, color:"var(--gray-500)", maxWidth:420, margin:"0 auto 16px"}}>
            {selectedGrade !== "all" || selectedRoom !== "all"
              ? `ไม่พบชีตข้อสอบที่ตรงกับ ${selectedRoom !== "all" ? selectedRoom : GRADE_LABELS[selectedGrade] || selectedGrade}`
              : "เมื่อคุณครูสร้าง Google Form ข้อสอบใหม่ ระบบจะสร้าง Google Sheet บันทึกคะแนนและคำตอบให้อัตโนมัติ"}
          </div>
          {(selectedGrade !== "all" || selectedRoom !== "all" || search) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedGrade("all"); setSelectedRoom("all"); setSearch(""); }}>
              ดูชีตข้อสอบทั้งหมด ({history.length} ชุด)
            </button>
          )}
        </div>
      ) : (
        <div style={{display:"grid", gap:16}}>
          {filtered.map((item, idx) => (
            <div key={item.id} className="card" style={{margin:0, borderLeft:"5px solid #0F9D58"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12}}>
                <div style={{flex:1, minWidth:260}}>
                  <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap"}}>
                    <span style={{fontSize:12, fontWeight:700, color:"#0F9D58", background:"#E6F4EA", padding:"2px 8px", borderRadius:20}}>
                      #{filtered.length - idx}
                    </span>
                    <span style={{fontSize:16, fontWeight:700, color:"var(--gray-900)"}}>
                      {item.form_title}
                    </span>
                  </div>
                  {item.form_desc && (
                    <div style={{fontSize:13, color:"var(--gray-600)", marginBottom:8}}>
                      {item.form_desc}
                    </div>
                  )}
                  <div style={{display:"flex", gap:14, flexWrap:"wrap", fontSize:12, color:"var(--gray-500)", marginTop:6}}>
                    <span>❓ <strong>{item.question_count}</strong> ข้อ</span>
                    <span>📋 <strong>{item.header_count || 0}</strong> ช่องข้อมูล</span>
                    <span>🕒 {new Date(item.created_at).toLocaleDateString("th-TH", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</span>
                    {user.role === "admin" && (
                      <span style={{fontFamily:"monospace", color:"var(--gray-600)"}}>👤 {item.license_key}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end"}}>
                  {item.sheet_url ? (
                    <div style={{display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end"}}>
                      <button
                        className="btn"
                        onClick={() => setViewingExam(item)}
                        style={{
                          background:"#0F9D58",
                          color:"white",
                          fontWeight:700,
                          fontSize:14,
                          padding:"9px 18px",
                          boxShadow:"0 2px 8px rgba(15,157,88,.25)"
                        }}>
                        📊 ดูสรุปคะแนนในระบบ
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => window.open(item.sheet_url, "_blank")}
                        style={{fontWeight:600, fontSize:13, padding:"8px 14px"}}
                        title="เปิดใน Google Sheets">
                        <SheetIcon /> Google Sheets
                      </button>
                    </div>
                  ) : (
                    <div style={{fontSize:12, color:"var(--gray-500)", textAlign:"right"}}>
                      <span>⚠️ ฟอร์มนี้สร้างก่อนระบบเชื่อมต่อชีต</span>
                      <br/>
                      <a href={item.edit_url} target="_blank" rel="noreferrer" style={{color:"var(--blue)", textDecoration:"underline"}}>
                        คลิกที่นี่เพื่อไปดูคะแนนใน Google Form
                      </a>
                    </div>
                  )}

                  <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => window.open(item.edit_url, "_blank")}
                      title="เปิดหน้าแก้ไข Google Form">
                      <ExternalIcon /> ✏️ แก้ไขฟอร์ม
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => window.open(item.view_url, "_blank")}
                      title="เปิดหน้าทำข้อสอบสำหรับนักเรียน">
                      <ExternalIcon /> 👁️ หน้าสอบนักเรียน
                    </button>
                    {item.sheet_url && (
                      <button
                        className={`btn btn-secondary btn-sm ${copied[item.id] ? "btn-green" : ""}`}
                        onClick={() => copy(item.id, item.sheet_url)}>
                        {copied[item.id] ? <><CheckIcon /> คัดลอกแล้ว</> : <><CopyIcon /> คัดลอกลิงก์ชีต</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ============ RESULT ============
function ResultView({ result, onReset, userRole, usageCount, dailyLimit }: any) {
  const [copied, setCopied] = useState<Record<string,boolean>>({});
  const copy = (k: string, val: string) => {
    navigator.clipboard.writeText(val).catch(()=>{});
    setCopied(c => ({...c,[k]:true}));
    setTimeout(() => setCopied(c => ({...c,[k]:false})), 2000);
  };
  return (
    <div>
      <div className="result-card">
        <div style={{fontSize:48,marginBottom:16}}>✅</div>
        <div className="result-title">สร้าง Google Form สำเร็จ!</div>
        <div className="result-sub">"{result.title}" • {result.questionCount} ข้อ • {result.headerCount} ช่องข้อมูล • มีเฉลยอัตโนมัติ ✅</div>
        <div style={{maxWidth:520,margin:"0 auto"}}>
          {[
            {k:"edit",label:"✏️ Edit Link (สำหรับครู)",url:result.links.edit,cls:"edit"},
            {k:"view",label:"👁️ View Link (สำหรับนักเรียน)",url:result.links.view,cls:"view"},
            ...(result.links.sheet ? [{k:"sheet",label:"📊 Google Sheet สรุปคะแนนและคำตอบ",url:result.links.sheet,cls:"view"}] : []),
          ].map(({k,label,url,cls}) => (
            <div className="link-box" key={k}>
              <div style={{flex:1,overflow:"hidden"}}>
                <div className={`link-label ${cls}`}>{label}</div>
                <div className="link-url">{url}</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button className={`copy-btn ${copied[k]?"copied":""}`} onClick={() => copy(k,url)}>
                  {copied[k]?<><CheckIcon /> คัดลอกแล้ว</>:<><CopyIcon /> คัดลอก</>}
                </button>
                <button className="copy-btn" onClick={() => window.open(url,"_blank")}><ExternalIcon /> เปิด</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{textAlign:"center"}}>
        <button className="btn btn-secondary" onClick={onReset}>+ สร้างข้อสอบชุดใหม่</button>
      </div>

      {userRole !== "admin" && (
        <div style={{marginTop:16,background:"linear-gradient(135deg,#7C3AED 0%,#9333EA 100%)",borderRadius:16,padding:"24px",color:"white",textAlign:"center"}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>🔥 ปลดล็อก Pro</div>
          <div style={{fontSize:13,opacity:.85,marginBottom:4}}>อ่านไฟล์ข้อสอบวันนี้ <strong>{usageCount}/{dailyLimit??10}</strong> ครั้ง</div>
          <div style={{fontSize:13,opacity:.75,marginBottom:16}}>อัปเกรด → สร้างได้ไม่จำกัด • ไม่มีวันหมดอายุ</div>
          <button className="btn" style={{background:"white",color:"#7C3AED",fontWeight:700,borderRadius:20,padding:"10px 28px",fontSize:14}}>
            ✨ อัปเกรด Pro
          </button>
        </div>
      )}
    </div>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [user, setUser] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem("fromauto_user") || "null"); } catch { return null; }
  });
  const [usageCount, setUsageCount] = useState(0);

  const handleLogin = (u: any) => {
    localStorage.setItem("fromauto_user", JSON.stringify(u));
    setUser(u);
  };

  const handleLogout = async () => {
    localStorage.removeItem("fromauto_user");
    setUser(null);
    await supabase.auth.signOut();
  };
  const [tab, setTab] = useState("create");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [targetGrade, setTargetGrade] = useState("");
  const [targetRooms, setTargetRooms] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [result, setResult] = useState<any>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [headers, setHeaders] = useState<any[]>([
    {id:1,label:"ชื่อ-สกุล",required:true,type:"text"},
    {id:2,label:"ชั้น",required:true,type:"dropdown",choices:Array.from({length:10},(_,i)=>`ม.1/${i+1}`)},
    {id:3,label:"เลขที่",required:true,type:"text"},
  ]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [submitError, setSubmitError] = useState("");

  const steps = ["รายละเอียด","ส่วนหัว","ข้อสอบ","สร้าง Form","ผลลัพธ์"];

  const handleRoomsChange = (rooms: string[]) => {
    if (rooms.length > 0) {
      setHeaders(prev => prev.map(h => {
        if (h.label === "ชั้น") {
          return { ...h, type: "dropdown", choices: rooms };
        }
        return h;
      }));
    }
  };

  const canNext = () => {
    if (step===0) return formTitle.trim().length > 0;
    if (step===1) return headers.length>0 && headers.every((h: any) => h.label.trim());
    if (step===2) return questions.length>0 && questions.every((q: any) => q.text.trim().length > 0);
    return false;
  };

  const handleSubmit = async () => {
    const msgs = ["กำลังส่งข้อมูล...","กำลังสร้าง Google Form...","เพิ่มข้อสอบและตัวเลือก...","ตั้งค่าเฉลยอัตโนมัติ...","เสร็จสิ้น!"];
    let i = 0;
    setLoading(true); setLoadingMsg(msgs[0]);
    const iv = setInterval(() => { i++; if(i<msgs.length) setLoadingMsg(msgs[i]); }, 800);
    try {
      // Deduplicate question text and choices to prevent Google Forms API rejection
      const seen = new Map<string, number>();
      const cleanedQuestions = questions.map((q: any) => {
        const base = q.text.trim() || "คำถาม";
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const text = count > 0 ? `${base} (${count + 1})` : base;
        // Deduplicate choices, tracking new index of the correct answer
        const choiceKey = (c: string, idx: number) => c.trim() || `ตัวเลือก ${idx + 1}`;
        const keyToNewIdx = new Map<string, number>();
        const uniqueChoices: string[] = [];
        q.choices.forEach((c: string, idx: number) => {
          const k = choiceKey(c, idx);
          if (!keyToNewIdx.has(k)) { keyToNewIdx.set(k, uniqueChoices.length); uniqueChoices.push(c); }
        });
        const answerKey = choiceKey(q.choices[q.answer] ?? "", q.answer);
        const newAnswer = keyToNewIdx.get(answerKey) ?? 0;
        return { ...q, text, choices: uniqueChoices, answer: newAnswer };
      });
      const roomsTag = targetRooms.length > 0
        ? `[ห้อง: ${targetRooms.join(", ")}]`
        : targetGrade
        ? `[ระดับชั้น: ${targetGrade}]`
        : "";
      const finalDesc = roomsTag
        ? `${formDesc ? formDesc + " " : ""}${roomsTag}`
        : formDesc;

      const res = await fetch(SCRIPT_URL, {
        method:"POST",
        body: JSON.stringify({
          title: formTitle,
          description: finalDesc,
          headers,
          questions: cleanedQuestions,
          teacherEmail: user.is_google ? user.key : undefined
        }),
      });
      const data = await res.json();
      clearInterval(iv); setLoading(false);
      if (!data.success) throw new Error(data.error);
      await supabase.from("form_history").insert({
        license_key: user.key,
        form_title: formTitle,
        form_desc: finalDesc || null,
        edit_url: data.editUrl?.trim(),
        view_url: data.viewUrl?.trim(),
        sheet_url: data.sheetUrl?.trim() || null,
        question_count: questions.length,
        header_count: headers.length,
      });
      setResult({ title:formTitle, questionCount:questions.length, headerCount:headers.length, links:{ edit:data.editUrl?.trim(), view:data.viewUrl?.trim(), sheet:data.sheetUrl?.trim() } });
      setStep(4);
    } catch(err: any) {
      clearInterval(iv); setLoading(false);
      setSubmitError(err.message);
    }
  };

  const handleReset = () => { setStep(0); setResult(null); setQuestions([]); setFormTitle(""); setFormDesc(""); setTargetGrade(""); setTargetRooms([]); setSubmitError(""); };

  useEffect(() => {
    if (!user || user.role === "admin") return;
    if (user.is_google) return; // Google users are unlimited admins, handled above
    supabase.rpc("get_my_usage", { p_key: user.key })
      .then(({ data }) => setUsageCount(data ?? 0));
  }, [user]);

  if (!user) return <><style>{css}</style><LoginPage onLogin={handleLogin}/></>;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"/>
            <div className="loading-text">{loadingMsg}</div>
            <div className="loading-sub">กรุณารอสักครู่...</div>
          </div>
        )}
        <div className="topbar">
          <div className="topbar-brand"><Logo /><span className="topbar-title">FormAuto</span></div>
          <div className="topbar-user">
            {user.is_google ? (
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.2)",borderRadius:20,padding:"4px 12px"}}>
                <span style={{fontSize:12,fontWeight:600,color:"white"}}>✨ ใช้งานไม่จำกัด</span>
              </div>
            ) : user.role !== "admin" && (
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.15)",borderRadius:20,padding:"4px 12px"}}>
                <span style={{fontSize:12,color:"rgba(255,255,255,.85)"}}>อ่านไฟล์วันนี้</span>
                <span style={{fontSize:13,fontWeight:700,color:"white"}}>{usageCount}/{user.daily_limit??10}</span>
                <div style={{width:36,height:4,background:"rgba(255,255,255,.3)",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,usageCount/(user.daily_limit??10)*100)}%`,background:usageCount>=(user.daily_limit??10)?"#fca5a5":"white",borderRadius:2,transition:"width .3s"}}/>
                </div>
              </div>
            )}
            <span className={`role-badge ${user.role==="admin"?"role-admin":"role-user"}`} style={user.role==="admin" ? undefined : user.is_google ? {background:"rgba(255,255,255,.2)",color:"white"} : undefined}>
              {user.role==="admin" ? "👑 Admin" : user.is_google ? "🏫 คุณครู ว.พ." : "👤 User"}
            </span>
            <button className="btn btn-icon" style={{borderColor:"rgba(255,255,255,.3)",color:"white"}} onClick={handleLogout}><LogoutIcon /></button>
          </div>
        </div>

        <div className="main-layout">
          <div className="sidebar">
            <button className={`sidebar-item ${tab==="create"?"active":""}`} onClick={() => { setTab("create"); }}>
              <FormIcon /> สร้างข้อสอบใหม่
            </button>

            <div style={{marginTop: 2, marginBottom: 4}}>
              <button
                className={`sidebar-item ${tab==="sheets"?"active":""}`}
                onClick={() => { setTab("sheets"); setSelectedGrade("all"); setSelectedRoom("all"); }}
                style={tab==="sheets"?{background:"#E6F4EA",color:"#0F9D58",fontWeight:600}:{}}>
                <SheetIcon /> 📊 ผลการสอบ & ชีตคะแนน
              </button>

              {/* Classroom Sub-Menu in Sidebar */}
              <div style={{
                marginLeft: 10,
                paddingLeft: 8,
                borderLeft: "2px solid #A7F3D0",
                marginTop: 4,
                marginBottom: 6,
                display: "flex",
                flexDirection: "column",
                gap: 2
              }}>
                <div style={{fontSize: 10, fontWeight: 700, color: "var(--gray-400)", padding: "2px 6px", textTransform: "uppercase", letterSpacing: ".5px"}}>
                  เลือกระดับชั้น / ห้อง:
                </div>

                {[
                  { id: "all", label: "🏫 ทุกระดับชั้น" },
                  { id: "m1", label: "🟢 ม.1 (มัธยม 1)" },
                  { id: "m2", label: "🟢 ม.2 (มัธยม 2)" },
                  { id: "m3", label: "🟢 ม.3 (มัธยม 3)" },
                  { id: "m4", label: "🔵 ม.4 (มัธยม 4)" },
                  { id: "m5", label: "🔵 ม.5 (มัธยม 5)" },
                  { id: "m6", label: "🔵 ม.6 (มัธยม 6)" },
                ].map(g => {
                  const isSelected = tab === "sheets" && selectedGrade === g.id;
                  return (
                    <button
                      key={g.id}
                      className={`sidebar-item ${isSelected ? "active" : ""}`}
                      style={{
                        padding: "5px 8px",
                        fontSize: "12px",
                        borderRadius: "6px",
                        margin: 0,
                        background: isSelected ? "#E6F4EA" : "transparent",
                        color: isSelected ? "#0F9D58" : "var(--gray-600)",
                        fontWeight: isSelected ? 700 : 500,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                      onClick={() => {
                        setTab("sheets");
                        setSelectedGrade(g.id);
                        setSelectedRoom("all");
                      }}>
                      <span>{g.label}</span>
                      {isSelected && <span style={{fontSize: 9, color: "#0F9D58"}}>●</span>}
                    </button>
                  );
                })}

                {/* Specific Room Dropdown inside Left Sidebar */}
                {selectedGrade !== "all" && (
                  <div style={{marginTop: 4, padding: "4px 2px"}}>
                    <div style={{fontSize: 10.5, fontWeight: 600, color: "#0F9D58", marginBottom: 3}}>
                      📍 เลือกห้องเฉพาะ:
                    </div>
                    <select
                      value={selectedRoom}
                      onChange={e => {
                        setTab("sheets");
                        setSelectedRoom(e.target.value);
                      }}
                      style={{
                        width: "100%",
                        padding: "5px 6px",
                        borderRadius: "6px",
                        border: "1.5px solid #0F9D58",
                        fontSize: "11.5px",
                        background: "white",
                        color: "#0F9D58",
                        fontWeight: 600,
                        outline: "none"
                      }}>
                      <option value="all">ทุกห้อง ({selectedGrade.replace("m", "ม.")})</option>
                      {getRoomsForGrade(selectedGrade).map(r => (
                        <option key={r} value={r}>ห้อง {r}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <button className={`sidebar-item ${tab==="history"?"active":""}`} onClick={() => setTab("history")}>
              <FormIcon /> ประวัติฟอร์ม
            </button>
            {user.role==="admin" && (
              <>
                <div className="sidebar-section">Admin</div>
                <button className={`sidebar-item ${tab==="admin"?"admin-active":""}`} onClick={() => setTab("admin")}>
                  <KeyIcon /> จัดการ License Keys
                </button>
              </>
            )}
            <div className="sidebar-section">บัญชี</div>
            <button className="sidebar-item" onClick={handleLogout}><LogoutIcon /> ออกจากระบบ</button>
          </div>

          <div className="content">
           {tab==="admin" && user.role==="admin" ? <AdminPanel adminKey={user.key} /> :
            tab==="sheets" ? <SheetsTab user={user} selectedGrade={selectedGrade} setSelectedGrade={setSelectedGrade} selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom} /> :
            tab==="history" ? <HistoryTab user={user} /> : (
              <>
                <div className="stepper">
                  {steps.map((s,i) => (
                    <div key={s} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div className={`step-dot ${i<step?"done":i===step?"active":"pending"}`}>
                          {i<step?<CheckIcon />:i+1}
                        </div>
                        <span className={`step-label ${i<step?"done":i===step?"active":"pending"}`}>{s}</span>
                      </div>
                      {i<steps.length-1 && <div className={`step-line ${i<step?"done":""}`} style={{flex:1,margin:"0 6px"}}/>}
                    </div>
                  ))}
                </div>

                {step===0 && (
                  <StepDetails
                    formTitle={formTitle}
                    setFormTitle={setFormTitle}
                    formDesc={formDesc}
                    setFormDesc={setFormDesc}
                    targetGrade={targetGrade}
                    setTargetGrade={setTargetGrade}
                    targetRooms={targetRooms}
                    setTargetRooms={setTargetRooms}
                    onRoomsChange={handleRoomsChange}
                  />
                )}
                {step===1 && <StepHeaders headers={headers} setHeaders={setHeaders}/>}
                {step===2 && (
                  <>
                    {user.role !== "admin" && !user.is_google && usageCount >= (user.daily_limit ?? 10) && (
                      <div style={{marginBottom:16,padding:"12px 16px",background:"var(--red-light)",borderRadius:"var(--radius)",fontSize:13,color:"var(--red)",fontWeight:600}}>
                        🚫 โควต้าวันนี้เต็มแล้ว ({usageCount}/{user.daily_limit ?? 10}) — ไม่สามารถอ่านไฟล์ใหม่ได้ กรุณาลองพรุ่งนี้
                      </div>
                    )}
                    <StepQuestions questions={questions} setQuestions={setQuestions} licenseKey={user.key} onParsed={async () => {
                      const { data } = await supabase.rpc("get_my_usage", { p_key: user.key });
                      setUsageCount(data ?? 0);
                    }}/>
                  </>
                )}
                {step===3 && (
                  <div className="card">
                    <div className="card-title">🚀 พร้อมสร้าง Google Form</div>
                    <div className="card-sub">ตรวจสอบข้อมูลก่อนสร้าง</div>
                    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                      <div style={{padding:"12px 16px",background:"var(--gray-50)",borderRadius:"var(--radius)",fontSize:14}}>
                        📄 ชื่อข้อสอบ: <strong>{formTitle}</strong>
                      </div>
                      {formDesc && (
                        <div style={{padding:"12px 16px",background:"var(--gray-50)",borderRadius:"var(--radius)",fontSize:14}}>
                          📝 คำอธิบาย: <strong>{formDesc}</strong>
                        </div>
                      )}
                      <div style={{padding:"12px 16px",background:"var(--gray-50)",borderRadius:"var(--radius)",fontSize:14}}>
                        ❓ จำนวนข้อ: <strong>{questions.length} ข้อ</strong>
                      </div>
                      <div style={{padding:"12px 16px",background:"var(--gray-50)",borderRadius:"var(--radius)",fontSize:14}}>
                        📋 ส่วนหัว: <strong>{headers.map((h: any) => h.label).join(", ")}</strong>
                      </div>
                    </div>
                    {submitError && (
                      <div style={{marginBottom:14,padding:"12px 16px",background:"var(--red-light)",borderRadius:"var(--radius)",fontSize:13,color:"var(--red)"}}>
                        ⚠️ {submitError}
                      </div>
                    )}
                    <button className="btn btn-green" style={{width:"100%",padding:14,fontSize:16}} onClick={handleSubmit} disabled={loading}>
                      🚀 สร้าง Google Form เลย!
                    </button>
                  </div>
                )}
                {step===4 && result && <ResultView result={result} onReset={handleReset} userRole={user.role} usageCount={usageCount} dailyLimit={user.daily_limit??10}/>}

                {step < 3 && (
                  <div className="nav-row">
                    <button className="btn btn-secondary" onClick={() => setStep(s=>s-1)} disabled={step===0}>← ย้อนกลับ</button>
                    <div style={{fontSize:13,color:"var(--gray-500)",textAlign:"center"}}>
                      ขั้นตอนที่ {step+1} / {steps.length-1}
                      <div className="progress-bar" style={{width:100}}>
                        <div className="progress-fill" style={{width:`${((step+1)/(steps.length-1))*100}%`}}/>
                      </div>
                    </div>
                    <button className="btn btn-primary" style={{width:"auto",padding:"10px 24px"}}
                      onClick={() => setStep(s=>s+1)} disabled={!canNext()}>ถัดไป →</button>
                  </div>
                )}
                {step===3 && (
                  <div style={{marginTop:8}}>
                    <button className="btn btn-secondary" onClick={() => setStep(2)}>← ย้อนกลับ</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}