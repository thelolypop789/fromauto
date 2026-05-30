import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function genKey(role: string) {
  const prefix = role === "admin" ? "ADMIN" : "USER";
  const r1 = Math.random().toString(36).substring(2,8).toUpperCase();
  const r2 = Math.random().toString(36).substring(2,6).toUpperCase();
  return `${prefix}-${r1}-${r2}`;
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=Prompt:wght@500;600;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --blue:#1a73e8; --blue-dark:#1557b0; --blue-light:#e8f0fe;
    --green:#1e8e3e; --green-light:#e6f4ea;
    --red:#d93025; --red-light:#fce8e6;
    --yellow:#f9ab00; --yellow-light:#fef7e0;
    --purple:#7c3aed; --purple-light:#ede9fe;
    --gray-50:#f8f9fa; --gray-100:#f1f3f4; --gray-200:#e8eaed;
    --gray-400:#9aa0a6; --gray-600:#5f6368; --gray-800:#3c4043; --gray-900:#202124;
    --shadow-sm:0 1px 3px rgba(60,64,67,.15); --shadow-lg:0 4px 12px rgba(60,64,67,.15);
    --radius:8px; --radius-lg:12px;
  }
  body { font-family:'Sarabun',sans-serif; background:var(--gray-50); color:var(--gray-900); }
  .app { min-height:100vh; display:flex; flex-direction:column; }
  .login-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#e8f0fe 0%,#f8f9fa 50%,#e6f4ea 100%); }
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
  .topbar { background:white; border-bottom:1px solid var(--gray-200); display:flex; align-items:center; padding:0 24px; height:60px; position:sticky; top:0; z-index:100; box-shadow:var(--shadow-sm); }
  .topbar-brand { display:flex; align-items:center; gap:10px; flex:1; }
  .topbar-title { font-family:'Prompt',sans-serif; font-size:17px; font-weight:600; }
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
  .step-dot.active { background:var(--blue); color:white; box-shadow:0 0 0 4px rgba(26,115,232,.2); }
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
    <rect width="32" height="32" rx="8" fill="#1a73e8"/>
    <path d="M8 10h16M8 16h10M8 22h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="24" cy="22" r="4" fill="#34a853"/>
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

// ============ LOGIN ============
function LoginPage({ onLogin }: { onLogin: (u: any) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleLogin = async () => {
    if (!key.trim()) { setError("กรุณากรอก License Key"); return; }
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase
        .from("licenses").select("*")
        .eq("key", key.trim().toUpperCase())
        .eq("is_active", true).single();
      if (err || !data) { setError("License Key ไม่ถูกต้องหรือถูกปิดใช้งาน"); setLoading(false); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setError("License Key หมดอายุแล้ว"); setLoading(false); return; }
      setLoading(false);
      onLogin({ key: data.key, role: data.role, note: data.note });
    } catch { setError("เกิดข้อผิดพลาด กรุณาลองใหม่"); setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <Logo />
          <div>
            <div className="login-logo-title">FormAuto</div>
            <div className="login-logo-sub">ระบบสร้าง Google Forms อัตโนมัติ</div>
          </div>
        </div>
        <div className="login-title">กรอก License Key</div>
        <div className="login-sub">รับ Key ได้จากกลุ่ม Facebook ของเรา</div>
        <div className="field">
          <label>License Key</label>
          <div style={{position:"relative"}}>
            <input type={showKey?"text":"password"} placeholder="XXXX-XXXX-XXXX" value={key}
              onChange={e => { setKey(e.target.value); setError(""); }}
              onKeyDown={e => e.key==="Enter" && handleLogin()}
              className={error?"error":""}
              style={{paddingRight:44,letterSpacing:showKey?"normal":"0.15em",fontFamily:"monospace",fontSize:16}}/>
            <button onClick={() => setShowKey(v => !v)}
              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,padding:0}}>
              {showKey?"🙈":"👁️"}
            </button>
          </div>
          {error && <div className="error-msg">⚠️ {error}</div>}
        </div>
        <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
          {loading?"กำลังตรวจสอบ...":"🔓 เข้าใช้งาน"}
        </button>
      </div>
    </div>
  );
}

// ============ ADMIN PANEL ============
const GLOBAL_DAILY_LIMIT = 200;
const USER_DAILY_LIMIT = 10;

function AdminPanel() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState({ role:"user", note:"", expires_at:"" });
  const [generatedKey, setGeneratedKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [usageToday, setUsageToday] = useState<Record<string, number>>({});
  const [totalToday, setTotalToday] = useState(0);

  const fetchUsage = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("usage_logs").select("license_key, requests").eq("date", today);
    const map: Record<string, number> = {};
    let total = 0;
    for (const row of data ?? []) {
      map[row.license_key] = row.requests;
      total += row.requests;
    }
    setUsageToday(map);
    setTotalToday(total);
  };

  const fetchLicenses = async () => {
    setLoading(true);
    const { data } = await supabase.from("licenses").select("*").order("created_at", { ascending:false });
    setLicenses(data || []);
    await fetchUsage();
    setLoading(false);
  };

  useEffect(() => { fetchLicenses(); }, []);

  const createLicense = async () => {
    const key = genKey(newKey.role);
    await supabase.from("licenses").insert({ key, role:newKey.role, note:newKey.note||null, expires_at:newKey.expires_at||null, is_active:true });
    setGeneratedKey(key);
    fetchLicenses();
  };

 const toggleActive = async (id: string, current: boolean, role: string) => {
  if (role === "admin" && current) {
    alert("ไม่สามารถปิด Admin Key ได้ กรุณาลบแทน");
    return;
  }
  await supabase.from("licenses").update({ is_active:!current }).eq("id", id);
  fetchLicenses();
};

  const deleteLicense = async (id: string) => {
    if (!confirm("ต้องการลบ Key นี้ไหม?")) return;
    await supabase.from("licenses").delete().eq("id", id);
    fetchLicenses();
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
              <th>Key</th><th>Role</th><th>หมายเหตุ</th><th>หมดอายุ</th><th>วันนี้</th><th>สถานะ</th><th>จัดการ</th>
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
                      : <span className={`badge ${(usageToday[l.key]??0) >= USER_DAILY_LIMIT ? "badge-red" : "badge-blue"}`}>
                          {usageToday[l.key]??0}/{USER_DAILY_LIMIT}
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
function StepDetails({ formTitle, setFormTitle, formDesc, setFormDesc }: any) {
  return (
    <div className="card">
      <div className="card-title">📄 รายละเอียดชุดข้อสอบ</div>
      <div className="card-sub">กรอกข้อมูลพื้นฐานของแบบทดสอบ</div>
      <div className="field">
        <label>ชื่อชุดข้อสอบ *</label>
        <input type="text" placeholder="เช่น แบบทดสอบวิชาภาษาไทย ม.3/1"
          value={formTitle} onChange={e => setFormTitle(e.target.value)}/>
      </div>
      <div className="field" style={{marginBottom:0}}>
        <label>คำอธิบาย / คำชี้แจง</label>
        <textarea placeholder="เช่น ให้นักเรียนเลือกคำตอบที่ถูกที่สุดเพียงข้อเดียว เวลา 30 นาที"
          value={formDesc} onChange={e => setFormDesc(e.target.value)}/>
      </div>
    </div>
  );
}

// ============ STEP 1: HEADERS ============
function StepHeaders({ headers, setHeaders }: any) {
  const defaults = ["ชื่อ-สกุล","ชั้น","เลขที่","เลขประจำตัว"];
  const addHeader = () => setHeaders([...headers, {id:Date.now(),label:"",required:true}]);
  const removeHeader = (id: number) => setHeaders(headers.filter((h: any) => h.id!==id));
  const updateHeader = (id: number, val: string) => setHeaders(headers.map((h: any) => h.id===id?{...h,label:val}:h));
  const toggleRequired = (id: number) => setHeaders(headers.map((h: any) => h.id===id?{...h,required:!h.required}:h));
  const addDefault = (label: string) => { if (!headers.find((h: any) => h.label===label)) setHeaders([...headers,{id:Date.now(),label,required:true}]); };

  return (
    <div className="card">
      <div className="card-title">📋 กำหนดส่วนหัวของฟอร์ม</div>
      <div className="card-sub">ช่องข้อมูลที่ต้องการให้ผู้ทำข้อสอบกรอก</div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:13,color:"var(--gray-600)",marginBottom:8}}>เพิ่มรายการบ่อยใช้:</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {defaults.map(d => (
            <button key={d} className="btn btn-secondary btn-sm" onClick={() => addDefault(d)}
              style={{opacity:headers.find((h: any) => h.label===d)?".4":"1"}}>+ {d}</button>
          ))}
        </div>
      </div>
      <div className="header-list">
        {headers.map((h: any, i: number) => (
          <div className="header-row" key={h.id}>
            <span style={{fontSize:12,color:"var(--gray-400)",width:20,textAlign:"center"}}>{i+1}</span>
            <input className="header-input" placeholder="เช่น ชื่อ-สกุล, ชั้น, เลขที่..."
              value={h.label} onChange={e => updateHeader(h.id,e.target.value)}/>
            <span className={`header-badge ${h.required?"required":""}`} onClick={() => toggleRequired(h.id)}>
              {h.required?"จำเป็น":"ไม่จำเป็น"}
            </span>
            <button className="btn btn-icon" onClick={() => removeHeader(h.id)}><TrashIcon /></button>
          </div>
        ))}
      </div>
      <button className="btn btn-secondary" onClick={addHeader}><PlusIcon /> เพิ่มช่องข้อมูล</button>
    </div>
  );
}

// ============ STEP 2: QUESTIONS ============
function StepQuestions({ questions, setQuestions, licenseKey }: any) {
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
    const { data, error } = await supabase.functions.invoke("parse-exam", {
      body: { parts, license_key: licenseKey },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setParseError("");
    setHasAnswer(null);
    setQuestions([]);

    try {
      let parsed: any;

      if (file.name.endsWith(".docx") || file.name.endsWith(".txt")) {
        let text = "";
        if (file.name.endsWith(".docx")) {
          const mammoth = await import("mammoth");
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          text = result.value;
        } else {
          text = await file.text();
        }
        parsed = await callGemini([{ text: PROMPT + "\n\nข้อสอบ:\n" + text }]);

      } else if (file.name.endsWith(".pdf")) {
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

    } catch(err: any) {
      setParseError("อ่านไฟล์ไม่สำเร็จ: " + err.message);
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
              <div className="upload-hint">รองรับ .docx .pdf .txt</div>
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
            {questions.map((q: any, qi: number) => (
              <div className="question-card" key={q.id}>
                <div className="q-header">
                  <span className="q-num">ข้อ {qi+1}</span>
                  <input className="q-text-input" placeholder="กรอกคำถาม..." value={q.text}
                    onChange={e => updateQ(q.id, "text", e.target.value)} style={{flex:1}}/>
                  <button className="btn btn-icon" onClick={() => removeQ(q.id)}><TrashIcon /></button>
                </div>
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
            ))}
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
// ============ RESULT ============
function ResultView({ result, onReset }: any) {
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
    </div>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState("create");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [result, setResult] = useState<any>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [headers, setHeaders] = useState([
    {id:1,label:"ชื่อ-สกุล",required:true},
    {id:2,label:"ชั้น",required:true},
    {id:3,label:"เลขที่",required:true},
  ]);
  const [questions, setQuestions] = useState<any[]>([]);

  const steps = ["รายละเอียด","ส่วนหัว","ข้อสอบ","สร้าง Form","ผลลัพธ์"];

  const canNext = () => {
    if (step===0) return formTitle.trim().length > 0;
    if (step===1) return headers.length>0 && headers.every((h: any) => h.label.trim());
    if (step===2) return questions.length>0;
    return false;
  };

  const handleSubmit = async () => {
    const msgs = ["กำลังส่งข้อมูล...","กำลังสร้าง Google Form...","เพิ่มข้อสอบและตัวเลือก...","ตั้งค่าเฉลยอัตโนมัติ...","เสร็จสิ้น!"];
    let i = 0;
    setLoading(true); setLoadingMsg(msgs[0]);
    const iv = setInterval(() => { i++; if(i<msgs.length) setLoadingMsg(msgs[i]); }, 800);
    try {
      const res = await fetch(SCRIPT_URL, {
        method:"POST",
        body: JSON.stringify({ title:formTitle, description:formDesc, headers, questions }),
      });
      const data = await res.json();
      clearInterval(iv); setLoading(false);
      if (!data.success) throw new Error(data.error);
      await supabase.from("form_history").insert({
  license_key: user.key,
  form_title: formTitle,
  form_desc: formDesc || null,
  edit_url: data.editUrl?.trim(),
  view_url: data.viewUrl?.trim(),
  question_count: questions.length,
  header_count: headers.length,
});
      setResult({ title:formTitle, questionCount:questions.length, headerCount:headers.length, links:{ edit:data.editUrl?.trim(), view:data.viewUrl?.trim() } });
      setStep(4);
    } catch(err: any) {
      clearInterval(iv); setLoading(false);
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleReset = () => { setStep(0); setResult(null); setQuestions([]); setFormTitle(""); setFormDesc(""); };

  if (!user) return <><style>{css}</style><LoginPage onLogin={setUser}/></>;

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
            <span className={`role-badge ${user.role==="admin"?"role-admin":"role-user"}`}>
              {user.role==="admin"?"👑 Admin":"👤 User"}
            </span>
            <span style={{fontSize:13,color:"var(--gray-600)",fontFamily:"monospace"}}>{user.key}</span>
            <button className="btn btn-icon" onClick={() => setUser(null)}><LogoutIcon /></button>
          </div>
        </div>

        <div className="main-layout">
          <div className="sidebar">
            <button className={`sidebar-item ${tab==="create"?"active":""}`} onClick={() => { setTab("create"); }}>
            <FormIcon /> สร้างข้อสอบใหม่
          </button>
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
            <button className="sidebar-item" onClick={() => setUser(null)}><LogoutIcon /> ออกจากระบบ</button>
          </div>

          <div className="content">
           {tab==="admin" && user.role==="admin" ? <AdminPanel /> :
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

                {step===0 && <StepDetails formTitle={formTitle} setFormTitle={setFormTitle} formDesc={formDesc} setFormDesc={setFormDesc}/>}
                {step===1 && <StepHeaders headers={headers} setHeaders={setHeaders}/>}
                {step===2 && <StepQuestions questions={questions} setQuestions={setQuestions} licenseKey={user.key}/>}
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
                    <button className="btn btn-green" style={{width:"100%",padding:14,fontSize:16}} onClick={handleSubmit}>
                      🚀 สร้าง Google Form เลย!
                    </button>
                  </div>
                )}
                {step===4 && result && <ResultView result={result} onReset={handleReset}/>}

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