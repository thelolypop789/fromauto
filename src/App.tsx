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
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Prompt:wght@400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  :root {
    /* Royal Crimson & Amber Gold (Wang Luang Pittayasarn School Identity) */
    --crimson:#991B1B; --crimson-dark:#7F1D1D; --crimson-light:#FEF2F2;
    --gold:#F59E0B; --gold-dark:#D97706; --gold-light:#FEF3C7;
    --blue:#991B1B; --blue-dark:#7F1D1D; --blue-light:#FEF2F2;
    --green:#059669; --green-dark:#047857; --green-light:#ECFDF5;
    --red:#DC2626; --red-light:#FEE2E2;
    --yellow:#F59E0B; --yellow-light:#FEF3C7;
    --purple:#991B1B; --purple-light:#FEF2F2;
    --gray-50:#F8FAFC; --gray-100:#F1F5F9; --gray-200:#E2E8F0;
    --gray-300:#CBD5E1; --gray-400:#94A3B8; --gray-600:#475569; --gray-800:#1E293B; --gray-900:#0F172A;
    --shadow-sm:0 1px 3px rgba(15,23,42,.06); --shadow-md:0 4px 12px -2px rgba(15,23,42,.08); --shadow-lg:0 12px 28px -4px rgba(127,29,29,.14);
    --radius:10px; --radius-lg:14px; --radius-xl:20px;
  }
  body { font-family:'Sarabun',sans-serif; background:var(--gray-50); color:var(--gray-900); }
  .app { min-height:100vh; display:flex; flex-direction:column; }
  .login-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 50% 20%, #FEF2F2 0%, #FFFBEB 45%, #F8FAFC 100%); }
  .login-card { background:white; border-radius:var(--radius-xl); padding:44px 38px; width:100%; max-width:440px; box-shadow:var(--shadow-lg); animation:slideUp .4s ease; border:1px solid var(--gray-200); border-top:4.5px solid var(--crimson); }
  @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  .login-logo { display:flex; align-items:center; gap:12px; margin-bottom:28px; }
  .login-logo-title { font-family:'Prompt',sans-serif; font-size:20px; font-weight:700; color:var(--gray-900); }
  .login-logo-sub { font-size:12px; color:var(--gray-600); }
  .login-title { font-size:24px; font-weight:700; margin-bottom:8px; font-family:'Prompt',sans-serif; }
  .login-sub { font-size:14px; color:var(--gray-600); margin-bottom:24px; }
  .field { margin-bottom:18px; }
  .field label { display:block; font-size:13px; font-weight:600; color:var(--gray-800); margin-bottom:6px; }
  .field input, .field textarea, .field select { width:100%; padding:10px 14px; border:1.5px solid var(--gray-200); border-radius:var(--radius); font-size:14px; font-family:'Sarabun',sans-serif; outline:none; transition:border-color .2s; background:white; color:var(--gray-900); }
  .field input:focus, .field textarea:focus, .field select:focus { border-color:var(--crimson); box-shadow:0 0 0 3px rgba(153,27,27,.12); }
  .field input.error { border-color:var(--red); }
  .field textarea { resize:vertical; min-height:80px; }
  .error-msg { font-size:12px; color:var(--red); margin-top:4px; }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:10px 20px; border-radius:var(--radius); border:none; cursor:pointer; font-family:'Sarabun',sans-serif; font-size:14px; font-weight:600; transition:all .15s; white-space:nowrap; }
  .btn-primary { background:linear-gradient(135deg, var(--crimson) 0%, var(--crimson-dark) 100%); color:white; width:100%; padding:12px; font-size:15px; box-shadow:0 2px 8px rgba(153,27,27,.25); }
  .btn-primary:hover { background:var(--crimson-dark); transform:translateY(-1px); box-shadow:0 4px 12px rgba(153,27,27,.35); }
  .btn-secondary { background:var(--gray-100); color:var(--gray-800); border:1px solid var(--gray-200); }
  .btn-secondary:hover { background:var(--gray-200); }
  .btn-gold { background:linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color:white; box-shadow:0 2px 8px rgba(217,119,6,.25); }
  .btn-gold:hover { background:#B45309; transform:translateY(-1px); }
  .btn-green { background:var(--green); color:white; box-shadow:0 2px 8px rgba(5,150,105,.25); }
  .btn-green:hover { background:var(--green-dark); }
  .btn-red { background:var(--red-light); color:var(--red); }
  .btn-red:hover { background:#FEE2E2; }
  .btn-purple { background:var(--crimson); color:white; }
  .btn-purple:hover { background:var(--crimson-dark); }
  .btn-sm { padding:6px 14px; font-size:13px; }
  .btn-icon { padding:7px; background:transparent; border:1px solid rgba(255,255,255,.35); color:white; border-radius:8px; }
  .btn-icon:hover { background:rgba(255,255,255,.15); }
  .btn-delete { display:inline-flex; align-items:center; justify-content:center; gap:4px; padding:6px 10px; background:#FEE2E2; color:#DC2626; border:1.5px solid #FCA5A5; border-radius:var(--radius); font-size:12px; font-weight:700; cursor:pointer; transition:all .15s ease; white-space:nowrap; }
  .btn-delete:hover { background:#DC2626; color:white; border-color:#B91C1C; transform:translateY(-1px); }
  .step-clickable { cursor:pointer; transition:all .15s ease; border-radius:8px; padding:2px 4px; }
  .step-clickable:hover .step-dot { transform:scale(1.12); box-shadow:0 0 0 4px rgba(16,185,129,.3); }
  .step-clickable:hover .step-label { color:var(--green); text-decoration:underline; font-weight:700; }
  .btn-vibrant-new { display:inline-flex; align-items:center; justify-content:center; gap:10px; background:linear-gradient(135deg, #FF0055 0%, #FF5500 50%, #FFCC00 100%); color:white; font-family:'Prompt',sans-serif; font-size:18px; font-weight:800; padding:16px 38px; border-radius:50px; border:none; cursor:pointer; box-shadow:0 8px 25px rgba(255,85,0,.45), 0 0 0 2px rgba(255,255,255,.3); transition:all .2s ease; text-shadow:0 1px 2px rgba(0,0,0,.2); }
  .btn-vibrant-new:hover { transform:translateY(-3px) scale(1.03); box-shadow:0 14px 35px rgba(255,85,0,.65), 0 0 0 4px rgba(255,204,0,.5); }
  .btn-vibrant-new:active { transform:translateY(1px); }
  .btn:disabled { opacity:.5; cursor:not-allowed; }
  .topbar { background:linear-gradient(135deg, #7F1D1D 0%, #991B1B 55%, #B91C1C 100%); border-bottom:2.5px solid #F59E0B; display:flex; align-items:center; padding:0 24px; height:64px; position:sticky; top:0; z-index:100; box-shadow:0 4px 20px rgba(127,29,29,.22); }
  .topbar-brand { display:flex; align-items:center; gap:12px; flex:1; }
  .topbar-title { font-family:'Prompt',sans-serif; font-size:17px; font-weight:700; color:white; }
  .topbar-user { display:flex; align-items:center; gap:10px; }
  .role-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; }
  .role-admin { background:rgba(245,158,11,.9); color:#7F1D1D; font-weight:800; box-shadow:0 2px 6px rgba(0,0,0,.15); }
  .role-user { background:rgba(255,255,255,.2); color:white; border:1px solid rgba(255,255,255,.3); }
  .main-layout { display:flex; flex:1; min-height:calc(100vh - 64px); }
  .sidebar { width:230px; background:white; border-right:1px solid var(--gray-200); padding:16px 12px; flex-shrink:0; display:flex; flex-direction:column; }
  .sidebar-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:var(--radius); cursor:pointer; font-size:13.5px; font-weight:500; color:var(--gray-600); transition:all .15s; margin-bottom:2px; border:none; background:none; width:100%; text-align:left; }
  .sidebar-item:hover { background:var(--gray-100); color:var(--gray-900); }
  .sidebar-item.active { background:var(--crimson-light); color:var(--crimson); font-weight:700; border-left:3.5px solid var(--crimson); }
  .sidebar-item.admin-active { background:var(--gold-light); color:var(--gold-dark); font-weight:700; border-left:3.5px solid var(--gold); }
  .sidebar-section { font-size:11px; font-weight:700; color:var(--gray-400); padding:10px 12px 4px; text-transform:uppercase; letter-spacing:.8px; margin-top:6px; }
  .content { flex:1; padding:28px; overflow-y:auto; display:flex; flex-direction:column; }
  .stepper { display:flex; align-items:center; margin-bottom:28px; background:white; padding:16px 20px; border-radius:var(--radius-lg); border:1px solid var(--gray-200); box-shadow:var(--shadow-sm); }
  .step-dot { width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; transition:all .2s; }
  .step-dot.done { background:var(--green); color:white; }
  .step-dot.active { background:var(--crimson); color:white; box-shadow:0 0 0 4px rgba(245,158,11,.35); }
  .step-dot.pending { background:var(--gray-200); color:var(--gray-600); }
  .step-label { font-size:13px; font-weight:500; font-family:'Prompt',sans-serif; }
  .step-label.active { color:var(--crimson); font-weight:700; }
  .step-label.done { color:var(--green); font-weight:600; }
  .step-label.pending { color:var(--gray-400); }
  .step-line { flex:1; height:2px; background:var(--gray-200); margin:0 8px; min-width:16px; }
  .step-line.done { background:var(--green); }
  .card { background:white; border-radius:var(--radius-lg); padding:24px; box-shadow:var(--shadow-sm); border:1px solid var(--gray-200); margin-bottom:20px; }
  .card-title { font-family:'Prompt',sans-serif; font-size:17px; font-weight:700; color:var(--gray-900); margin-bottom:4px; }
  .card-sub { font-size:13px; color:var(--gray-600); margin-bottom:20px; }
  .header-list { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }
  .header-row { display:flex; align-items:center; gap:8px; }
  .header-input { flex:1; padding:8px 12px; border:1.5px solid var(--gray-200); border-radius:var(--radius); font-size:14px; font-family:'Sarabun',sans-serif; outline:none; }
  .header-input:focus { border-color:var(--crimson); }
  .header-badge { font-size:11px; font-weight:700; padding:3px 8px; border-radius:20px; background:var(--crimson-light); color:var(--crimson); cursor:pointer; white-space:nowrap; }
  .header-badge.required { background:var(--red-light); color:var(--red); }
  .upload-zone { border:2px dashed var(--gray-300); border-radius:var(--radius-lg); padding:36px; text-align:center; cursor:pointer; transition:all .2s; background:var(--gray-50); }
  .upload-zone:hover { border-color:var(--crimson); background:var(--crimson-light); }
  .upload-zone.has-file { border-color:var(--green); background:var(--green-light); border-style:solid; }
  .upload-text { font-size:15px; font-weight:600; color:var(--gray-800); margin-bottom:4px; margin-top:12px; }
  .upload-hint { font-size:13px; color:var(--gray-500); }
  .question-list { display:flex; flex-direction:column; gap:12px; }
  .question-card { border:1.5px solid var(--gray-200); border-radius:var(--radius); padding:16px; background:white; }
  .question-card:hover { border-color:var(--crimson); }
  .q-header { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
  .q-num { font-size:12px; font-weight:700; color:var(--crimson); background:var(--crimson-light); padding:2px 8px; border-radius:20px; white-space:nowrap; }
  .q-text-input { flex:1; padding:8px 12px; border:1.5px solid var(--gray-200); border-radius:var(--radius); font-size:14px; font-family:'Sarabun',sans-serif; outline:none; }
  .q-text-input:focus { border-color:var(--crimson); }
  .choices-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
  .choice-row { display:flex; align-items:center; gap:6px; }
  .choice-label { width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; cursor:pointer; transition:all .15s; border:2px solid var(--gray-200); color:var(--gray-600); }
  .choice-label.correct { background:var(--green); border-color:var(--green); color:white; }
  .choice-label.wrong { background:var(--gray-100); }
  .choice-input { flex:1; padding:6px 10px; border:1.5px solid var(--gray-200); border-radius:6px; font-size:13px; font-family:'Sarabun',sans-serif; outline:none; }
  .choice-input:focus { border-color:var(--crimson); }
  .choice-input.correct { border-color:var(--green); background:var(--green-light); }
  .result-card { background:linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%); border-radius:var(--radius-lg); padding:32px; color:white; text-align:center; margin-bottom:20px; animation:slideUp .4s ease; border-bottom:3px solid #F59E0B; }
  .result-title { font-family:'Prompt',sans-serif; font-size:22px; font-weight:700; margin-bottom:8px; }
  .result-sub { font-size:14px; opacity:.85; margin-bottom:24px; }
  .link-box { background:white; border-radius:var(--radius-lg); padding:14px 16px; display:flex; align-items:center; gap:10px; margin-bottom:10px; text-align:left; }
  .link-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; margin-bottom:3px; }
  .link-label.edit { color:var(--crimson); }
  .link-label.view { color:var(--green); }
  .link-url { font-size:12px; color:var(--gray-600); font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
  .copy-btn { font-size:13px; padding:7px 14px; border-radius:6px; border:none; cursor:pointer; display:flex; align-items:center; gap:5px; font-family:'Sarabun',sans-serif; white-space:nowrap; font-weight:600; transition:opacity .15s; }
  .copy-btn:hover { opacity:.85; }
  .copy-btn.copied { background:#059669 !important; color:white !important; }
  .btn-create-form {
    position: relative;
    width: 100%;
    background: linear-gradient(135deg, #059669 0%, #10B981 50%, #047857 100%);
    color: white;
    border: none;
    border-radius: 16px;
    padding: 18px 24px;
    cursor: pointer;
    overflow: hidden;
    box-shadow: 0 10px 25px -4px rgba(16, 185, 129, 0.45), 0 4px 12px rgba(5, 150, 105, 0.3);
    transition: all .25s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    align-items: center;
    gap: 16px;
    text-align: left;
  }
  .btn-create-form::before {
    content: '';
    position: absolute;
    top: 0; left: -100%; width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
    transform: skewX(-20deg);
    animation: btnShimmer 3s infinite;
  }
  @keyframes btnShimmer {
    0% { left: -100%; }
    40%, 100% { left: 160%; }
  }
  .btn-create-form:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 16px 32px -4px rgba(16, 185, 129, 0.55), 0 6px 16px rgba(5, 150, 105, 0.4);
    background: linear-gradient(135deg, #047857 0%, #10B981 40%, #059669 100%);
  }
  .btn-create-form:active:not(:disabled) {
    transform: translateY(1px);
  }
  .btn-create-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.22);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
  }
  .btn-create-title {
    font-family: 'Prompt', sans-serif;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.3px;
    color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,0.15);
  }
  .btn-create-sub {
    font-size: 12.5px;
    color: rgba(255,255,255,0.92);
    font-weight: 400;
    margin-top: 2px;
  }
  .loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 500;
    backdrop-filter: blur(8px);
    animation: fadeInOverlay .25s ease;
  }
  @keyframes fadeInOverlay { from{opacity:0} to{opacity:1} }
  .loading-modal {
    background: white;
    border-radius: 24px;
    padding: 34px 30px 24px;
    width: 92%;
    max-width: 450px;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.15);
    text-align: center;
    position: relative;
    animation: popInModal .3s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }
  @keyframes popInModal { from{transform:scale(0.92); opacity:0} to{transform:scale(1); opacity:1} }
  .loading-modal::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 5px;
    background: linear-gradient(90deg, var(--crimson), #F59E0B, var(--green), var(--crimson));
    background-size: 200% 100%;
    animation: gradientShift 2.5s linear infinite;
  }
  @keyframes gradientShift {
    0% { background-position: 0% 0%; }
    100% { background-position: 200% 0%; }
  }
  .loading-animation-container {
    position: relative;
    width: 86px;
    height: 86px;
    margin: 0 auto 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pulse-ring {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(185, 28, 28, 0.18) 0%, transparent 70%);
    animation: pulseRing 1.8s ease-out infinite;
  }
  @keyframes pulseRing {
    0% { transform: scale(0.8); opacity: 1; }
    100% { transform: scale(1.35); opacity: 0; }
  }
  .orbital-spinner {
    width: 74px;
    height: 74px;
    border-radius: 50%;
    border: 3.5px solid #F1F5F9;
    border-top-color: var(--crimson);
    border-right-color: #F59E0B;
    border-bottom-color: var(--green);
    animation: spin 1s linear infinite;
  }
  .loading-center-icon {
    position: absolute;
    font-size: 30px;
    animation: floatIcon 2s ease-in-out infinite alternate;
  }
  @keyframes floatIcon {
    from { transform: translateY(-2px) scale(0.96); }
    to { transform: translateY(2px) scale(1.04); }
  }
  .loading-title {
    font-family: 'Prompt', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--gray-900);
    margin-bottom: 6px;
  }
  .loading-desc {
    font-size: 13.5px;
    color: var(--gray-600);
    margin-bottom: 20px;
    line-height: 1.5;
  }
  .loading-steps {
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
    background: var(--gray-50);
    border-radius: 14px;
    padding: 14px 16px;
    margin-bottom: 18px;
    border: 1px solid var(--gray-200);
  }
  .loading-step-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--gray-400);
    transition: all .25s ease;
  }
  .loading-step-item.active {
    color: var(--crimson);
    font-weight: 700;
  }
  .loading-step-item.done {
    color: var(--green);
    font-weight: 600;
  }
  .loading-step-icon {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
  }
  .loading-step-item.active .loading-step-icon {
    background: var(--crimson-light);
    color: var(--crimson);
  }
  .loading-step-item.done .loading-step-icon {
    background: var(--green-light);
    color: var(--green);
  }
  .loading-step-item.pending .loading-step-icon {
    background: var(--gray-200);
    color: var(--gray-500);
  }
  .loading-step-badge {
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 10px;
    font-weight: 700;
  }
  .loading-step-badge.active {
    background: var(--crimson-light);
    color: var(--crimson);
  }
  .loading-step-badge.done {
    background: var(--green-light);
    color: var(--green);
  }
  .loading-bar-wrapper {
    height: 6px;
    background: var(--gray-200);
    border-radius: 10px;
    overflow: hidden;
    position: relative;
    margin-bottom: 12px;
  }
  .loading-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--crimson), #F59E0B, var(--green));
    border-radius: 10px;
    transition: width .4s ease;
  }
  .loading-note {
    font-size: 12px;
    color: var(--gray-400);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .spinner { width:48px; height:48px; border:4px solid var(--gray-200); border-top-color:var(--crimson); border-radius:50%; animation:spin .8s linear infinite; margin-bottom:16px; }
  @keyframes spin { to{transform:rotate(360deg)} }
  .loading-text { font-size:15px; font-weight:600; color:var(--gray-800); }
  .loading-sub { font-size:13px; color:var(--gray-500); margin-top:4px; }
  .app-footer {
    text-align: center;
    padding: 24px 0 10px;
    font-size: 12px;
    color: var(--gray-400);
    letter-spacing: 0.5px;
    user-select: none;
    margin-top: auto;
  }
  .sidebar-footer {
    padding: 16px 10px 4px;
    font-size: 11px;
    color: var(--gray-400);
    text-align: center;
    opacity: 0.7;
    margin-top: auto;
    letter-spacing: 0.3px;
    user-select: none;
  }
  .empty-state { text-align:center; padding:60px 20px; color:var(--gray-500); }
  .empty-icon { font-size:40px; margin-bottom:12px; }
  .progress-bar { height:4px; background:var(--gray-200); border-radius:2px; margin-top:8px; overflow:hidden; }
  .progress-fill { height:100%; background:var(--crimson); border-radius:2px; transition:width .3s; }
  .nav-row { display:flex; gap:12px; align-items:center; justify-content:space-between; margin-top:8px; }
  .license-table { width:100%; border-collapse:collapse; }
  .license-table th { text-align:left; font-size:12px; font-weight:600; color:var(--gray-600); padding:8px 12px; border-bottom:2px solid var(--gray-200); }
  .license-table td { padding:12px; border-bottom:1px solid var(--gray-100); font-size:14px; vertical-align:middle; }
  .license-table tr:last-child td { border:none; }
  .license-table tr:hover td { background:var(--gray-50); }
  .badge { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:3px 8px; border-radius:20px; }
  .badge-green { background:var(--green-light); color:var(--green); }
  .badge-red { background:var(--red-light); color:var(--red); }
  .badge-blue { background:var(--crimson-light); color:var(--crimson); }
  .badge-purple { background:var(--gold-light); color:var(--gold-dark); }
  .modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,.5); display:flex; align-items:center; justify-content:center; z-index:300; backdrop-filter:blur(4px); }
  .modal { background:white; border-radius:var(--radius-lg); padding:28px; width:100%; max-width:440px; box-shadow:var(--shadow-lg); animation:slideUp .3s ease; border:1px solid var(--gray-200); border-top:4px solid var(--crimson); }
  .modal-title { font-family:'Prompt',sans-serif; font-size:18px; font-weight:700; color:var(--gray-900); margin-bottom:20px; }
  .modal-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:20px; }
  .stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px; }
  .stat-card { background:white; border-radius:var(--radius-lg); padding:20px; box-shadow:var(--shadow-sm); border:1px solid var(--gray-200); text-align:center; }
  .stat-number { font-family:'Prompt',sans-serif; font-size:32px; font-weight:700; margin-bottom:4px; color:var(--crimson); }
  .stat-label { font-size:13px; color:var(--gray-600); }
  @media (max-width:768px) {
    .main-layout { flex-direction:column; }
    .sidebar { width:100%; border-right:none; border-bottom:1px solid var(--gray-200); padding:8px; display:flex; flex-wrap:wrap; gap:4px; }
    .sidebar-section { display:none; }
    .sidebar-item { width:auto; padding:7px 12px; font-size:13px; }
    .content { padding:16px; }
    .stepper { overflow-x:auto; padding:12px; }
    .step-label { display:none; }
    .stats-grid { grid-template-columns:repeat(3,1fr); gap:8px; }
    .stat-number { font-size:22px; }
    .choices-grid { grid-template-columns:1fr; }
    .login-card { padding:32px 20px; }
    .topbar { padding:0 14px; }
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
  <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="#991B1B"/>
    <path d="M8 10h16M8 16h10M8 22h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="24" cy="22" r="4" fill="#F59E0B"/>
    <path d="M22 22l1.5 1.5L26 20" stroke="#7F1D1D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
      {/* Decorative bg circles in red/gold soft tint */}
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
        <div style={{position:"absolute",top:"-10%",right:"-5%",width:480,height:480,borderRadius:"50%",background:"radial-gradient(circle, rgba(185,28,28,.09) 0%, transparent 70%)"}}/>
        <div style={{position:"absolute",bottom:"-10%",left:"-5%",width:420,height:420,borderRadius:"50%",background:"radial-gradient(circle, rgba(245,158,11,.09) 0%, transparent 70%)"}}/>
        <div style={{position:"absolute",top:"35%",left:"8%",width:240,height:240,borderRadius:"50%",background:"rgba(254,243,199,.35)"}}/>
      </div>

      <div className="login-card" style={{position:"relative",zIndex:1,maxWidth:440}}>
        {/* School Logo & Brand */}
        <div style={{textAlign:"center",marginBottom:20}}>
          <img
            src="/school-logo.png"
            alt="ตราโรงเรียนวังหลวงพิทยาสรรพ์"
            style={{
              height: 84,
              width: "auto",
              objectFit: "contain",
              marginBottom: 10,
              filter: "drop-shadow(0 4px 10px rgba(153,27,27,.2))"
            }}
          />
          <div style={{fontSize: 12, fontWeight: 700, color: "var(--crimson)", letterSpacing: "1px", textTransform: "uppercase"}}>
            โรงเรียนวังหลวงพิทยาสรรพ์
          </div>
          <div style={{fontFamily:"'Prompt',sans-serif",fontSize:26,fontWeight:800,color:"var(--gray-900)",lineHeight:1.2,marginTop:2}}>
            FormAuto
          </div>
          <div style={{fontSize:13.5,color:"var(--gray-600)",marginTop:4}}>
            ระบบสร้างและวิเคราะห์ข้อสอบออนไลน์
          </div>
        </div>

        {/* Google Login for Teachers */}
        <button
          className="btn"
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            borderRadius: 12,
            fontSize: 14.5,
            padding: "13px 16px",
            marginBottom: 16,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "white",
            border: "1.5px solid var(--gray-300)",
            color: "var(--gray-800)",
            fontWeight: 600,
            boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
            cursor: "pointer",
            transition: "all .2s"
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          เข้าสู่ระบบด้วยอีเมลโรงเรียน (@wangluangpitt.ac.th)
        </button>

        <div style={{display:"flex",alignItems:"center",margin:"18px 0",color:"var(--gray-400)",fontSize:13}}>
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

        <div style={{textAlign:"center",marginTop:20,fontSize:11.5,color:"var(--gray-400)",opacity:0.7,letterSpacing:0.3,userSelect:"none"}}>
          develop by พงศกร ดรโคตร์กอก
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
      <div className="card-title">📄 ข้อมูลหัวกระดาษและรายละเอียดข้อสอบ</div>
      <div className="card-sub">ตั้งชื่อหัวข้อสอบ คำชี้แจงหัวกระดาษ และเลือกห้องเรียนที่ใช้ข้อสอบชุดนี้</div>

      <div className="field">
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, flexWrap:"wrap", gap:6}}>
          <label style={{margin:0, fontWeight:700}}>ชื่อชุดข้อสอบ / หัวกระดาษ *</label>
          <div style={{display:"flex", gap:4, flexWrap:"wrap", alignItems:"center"}}>
            <span style={{fontSize:11, color:"var(--gray-500)"}}>⚡ ตัวอย่างหัวข้อ:</span>
            {[
              "แบบทดสอบวัดผลกลางภาค",
              "แบบทดสอบวัดผลปลายภาค",
              "แบบทดสอบเก็บคะแนน",
            ].map(preset => (
              <button
                key={preset}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{fontSize:11, padding:"2px 8px"}}
                onClick={() => setFormTitle(formTitle ? `${preset} ${formTitle}` : preset)}
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>
        <input
          type="text"
          placeholder="เช่น แบบทดสอบวัดผลกลางภาค วิชาภาษาไทย ม.1 โรงเรียนวังหลวงพิทยาสรรพ์"
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
      <div className="card-title">📋 กำหนดส่วนหัวของฟอร์ม (ข้อมูลนักเรียน)</div>
      <div className="card-sub">กำหนดช่องข้อมูลหัวกระดาษที่ต้องการให้นักเรียนกรอก เช่น ชื่อ-สกุล ชั้น เลขที่ (สามารถลบหรือแก้ไขได้ทุกข้อ)</div>

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
              <button
                type="button"
                className="btn-delete"
                onClick={() => removeHeader(h.id)}
                title={`ลบข้อ ${i+1}: ${h.label || "ช่องนี้"}`}
              >
                <TrashIcon /> ลบ
              </button>
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
      "type": "multiple_choice",
      "text": "คำถาม",
      "points": 1,
      "choices": ["ตัวเลือก1","ตัวเลือก2","ตัวเลือก3","ตัวเลือก4"],
      "answer": 0,
      "answerText": ""
    }
  ]
}
กฎสำคัญ:
- type ให้เลือก 1 จาก: "multiple_choice" (ปรนัย/เลือกตอบ), "short_answer" (เติมคำ/ตอบสั้น), "paragraph" (อัตนัย/บรรยาย/ข้อเขียน)
- points คือน้ำหนักคะแนนของข้อนั้น (ตัวเลข เช่น 1, 2, 5) ถ้าในข้อสอบมีระบุคะแนนข้อนั้น เช่น "(2 คะแนน)" ให้นำมาใส่ ถ้าไม่ระบุให้เป็น 1
- สำหรับ multiple_choice:
  - choices คือตัวเลือก (เช่น 4 ตัวเลือก)
  - answer คือ index ของตัวเลือกที่ถูก (0=ตัวเลือกแรก, 1=ตัวเลือกที่สอง ...) ถ้าไม่มีเฉลยให้ answer = -1
  - รองรับตัวเลือกแบบ ก ข ค ง และ A B C D และ 1 2 3 4
  - จับเฉลยจากเฉลยท้ายไฟล์ หรือสีตัวอักษร หรือไฮไลต์ หรือเครื่องหมายใดๆ
- สำหรับ short_answer (เติมคำ) หรือ paragraph (อัตนัย):
  - choices ให้เป็น []
  - answer ให้เป็น -1
  - answerText คือแนวคำตอบ หรือเฉลย หรือเกณฑ์การให้คะแนน (ถ้ามี)
- ถ้าไม่มีเฉลยในไฟล์เลย ให้ hasAnswer = false
- ถ้ามีเฉลย ให้ hasAnswer = true
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
      const qs = (parsed.questions || []).map((q: any, i: number) => {
        const qType = (q.type === "short_answer" || q.type === "paragraph") ? q.type : "multiple_choice";
        const pts = typeof q.points === "number" && q.points >= 0 ? q.points : 1;
        return {
          id: Date.now() + i,
          type: qType,
          points: pts,
          text: q.text || "",
          choices: qType === "multiple_choice" ? (Array.isArray(q.choices) && q.choices.length > 0 ? q.choices : ["","","",""]) : [],
          answer: qType === "multiple_choice" ? (q.answer >= 0 ? q.answer : 0) : -1,
          answerText: q.answerText || ""
        };
      });

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
  const addQuestion = (type = "multiple_choice") =>
    setQuestions([...questions, {
      id: Date.now(),
      type,
      points: 1,
      text: "",
      choices: type === "multiple_choice" ? ["","","",""] : [],
      answer: 0,
      answerText: ""
    }]);
  const removeQ = (id: number) =>
    setQuestions(questions.filter((q: any) => q.id!==id));
  const changeQType = (id: number, newType: string) => {
    setQuestions(questions.map((q: any) => {
      if (q.id !== id) return q;
      return {
        ...q,
        type: newType,
        choices: newType === "multiple_choice" ? (q.choices && q.choices.length ? q.choices : ["","","",""]) : [],
        answer: newType === "multiple_choice" ? (q.answer >= 0 ? q.answer : 0) : -1
      };
    }));
  };

  const totalPoints = questions.reduce((sum: number, q: any) => sum + (typeof q.points === "number" && q.points >= 0 ? q.points : 1), 0);
  const mcCount = questions.filter((q: any) => !q.type || q.type === "multiple_choice").length;
  const saCount = questions.filter((q: any) => q.type === "short_answer").length;
  const pCount = questions.filter((q: any) => q.type === "paragraph").length;

  return (
    <div>
      {/* Upload Zone */}
      <div className="card">
        <div className="card-title">📁 อัปโหลดไฟล์ข้อสอบ</div>
        <div className="card-sub">รองรับ .docx .pdf .txt — AI จะอ่านและจำแนกข้อสอบ ปรนัย เติมคำ และอัตนัย ให้อัตโนมัติ</div>
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
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, marginBottom:16}}>
          <div>
            <div className="card-title" style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
              <span>❓ รายการข้อสอบ ({questions.length} ข้อ)</span>
              <span style={{fontSize:13, background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", padding:"2px 10px", borderRadius:12, fontWeight:700}}>
                🎯 คะแนนเต็มรวม {totalPoints} คะแนน
              </span>
            </div>
            <div style={{fontSize:12, color:"var(--gray-500)", marginTop:4, display:"flex", gap:8, flexWrap:"wrap"}}>
              <span>🔘 ปรนัย {mcCount} ข้อ</span>
              <span>•</span>
              <span>✏️ เติมคำ {saCount} ข้อ</span>
              <span>•</span>
              <span>📝 อัตนัย {pCount} ข้อ</span>
            </div>
          </div>
          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addQuestion("multiple_choice")} title="เพิ่มข้อสอบแบบเลือกตอบ (ก-ง)">
              <PlusIcon /> + ปรนัย
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addQuestion("short_answer")} title="เพิ่มข้อสอบแบบเติมคำตอบสั้น">
              <PlusIcon /> + เติมคำ
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => addQuestion("paragraph")} title="เพิ่มข้อสอบแบบเขียนบรรยาย/อัตนัย">
              <PlusIcon /> + อัตนัย
            </button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <p>อัปโหลดไฟล์หรือกดปุ่มเพิ่มข้อสอบด้านบนเพื่อกรอกเอง</p>
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
              const qType = q.type || "multiple_choice";
              const qPoints = typeof q.points === "number" && q.points >= 0 ? q.points : 1;

              return (
              <div className="question-card" key={q.id} style={warn ? {borderColor:"var(--yellow)"} : {}}>
                <div className="q-header" style={{flexWrap: "wrap", gap: 8, alignItems: "center"}}>
                  <span className="q-num">ข้อ {qi+1}</span>

                  {/* Question Type Selector */}
                  <select
                    value={qType}
                    onChange={e => changeQType(q.id, e.target.value)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1.5px solid var(--gray-200)",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: qType === "short_answer" ? "#FEF3C7" : qType === "paragraph" ? "#F3E8FF" : "#EFF6FF",
                      color: qType === "short_answer" ? "#92400E" : qType === "paragraph" ? "#6B21A8" : "#1E40AF",
                      cursor: "pointer"
                    }}
                  >
                    <option value="multiple_choice">🔘 ปรนัย (เลือกตอบ)</option>
                    <option value="short_answer">✏️ เติมคำ (คำตอบสั้น)</option>
                    <option value="paragraph">📝 อัตนัย (บรรยาย)</option>
                  </select>

                  {/* Question Points Input */}
                  <div style={{display: "inline-flex", alignItems: "center", gap: 4, background: "var(--gray-50)", padding: "3px 8px", borderRadius: "6px", border: "1px solid var(--gray-200)", fontSize: "12px"}}>
                    <span style={{fontWeight: 600, color: "var(--gray-600)"}}>คะแนน:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={qPoints}
                      onChange={e => updateQ(q.id, "points", Math.max(0, parseInt(e.target.value, 10) || 0))}
                      style={{
                        width: 44,
                        textAlign: "center",
                        padding: "2px 4px",
                        borderRadius: "4px",
                        border: "1.5px solid var(--gray-300)",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--crimson)",
                        background: "white"
                      }}
                    />
                    <span style={{color: "var(--gray-500)"}}>คะแนน</span>
                  </div>

                  {warn && (
                    <div style={{width:20,height:20,borderRadius:"50%",background:"var(--yellow)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0}}>!</div>
                  )}

                  <input className="q-text-input" placeholder="กรอกคำถามหรือโจทย์..." value={q.text}
                    onChange={e => updateQ(q.id, "text", e.target.value)} style={{flex:1, minWidth: 200}}/>
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() => removeQ(q.id)}
                    title={`ลบข้อ ${qi+1}`}
                  >
                    <TrashIcon /> ลบ
                  </button>
                </div>

                {warn && (
                  <div style={{fontSize:12,color:"#92400e",background:"var(--yellow-light)",borderRadius:6,padding:"4px 10px",marginBottom:8}}>
                    ⚠️ {isEmpty ? "คำถามว่างเปล่า" : "ข้อความซ้ำกับข้ออื่น — จะเติม (2), (3) ให้อัตโนมัติตอนสร้างฟอร์ม"}
                  </div>
                )}

                {/* Multiple Choice UI */}
                {qType === "multiple_choice" && (
                  <>
                    <div style={{fontSize:11, color:"var(--gray-500)", marginBottom:8}}>
                      คลิกวงกลมเพื่อเลือกเฉลย {q.answer >= 0 ? `(เฉลย: ${labels[q.answer] || (q.answer+1)})` : "(ยังไม่มีเฉลย)"}
                    </div>
                    <div className="choices-grid">
                      {q.choices.map((c: string, ci: number) => (
                        <div className="choice-row" key={ci}>
                          <div
                            className={`choice-label ${q.answer===ci ? "correct" : "wrong"}`}
                            onClick={() => updateQ(q.id, "answer", ci)}
                          >
                            {q.answer===ci ? <CheckIcon /> : labels[ci] || (ci+1)}
                          </div>
                          <input
                            className={`choice-input ${q.answer===ci ? "correct" : ""}`}
                            placeholder={`ตัวเลือก ${labels[ci] || (ci+1)}`} value={c}
                            onChange={e => updateChoice(q.id, ci, e.target.value)}/>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Short Answer UI */}
                {qType === "short_answer" && (
                  <div style={{marginTop: 8, padding: "10px 12px", background: "#FFFBEB", borderRadius: "8px", border: "1px solid #FDE68A"}}>
                    <div style={{fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 6, display: "flex", alignItems: "center", gap: 6}}>
                      <span>✏️ แนวคำตอบ / เฉลยสำหรับข้อสอบเติมคำ:</span>
                    </div>
                    <input
                      type="text"
                      className="choice-input"
                      style={{width: "100%", background: "white", padding: "8px 12px", fontSize: "13px"}}
                      placeholder="กรอกแนวคำตอบที่ถูกต้องสำหรับข้อนี้ (ถ้ามี)..."
                      value={q.answerText || ""}
                      onChange={e => updateQ(q.id, "answerText", e.target.value)}
                    />
                    <div style={{fontSize: 11, color: "#B45309", marginTop: 4}}>
                      💡 ใน Google Form จะสร้างเป็นช่องกรอกคำตอบสั้น (Short Answer) และมีแนวคำตอบนี้บันทึกไว้ให้ครูดูตอนตรวจให้คะแนน
                    </div>
                  </div>
                )}

                {/* Paragraph UI */}
                {qType === "paragraph" && (
                  <div style={{marginTop: 8, padding: "10px 12px", background: "#FAF5FF", borderRadius: "8px", border: "1px solid #E9D5FF"}}>
                    <div style={{fontSize: 12, fontWeight: 700, color: "#6B21A8", marginBottom: 6, display: "flex", alignItems: "center", gap: 6}}>
                      <span>📝 แนวคำตอบ / เกณฑ์การให้คะแนน (อัตนัย/บรรยาย):</span>
                    </div>
                    <textarea
                      className="choice-input"
                      style={{width: "100%", background: "white", padding: "8px 12px", fontSize: "13px", minHeight: 60, resize: "vertical"}}
                      placeholder="ระบุแนวคำตอบสำคัญ หรือเกณฑ์ในการให้คะแนนข้อนี้..."
                      value={q.answerText || ""}
                      onChange={e => updateQ(q.id, "answerText", e.target.value)}
                    />
                    <div style={{fontSize: 11, color: "#7E22CE", marginTop: 4}}>
                      💡 ใน Google Form จะสร้างเป็นช่องเขียนบรรยาย (Paragraph) เพื่อให้นักเรียนพิมพ์ตอบได้อย่างอิสระ และครูสามารถตรวจให้คะแนนในระบบได้โดยตรง
                    </div>
                  </div>
                )}
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
function ExamScoreDashboard({ exam, onBack, user }: { exam: any; onBack: () => void; user?: any }) {
  const isSchoolUser = user?.is_google ||
    (user?.email && user.email.toLowerCase().endsWith("@wangluangpitt.ac.th")) ||
    (typeof user?.key === "string" && user.key.toLowerCase().endsWith("@wangluangpitt.ac.th")) ||
    user?.role === "admin";
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "sheet">("overview");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roomFilter, setRoomFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"no" | "score_desc" | "score_asc" | "time">("no");

  // In-App Grading State
  const [gradingStudent, setGradingStudent] = useState<any>(null);
  const [newScoreInput, setNewScoreInput] = useState<string>("");
  const [savingScore, setSavingScore] = useState(false);
  const [gradeSuccessMsg, setGradeSuccessMsg] = useState("");
  const [gradeErrorMsg, setGradeErrorMsg] = useState("");

  const loadData = async () => {
    if (!exam.sheet_url) return;
    setLoading(true);
    setError("");
    try {
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

  // Safe helper functions to prevent any type crash
  const getSafeStr = (val: any): string => {
    if (val === undefined || val === null) return "";
    if (val instanceof Date) return val.toLocaleString("th-TH");
    return String(val).trim();
  };

  const getStudentField = (s: any, keys: string[]): string => {
    if (!s || typeof s !== "object") return "";
    for (const k of keys) {
      if (s[k] !== undefined && s[k] !== null && s[k] !== "") {
        return getSafeStr(s[k]);
      }
    }
    const entries = Object.entries(s);
    for (const k of keys) {
      const kLower = k.toLowerCase();
      const found = entries.find(([key]) => key.toLowerCase().includes(kLower));
      if (found && found[1] !== undefined && found[1] !== null && found[1] !== "") {
        return getSafeStr(found[1]);
      }
    }
    return "";
  };

  const totalMax = exam.question_count || 20;

  const parseScore = (s: any, defaultTotal: number = 20) => {
    const raw = getStudentField(s, ["คะแนน", "score", "total score", "points"]);
    if (!raw) return { str: "-", earned: 0, total: defaultTotal, isPass: false };
    const rawStr = String(raw).trim();
    if (rawStr.includes("/")) {
      const parts = rawStr.split("/");
      const earned = parseFloat(parts[0]) || 0;
      const total = parseFloat(parts[1]) || defaultTotal;
      return {
        str: `${earned} / ${total}`,
        earned,
        total,
        isPass: earned >= Math.ceil(total * 0.5)
      };
    }
    const earned = parseFloat(rawStr) || 0;
    return {
      str: `${earned} / ${defaultTotal}`,
      earned,
      total: defaultTotal,
      isPass: earned >= Math.ceil(defaultTotal * 0.5)
    };
  };

  const getStudentNo = (s: any): number => {
    const raw = getStudentField(s, ["เลขที่", "no.", "no", "number"]);
    if (!raw) return 9999;
    const match = raw.match(/\d+/);
    return match ? parseInt(match[0], 10) : 9999;
  };

  const getStudentRoom = (s: any): string => {
    const r = getStudentField(s, ["ชั้น", "ห้องเรียน", "ห้อง", "ระดับชั้น", "room", "class"]);
    return r || "ไม่ระบุห้อง";
  };

  const rawStudents: any[] = data?.students || [];

  // คำนวณสถิติจากคะแนนนักเรียนจริงโดยตรง (Real-time Calculation)
  const studentScores = rawStudents.map(s => parseScore(s, totalMax).earned).filter(n => !isNaN(n));
  const passThresh = Math.ceil(totalMax * 0.5);
  const totalCount = studentScores.length;
  const computedAvg = totalCount > 0 ? (studentScores.reduce((a, b) => a + b, 0) / totalCount).toFixed(2) + " คะแนน" : "-";
  const computedMax = totalCount > 0 ? Math.max(...studentScores) + " คะแนน" : "-";
  const computedMin = totalCount > 0 ? Math.min(...studentScores) + " คะแนน" : "-";
  const computedPass = studentScores.filter(s => s >= passThresh).length;
  const computedFail = totalCount - computedPass;
  const computedPassRate = totalCount > 0 ? ((computedPass / totalCount) * 100).toFixed(1) + "%" : "0%";

  // รวบรวมรายชื่อห้องทั้งหมด
  const roomSet = new Set<string>();
  rawStudents.forEach(s => {
    const r = getStudentRoom(s);
    if (r && r !== "ไม่ระบุห้อง") roomSet.add(r);
  });
  if (data?.stats?.rooms && Array.isArray(data.stats.rooms)) {
    data.stats.rooms.forEach((r: any) => {
      if (r?.room) roomSet.add(String(r.room).trim());
    });
  }
  const roomList = Array.from(roomSet).sort((a, b) => a.localeCompare(b, "th-TH", { numeric: true }));

  // ข้อมูลสถิติแต่ละห้องสำหรับแท็บ Overview
  const roomStatsComputed = (roomList.length > 0 ? roomList : ["ม.1/1", "ม.1/2", "ม.1/3", "ม.1/4"]).map(rm => {
    const rmStudents = rawStudents.filter(s => getStudentRoom(s) === rm || getStudentRoom(s).includes(rm));
    const rmCount = rmStudents.length;
    const rmScores = rmStudents.map(s => parseScore(s, totalMax).earned);
    const rmAvg = rmCount > 0 ? (rmScores.reduce((a, b) => a + b, 0) / rmCount).toFixed(1) : "-";
    const rmPass = rmStudents.filter(s => parseScore(s, totalMax).isPass).length;
    return {
      room: rm,
      count: `${rmCount} คน`,
      status: rmCount > 0 ? `ส่งแล้ว (ผ่าน ${rmPass}/${rmCount})` : "ยังไม่มีผู้ส่ง",
      avg: rmAvg
    };
  });

  const stats = {
    totalStudents: totalCount > 0 ? `${totalCount} คน` : (data?.stats?.totalStudents || "0 คน"),
    totalScore: data?.stats?.totalScore || `${totalMax} คะแนน`,
    average: totalCount > 0 ? computedAvg : (data?.stats?.average || "-"),
    maxScore: totalCount > 0 ? computedMax : (data?.stats?.maxScore || "-"),
    minScore: totalCount > 0 ? computedMin : (data?.stats?.minScore || "-"),
    passCount: totalCount > 0 ? `${computedPass} คน` : (data?.stats?.passCount || "0 คน"),
    failCount: totalCount > 0 ? `${computedFail} คน` : (data?.stats?.failCount || "0 คน"),
    passRate: totalCount > 0 ? computedPassRate : (data?.stats?.passRate || "0%"),
    rooms: roomStatsComputed
  };

  // กรองตามการค้นหาและห้องเรียน
  const filteredStudents = rawStudents.filter(s => {
    const text = Object.values(s).map(v => getSafeStr(v)).join(" ").toLowerCase();
    const matchSearch = !searchTerm || text.includes(searchTerm.toLowerCase());
    const studentRoom = getStudentRoom(s);
    const matchR = roomFilter === "all" || studentRoom === roomFilter || studentRoom.includes(roomFilter);
    return matchSearch && matchR;
  });

  // เรียงลำดับนักเรียน
  const sortStudentList = (list: any[]) => {
    return [...list].sort((a, b) => {
      if (sortBy === "no") {
        const noA = getStudentNo(a);
        const noB = getStudentNo(b);
        if (noA !== noB) return noA - noB;
        const nameA = getStudentField(a, ["ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อ", "Name"]);
        const nameB = getStudentField(b, ["ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อ", "Name"]);
        return nameA.localeCompare(nameB, "th-TH");
      }
      if (sortBy === "score_desc") {
        const diff = parseScore(b, totalMax).earned - parseScore(a, totalMax).earned;
        if (diff !== 0) return diff;
        return getStudentNo(a) - getStudentNo(b);
      }
      if (sortBy === "score_asc") {
        const diff = parseScore(a, totalMax).earned - parseScore(b, totalMax).earned;
        if (diff !== 0) return diff;
        return getStudentNo(a) - getStudentNo(b);
      }
      // sortBy === "time"
      const tA = getStudentField(a, ["ประทับเวลา", "timestamp", "time"]);
      const tB = getStudentField(b, ["ประทับเวลา", "timestamp", "time"]);
      return tB.localeCompare(tA);
    });
  };

  const sortedStudents = sortStudentList(filteredStudents);

  const embedUrl = exam.sheet_url?.replace(/\/edit.*$/, "/preview") || exam.sheet_url;

  // เปิดหน้าต่างตรวจและให้คะแนนนักเรียน
  const handleOpenGrading = (student: any) => {
    setGradingStudent(student);
    const parsed = parseScore(student, totalMax);
    setNewScoreInput(String(parsed.earned));
    setGradeSuccessMsg("");
    setGradeErrorMsg("");
  };

  // ดึงคำตอบรายข้อของนักเรียน
  const getStudentQuestionAnswers = (s: any) => {
    if (!s) return [];
    const nonQuestionKeys = [
      "ประทับเวลา", "timestamp", "time",
      "คะแนน", "score", "total score", "points",
      "ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อ", "name",
      "ชั้น", "ห้องเรียน", "ห้อง", "ระดับชั้น", "room", "class",
      "เลขที่", "no.", "no", "number",
      "เลขประจำตัว", "id", "_rowindex"
    ];
    return Object.entries(s)
      .filter(([k]) => !nonQuestionKeys.some(nk => k.toLowerCase().trim() === nk || k.toLowerCase().includes(nk)))
      .map(([qTitle, answerVal]) => ({
        title: qTitle,
        answer: getSafeStr(answerVal)
      }));
  };

  // บันทึกคะแนนลงชีตและอัปเดต State ทันที
  const handleSaveScore = async () => {
    if (!gradingStudent) return;
    const earnedVal = parseFloat(newScoreInput);
    if (isNaN(earnedVal) || earnedVal < 0) {
      setGradeErrorMsg("กรุณากรอกคะแนนเป็นตัวเลขที่ถูกต้อง (ตั้งแต่ 0 ขึ้นไป)");
      return;
    }
    if (earnedVal > totalMax) {
      if (!confirm(`คะแนนที่กรอก (${earnedVal}) มากกว่าคะแนนเต็ม (${totalMax}) คุณครูต้องการบันทึกหรือไม่?`)) {
        return;
      }
    }

    setSavingScore(true);
    setGradeErrorMsg("");
    setGradeSuccessMsg("");

    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "update_score",
          sheetUrl: exam.sheet_url,
          rowIndex: gradingStudent._rowIndex,
          newScore: earnedVal,
          totalMax: totalMax
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "บันทึกคะแนนไม่สำเร็จ");

      // อัปเดตข้อมูลคะแนนใน State ทันทีแบบ Real-time
      const newScoreStr = `${earnedVal} / ${totalMax}`;
      const updatedStudents = rawStudents.map(s => {
        if (s._rowIndex === gradingStudent._rowIndex) {
          return { ...s, "คะแนน": newScoreStr, "Score": newScoreStr };
        }
        return s;
      });
      setData((prev: any) => ({ ...prev, students: updatedStudents }));
      setGradeSuccessMsg("✅ บันทึกคะแนนลงในระบบและ Google Sheets เรียบร้อยแล้ว!");
      setTimeout(() => {
        setGradingStudent(null);
        setGradeSuccessMsg("");
      }, 900);
    } catch (err: any) {
      setGradeErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกคะแนน");
    } finally {
      setSavingScore(false);
    }
  };

  // ตารางแสดงรายชื่อนักเรียน
  const renderStudentTable = (list: any[]) => (
    <div style={{overflowX: "auto"}}>
      <table style={{width: "100%", borderCollapse: "collapse", fontSize: 13}}>
        <thead>
          <tr style={{background: "var(--gray-50)", borderBottom: "2px solid var(--gray-200)"}}>
            <th style={{padding: "10px 12px", textAlign: "left", width: 45}}>#</th>
            <th style={{padding: "10px 12px", textAlign: "center", width: 75}}>เลขที่</th>
            <th style={{padding: "10px 12px", textAlign: "left"}}>ชื่อ-นามสกุล</th>
            <th style={{padding: "10px 12px", textAlign: "center", width: 85}}>ห้อง</th>
            <th style={{padding: "10px 12px", textAlign: "center", width: 110}}>คะแนน</th>
            <th style={{padding: "10px 12px", textAlign: "center", width: 110}}>ผลประเมิน</th>
            <th style={{padding: "10px 12px", textAlign: "left", width: 150}}>วัน-เวลาส่ง</th>
            <th style={{padding: "10px 12px", textAlign: "center", width: 130}}>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s, idx) => {
            const parsed = parseScore(s, totalMax);
            const studentNo = getStudentNo(s);
            const studentRoom = getStudentRoom(s);
            const studentName = getStudentField(s, ["ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อ", "Name"]) || "-";
            const timeStr = getStudentField(s, ["ประทับเวลา", "Timestamp", "time"]) || "-";

            return (
              <tr key={idx} style={{borderBottom: "1px solid var(--gray-100)"}}>
                <td style={{padding: "10px 12px", color: "var(--gray-500)"}}>{idx + 1}</td>
                <td style={{padding: "10px 12px", textAlign: "center"}}>
                  <span style={{
                    display: "inline-block",
                    minWidth: 26,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: "var(--amber-100)",
                    color: "var(--amber-800)",
                    border: "1px solid var(--amber-200)",
                    fontWeight: 700,
                    fontSize: 12
                  }}>
                    {studentNo !== 9999 ? studentNo : "-"}
                  </span>
                </td>
                <td style={{padding: "10px 12px", fontWeight: 600, color: "var(--gray-900)"}}>
                  {studentName}
                </td>
                <td style={{padding: "10px 12px", textAlign: "center"}}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: "#F1F5F9",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: 12
                  }}>
                    {studentRoom}
                  </span>
                </td>
                <td style={{
                  padding: "10px 12px",
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: 14,
                  color: parsed.isPass ? "#059669" : "#DC2626"
                }}>
                  {parsed.str}
                </td>
                <td style={{padding: "10px 12px", textAlign: "center"}}>
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    background: parsed.isPass ? "#DEF7EC" : "#FDE8E8",
                    color: parsed.isPass ? "#03543F" : "#9B1C1C"
                  }}>
                    {parsed.isPass ? "✅ ผ่าน" : "❌ ปรับปรุง"}
                  </span>
                </td>
                <td style={{padding: "10px 12px", color: "var(--gray-600)", fontSize: 12}}>
                  {timeStr}
                </td>
                <td style={{padding: "10px 12px", textAlign: "center"}}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      padding: "4px 10px",
                      fontSize: "12px",
                      fontWeight: 700,
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
                      color: "white",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(37,99,235,0.2)"
                    }}
                    onClick={() => handleOpenGrading(s)}
                    title="คลิกเพื่อตรวจคำตอบและกรอกคะแนนโดยตรง"
                  >
                    ✏️ ตรวจ/ให้คะแนน
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

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

        <div style={{display: "flex", alignItems: "center", gap: 14}}>
          {isSchoolUser ? (
            <img
              src="/school-logo.png"
              alt="ตราโรงเรียนวังหลวงพิทยาสรรพ์"
              style={{
                width: 48,
                height: 48,
                objectFit: "contain",
                filter: "drop-shadow(0 2px 6px rgba(245,158,11,.35))"
              }}
            />
          ) : (
            <div style={{
              background: "var(--crimson-light)",
              color: "var(--crimson)",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              📊
            </div>
          )}
          <div style={{flex: 1}}>
            {isSchoolUser && (
              <div style={{fontSize: 12, fontWeight: 700, color: "var(--crimson)", display: "flex", alignItems: "center", gap: 6, marginBottom: 2}}>
                <span>🏫 โรงเรียนวังหลวงพิทยาสรรพ์</span>
                <span style={{background: "var(--amber-100)", color: "var(--amber-800)", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800}}>ว.พ.</span>
              </div>
            )}
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
            { id: "students", label: "👥 รายชื่อและคะแนนรายคน", count: rawStudents.length },
            { id: "sheet", label: "📑 แผ่นงาน Google Sheets ตัวจริง", count: null }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === t.id ? "3px solid var(--crimson)" : "3px solid transparent",
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? "var(--crimson)" : "var(--gray-600)",
                cursor: "pointer",
                transition: "all .2s"
              }}>
              {t.label} {t.count !== null && <span style={{
                background: activeTab === t.id ? "var(--crimson)" : "var(--gray-200)",
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

      {/* Alert Banner for Subjective/Essay / Ungraded questions */}
      {data?.hasManualGrading && (
        <div style={{
          background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
          border: "1.5px solid #F59E0B",
          borderRadius: "var(--radius-lg)",
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          boxShadow: "0 2px 8px rgba(245, 158, 11, 0.15)"
        }}>
          <div style={{display: "flex", alignItems: "flex-start", gap: 12}}>
            <span style={{fontSize: 24, lineHeight: 1}}>🔔</span>
            <div>
              <div style={{fontSize: 14, fontWeight: 700, color: "#92400E", marginBottom: 2}}>
                แบบทดสอบนี้มีข้อสอบอัตนัยหรือเติมคำที่ต้องตรวจให้คะแนน
              </div>
              <div style={{fontSize: 12.5, color: "#B45309"}}>
                คุณครูสามารถกดปุ่ม <strong>"✏️ ตรวจ/ให้คะแนน"</strong> ในแท็บรายชื่อนักเรียน เพื่ออ่านคำตอบและกรอกคะแนนในระบบได้โดยตรง หรือเปิดตรวจผ่าน Google Forms
              </div>
            </div>
          </div>
          <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            {exam.edit_url && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => window.open(exam.edit_url, "_blank")}
                style={{
                  background: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 12.5,
                  padding: "8px 14px",
                  borderRadius: "8px"
                }}>
                ✏️ เปิดตรวจใน Google Forms
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setActiveTab("students")}
              style={{
                background: "white",
                borderColor: "#F59E0B",
                color: "#92400E",
                fontWeight: 700,
                fontSize: 12.5,
                padding: "8px 14px",
                borderRadius: "8px"
              }}>
              👥 ไปที่รายชื่อนักเรียนเพื่อกรอกคะแนน
            </button>
          </div>
        </div>
      )}

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
                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid var(--crimson)", background: "linear-gradient(135deg, #FFFFFF 0%, #FEF2F2 100%)"}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--gray-600)"}}>👥 ส่งข้อสอบแล้ว</span>
                    <span style={{fontSize: 20}}>📝</span>
                  </div>
                  <div style={{fontSize: 26, fontWeight: 800, color: "var(--crimson)"}}>
                    {stats?.totalStudents || `${rawStudents.length} คน`}
                  </div>
                  <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                    จากคะแนนเต็ม {stats?.totalScore}
                  </div>
                </div>

                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid var(--amber)", background: "linear-gradient(135deg, #FFFFFF 0%, #FFFBEB 100%)"}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--gray-600)"}}>📈 คะแนนเฉลี่ย (Mean)</span>
                    <span style={{fontSize: 20}}>🎯</span>
                  </div>
                  <div style={{fontSize: 26, fontWeight: 800, color: "var(--amber-800)"}}>
                    {stats?.average || "-"}
                  </div>
                  <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                    เกณฑ์ผ่าน ≥ {passThresh} คะแนน (50%)
                  </div>
                </div>

                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid var(--amber-dark)", background: "linear-gradient(135deg, #FFFFFF 0%, #FEF3C7 100%)"}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--gray-600)"}}>🏆 สูงสุด / ต่ำสุด</span>
                    <span style={{fontSize: 20}}>🥇</span>
                  </div>
                  <div style={{fontSize: 22, fontWeight: 800, color: "var(--amber-900)"}}>
                    {stats?.maxScore || "-"} / {stats?.minScore || "-"}
                  </div>
                  <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                    คะแนนสูงสุด / ต่ำสุด
                  </div>
                </div>

                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #059669", background: "linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)"}}>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                    <span style={{fontSize: 13, fontWeight: 600, color: "var(--gray-600)"}}>📊 อัตราการสอบผ่าน</span>
                    <span style={{fontSize: 20}}>🏅</span>
                  </div>
                  <div style={{fontSize: 26, fontWeight: 800, color: "#047857"}}>
                    {stats?.passRate || "0%"}
                  </div>
                  <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                    ผ่าน {stats?.passCount} • ปรับปรุง {stats?.failCount}
                  </div>
                </div>
              </div>

              {/* Classroom breakdown table */}
              {stats?.rooms && stats.rooms.length > 0 && (
                <div className="card" style={{marginBottom: 20}}>
                  <div className="card-title" style={{display: "flex", alignItems: "center", gap: 8}}>
                    <span>🏫 สรุปผลแยกตามห้องเรียน</span>
                  </div>
                  <div className="card-sub">ติดตามจำนวนนักเรียนและคะแนนเฉลี่ยในแต่ละห้องเรียน</div>
                  <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 14}}>
                    {stats.rooms.map((rm: any, idx: number) => {
                      const countNum = parseInt(rm.count) || 0;
                      const hasSubmitted = countNum > 0;
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
              <div className="card-sub">คำตอบและคะแนนของนักเรียนทั้งหมด {rawStudents.length} คน (แบ่งตามห้องและเรียงเลขที่)</div>
            </div>
            {/* Search & Sort Controls */}
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
                  outline: "none",
                  width: 170
                }}
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--gray-200)",
                  fontSize: 13,
                  background: "white",
                  cursor: "pointer"
                }}>
                <option value="no">🔢 เรียงตามเลขที่ (1, 2, 3...)</option>
                <option value="score_desc">🏆 เรียงตามคะแนน (มาก → น้อย)</option>
                <option value="score_asc">📉 เรียงตามคะแนน (น้อย → มาก)</option>
                <option value="time">🕒 เรียงตามเวลาส่ง (ล่าสุด)</option>
              </select>
            </div>
          </div>

          {/* Quick Room Filter Pills */}
          {roomList.length > 0 && (
            <div style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 10,
              marginBottom: 16,
              borderBottom: "1px dashed var(--gray-200)"
            }}>
              <button
                type="button"
                onClick={() => setRoomFilter("all")}
                style={{
                  padding: "7px 14px",
                  borderRadius: 20,
                  border: roomFilter === "all" ? "2px solid var(--crimson)" : "1px solid var(--gray-200)",
                  background: roomFilter === "all" ? "var(--crimson-light)" : "white",
                  color: roomFilter === "all" ? "var(--crimson)" : "var(--gray-700)",
                  fontWeight: roomFilter === "all" ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap"
                }}>
                🏫 ทุกห้องเรียน
                <span style={{
                  background: roomFilter === "all" ? "var(--crimson)" : "var(--gray-100)",
                  color: roomFilter === "all" ? "white" : "var(--gray-600)",
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: 11
                }}>
                  {rawStudents.length}
                </span>
              </button>

              {roomList.map(rm => {
                const count = rawStudents.filter(s => getStudentRoom(s) === rm || getStudentRoom(s).includes(rm)).length;
                const isSelected = roomFilter === rm;
                return (
                  <button
                    key={rm}
                    type="button"
                    onClick={() => setRoomFilter(rm)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 20,
                      border: isSelected ? "2px solid var(--crimson)" : "1px solid var(--gray-200)",
                      background: isSelected ? "var(--crimson-light)" : "white",
                      color: isSelected ? "var(--crimson)" : "var(--gray-700)",
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap"
                    }}>
                    🚪 {rm}
                    <span style={{
                      background: isSelected ? "var(--crimson)" : "var(--gray-100)",
                      color: isSelected ? "white" : "var(--gray-600)",
                      padding: "1px 7px",
                      borderRadius: 10,
                      fontSize: 11
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {filteredStudents.length === 0 ? (
            <div style={{textAlign: "center", padding: "40px 20px", color: "var(--gray-500)"}}>
              {rawStudents.length === 0 ? "⏳ ยังไม่มีนักเรียนส่งข้อสอบ" : "ไม่พบข้อมูลนักเรียนตามคำค้นหา"}
            </div>
          ) : roomFilter === "all" && roomList.length > 1 ? (
            /* ถ้าเลือกทุกห้อง และมีหลายห้อง ให้จัดกลุ่มแสดงแยกห้องพร้อมเรียงเลขที่ */
            <div>
              {roomList.map(rm => {
                const roomStudents = sortStudentList(
                  filteredStudents.filter(s => getStudentRoom(s) === rm || getStudentRoom(s).includes(rm))
                );
                if (roomStudents.length === 0) return null;
                const scores = roomStudents.map(s => parseScore(s, totalMax).earned);
                const avg = (scores.reduce((a, b) => a + b, 0) / roomStudents.length).toFixed(1);
                const pass = roomStudents.filter(s => parseScore(s, totalMax).isPass).length;

                return (
                  <div key={rm} style={{marginBottom: 20, border: "1px solid var(--gray-200)", borderRadius: "var(--radius)", overflow: "hidden"}}>
                    <div style={{
                      background: "#F8FAFC",
                      padding: "10px 16px",
                      borderBottom: "1px solid var(--gray-200)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8
                    }}>
                      <div style={{fontWeight: 700, fontSize: 14, color: "var(--crimson)", display: "flex", alignItems: "center", gap: 8}}>
                        <span>🏫 {rm}</span>
                        <span style={{fontSize: 12, fontWeight: 500, color: "var(--crimson)", background: "var(--crimson-light)", padding: "2px 8px", borderRadius: 10}}>
                          {roomStudents.length} คน (เรียงตามเลขที่)
                        </span>
                      </div>
                      <div style={{fontSize: 12, color: "var(--gray-600)", display: "flex", gap: 12}}>
                        <span>เฉลี่ย: <b style={{color: "#0F9D58"}}>{avg}</b> / {totalMax}</span>
                        <span style={{color: "#059669"}}>ผ่าน: <b>{pass}</b></span>
                        <span style={{color: "#DC2626"}}>ปรับปรุง: <b>{roomStudents.length - pass}</b></span>
                      </div>
                    </div>
                    {renderStudentTable(roomStudents)}
                  </div>
                );
              })}

              {/* นักเรียนที่ไม่ได้ระบุห้อง (ถ้ามี) */}
              {(() => {
                const unassigned = sortStudentList(
                  filteredStudents.filter(s => {
                    const r = getStudentRoom(s);
                    return !roomList.some(rm => r === rm || r.includes(rm));
                  })
                );
                if (unassigned.length === 0) return null;
                return (
                  <div style={{marginBottom: 20, border: "1px solid var(--gray-200)", borderRadius: "var(--radius)", overflow: "hidden"}}>
                    <div style={{background: "#F8FAFC", padding: "10px 16px", borderBottom: "1px solid var(--gray-200)", fontWeight: 700, fontSize: 14, color: "var(--gray-700)"}}>
                      📌 อื่นๆ / ไม่ระบุห้อง ({unassigned.length} คน)
                    </div>
                    {renderStudentTable(unassigned)}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* ถ้าเลือกห้องเจาะจง หรือมีห้องเดียว แสดงตารางเดี่ยว */
            renderStudentTable(sortedStudents)
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

      {/* In-App Grading Modal */}
      {gradingStudent && (
        <div className="loading-overlay" style={{background: "rgba(15, 23, 42, 0.75)", zIndex: 1000, padding: 16}}>
          <div style={{
            background: "white",
            borderRadius: "20px",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
            animation: "popInModal .25s ease",
            overflow: "hidden"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "18px 24px",
              borderBottom: "1.5px solid var(--gray-200)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "linear-gradient(135deg, #FEF2F2 0%, #FFFBEB 100%)"
            }}>
              <div style={{display: "flex", alignItems: "center", gap: 10}}>
                <span style={{fontSize: 24}}>✏️</span>
                <div>
                  <h3 style={{margin: 0, fontSize: 17, fontWeight: 700, color: "var(--gray-900)"}}>
                    ตรวจและบันทึกคะแนนรายบุคคล
                  </h3>
                  <div style={{fontSize: 12.5, color: "var(--gray-600)", marginTop: 2}}>
                    บันทึกคะแนนตรงเข้า Google Sheets อัตโนมัติ โดยไม่ต้องเปิดไฟล์ชีต
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !savingScore && setGradingStudent(null)}
                style={{background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--gray-500)", padding: 4}}
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{padding: "20px 24px", overflowY: "auto", flex: 1}}>
              {/* Student Info Card */}
              <div style={{
                background: "var(--gray-50)",
                border: "1px solid var(--gray-200)",
                borderRadius: "12px",
                padding: "12px 16px",
                marginBottom: 18,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 8
              }}>
                <div>
                  <div style={{fontSize: 11, color: "var(--gray-500)", fontWeight: 600}}>ชื่อ-นามสกุล</div>
                  <div style={{fontSize: 14, fontWeight: 700, color: "var(--gray-900)"}}>
                    {getStudentField(gradingStudent, ["ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อ", "Name"]) || "-"}
                  </div>
                </div>
                <div>
                  <div style={{fontSize: 11, color: "var(--gray-500)", fontWeight: 600}}>ชั้น / ห้อง</div>
                  <div style={{fontSize: 14, fontWeight: 700, color: "var(--crimson)"}}>
                    {getStudentRoom(gradingStudent)}
                  </div>
                </div>
                <div>
                  <div style={{fontSize: 11, color: "var(--gray-500)", fontWeight: 600}}>เลขที่</div>
                  <div style={{fontSize: 14, fontWeight: 700, color: "#D97706"}}>
                    {getStudentNo(gradingStudent) !== 9999 ? `เลขที่ ${getStudentNo(gradingStudent)}` : "-"}
                  </div>
                </div>
                <div>
                  <div style={{fontSize: 11, color: "var(--gray-500)", fontWeight: 600}}>คะแนนเดิมในระบบ</div>
                  <div style={{fontSize: 14, fontWeight: 700, color: "#059669"}}>
                    {parseScore(gradingStudent, totalMax).str}
                  </div>
                </div>
              </div>

              {/* Question Answers from Student */}
              <div style={{marginBottom: 20}}>
                <div style={{fontSize: 13, fontWeight: 700, color: "var(--gray-800)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6}}>
                  <span>📝</span>
                  <span>คำตอบที่นักเรียนส่งมา ({getStudentQuestionAnswers(gradingStudent).length} ข้อ):</span>
                </div>
                <div style={{display: "flex", flexDirection: "column", gap: 10, maxHeight: 240, overflowY: "auto", paddingRight: 4}}>
                  {getStudentQuestionAnswers(gradingStudent).length === 0 ? (
                    <div style={{fontSize: 12, color: "var(--gray-500)", fontStyle: "italic", textAlign: "center", padding: 12}}>
                      ไม่พบคอลัมน์คำตอบเฉพาะข้อในชีต
                    </div>
                  ) : (
                    getStudentQuestionAnswers(gradingStudent).map((qa, idx) => (
                      <div key={idx} style={{background: "white", border: "1px solid var(--gray-200)", borderRadius: "8px", padding: "10px 12px"}}>
                        <div style={{fontSize: 12.5, fontWeight: 600, color: "var(--gray-800)", marginBottom: 4}}>
                          <span style={{color: "var(--crimson)", marginRight: 6}}>ข้อ {idx + 1}:</span>
                          {qa.title}
                        </div>
                        <div style={{
                          fontSize: 13,
                          padding: "6px 10px",
                          background: qa.answer ? "#F8FAFC" : "#FEF2F2",
                          color: qa.answer ? "var(--gray-900)" : "#DC2626",
                          borderRadius: "6px",
                          borderLeft: "3px solid " + (qa.answer ? "var(--crimson)" : "#DC2626"),
                          whiteSpace: "pre-wrap"
                        }}>
                          {qa.answer || "(ไม่ได้ตอบ / ว่างเปล่า)"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Score Input Box */}
              <div style={{background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: "14px", padding: "16px 20px", marginBottom: 14}}>
                <label style={{display: "block", fontSize: 13, fontWeight: 700, color: "#1E3A8A", marginBottom: 8}}>
                  🎯 กรอกคะแนนใหม่ที่ต้องการบันทึก (คะแนนเต็ม {totalMax} คะแนน):
                </label>
                <div style={{display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap"}}>
                  <input
                    type="number"
                    min="0"
                    max={totalMax}
                    step="0.5"
                    value={newScoreInput}
                    onChange={e => setNewScoreInput(e.target.value)}
                    style={{
                      width: 100,
                      fontSize: 20,
                      fontWeight: 800,
                      textAlign: "center",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "2px solid #2563EB",
                      color: "#1E3A8A",
                      outline: "none",
                      background: "white"
                    }}
                    disabled={savingScore}
                  />
                  <span style={{fontSize: 16, fontWeight: 700, color: "#1E3A8A"}}>
                    / {totalMax} คะแนน
                  </span>
                  <div style={{display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap"}}>
                    {[0, Math.ceil(totalMax * 0.5), totalMax].map(quickScore => (
                      <button
                        key={quickScore}
                        type="button"
                        onClick={() => setNewScoreInput(String(quickScore))}
                        className="btn btn-secondary btn-sm"
                        style={{padding: "4px 8px", fontSize: 11}}
                        disabled={savingScore}
                      >
                        {quickScore === 0 ? "0 คะแนน" : quickScore === totalMax ? `เต็ม (${totalMax})` : `ผ่าน (${quickScore})`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {gradeErrorMsg && (
                <div style={{padding: "8px 12px", background: "var(--red-light)", color: "var(--red)", borderRadius: "8px", fontSize: 13, marginBottom: 10}}>
                  ⚠️ {gradeErrorMsg}
                </div>
              )}

              {gradeSuccessMsg && (
                <div style={{padding: "8px 12px", background: "var(--green-light)", color: "var(--green)", borderRadius: "8px", fontSize: 13, fontWeight: 600, marginBottom: 10}}>
                  {gradeSuccessMsg}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{padding: "14px 24px", borderTop: "1px solid var(--gray-200)", display: "flex", justifyContent: "flex-end", gap: 10, background: "var(--gray-50)"}}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setGradingStudent(null)}
                disabled={savingScore}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSaveScore}
                disabled={savingScore}
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  color: "white",
                  padding: "10px 24px",
                  fontWeight: 700,
                  fontSize: 14,
                  boxShadow: "0 2px 8px rgba(5,150,105,0.3)"
                }}
              >
                {savingScore ? "⏳ กำลังบันทึกคะแนนลงชีต..." : "💾 บันทึกคะแนน"}
              </button>
            </div>
          </div>
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
    return <ExamScoreDashboard exam={viewingExam} onBack={() => setViewingExam(null)} user={user} />;
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
        background: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 55%, #B91C1C 100%)",
        borderBottom: "2.5px solid #F59E0B",
        borderRadius: "var(--radius-lg)",
        padding: "24px 28px",
        color: "white",
        marginBottom: 20,
        boxShadow: "0 4px 18px rgba(127,29,29,.22)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16
      }}>
        <div>
          <div style={{display:"flex", alignItems:"center", gap:10, marginBottom: 6}}>
            <div style={{background:"rgba(255,255,255,.18)", borderRadius:10, padding:"6px 8px", display:"flex", alignItems:"center", justifyContent:"center"}}>
              <SheetIcon />
            </div>
            <h2 style={{fontFamily:"'Prompt',sans-serif", fontSize:22, fontWeight:700, margin:0}}>
              📊 ผลการสอบ & ชีตคะแนน โรงเรียนวังหลวงพิทยาสรรพ์
            </h2>
          </div>
          <p style={{fontSize:14, opacity:.9, margin:0, maxWidth:640}}>
            ชีตคะแนนและคำตอบของนักเรียนจะซิงค์อัตโนมัติแบบเรียลไทม์ คุณครูสามารถเลือกดูตามระดับชั้นและห้องเรียนจากแถบเมนูด้านซ้ายได้ทันที
          </p>
        </div>
        <div style={{display:"flex", gap:12, alignItems:"center"}}>
          <div style={{background:"rgba(255,255,255,.16)", border:"1px solid rgba(255,255,255,.25)", borderRadius:12, padding:"10px 18px", textAlign:"center"}}>
            <div style={{fontSize:22, fontWeight:800, color:"#FEF3C7"}}>{filtered.length}</div>
            <div style={{fontSize:11, opacity:.9}}>แสดง {filtered.length}/{history.length} ชีต</div>
          </div>
          <button className="btn btn-sm" onClick={fetchHistory} style={{background:"white", color:"var(--crimson)", fontWeight:700, boxShadow:"0 2px 6px rgba(0,0,0,0.1)"}}>
            <RefreshIcon /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Grade & Room Quick Filter Bar */}
      <div className="card" style={{padding: "16px 20px", marginBottom: 16}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom: selectedGrade !== "all" ? 12 : 0}}>
          <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
            <span style={{fontSize:13, fontWeight:700, color:"var(--gray-800)"}}>🏫 ระดับชั้น:</span>
            {gradeList.map(g => (
              <button
                key={g.id}
                type="button"
                className="btn btn-sm"
                style={{
                  fontSize: 12,
                  padding: "5px 14px",
                  borderRadius: 20,
                  background: selectedGrade === g.id ? "var(--crimson)" : "var(--gray-100)",
                  color: selectedGrade === g.id ? "white" : "var(--gray-700)",
                  border: selectedGrade === g.id ? "1.5px solid var(--crimson-dark)" : "1px solid var(--gray-200)",
                  fontWeight: selectedGrade === g.id ? 700 : 500
                }}
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
            <span style={{fontSize:12, fontWeight:700, color:"var(--crimson)"}}>📍 ห้องเรียน:</span>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                fontSize: 11.5,
                padding: "3px 12px",
                borderRadius: 16,
                background: selectedRoom === "all" ? "var(--crimson)" : "var(--gray-100)",
                color: selectedRoom === "all" ? "white" : "var(--gray-700)",
                border: selectedRoom === "all" ? "1px solid var(--crimson)" : "1px solid var(--gray-200)",
                fontWeight: selectedRoom === "all" ? 700 : 500
              }}
              onClick={() => setSelectedRoom("all")}>
              ทุกห้อง ({selectedGrade.replace("m", "ม.")})
            </button>
            {getRoomsForGrade(selectedGrade).map(r => (
              <button
                key={r}
                type="button"
                className="btn btn-sm"
                style={{
                  fontSize: 11.5,
                  padding: "3px 12px",
                  borderRadius: 16,
                  background: selectedRoom === r ? "var(--crimson)" : "var(--gray-100)",
                  color: selectedRoom === r ? "white" : "var(--gray-700)",
                  border: selectedRoom === r ? "1px solid var(--crimson)" : "1px solid var(--gray-200)",
                  fontWeight: selectedRoom === r ? 700 : 500
                }}
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
            <div key={item.id} className="card" style={{margin:0, borderLeft:"5px solid var(--crimson)"}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12}}>
                <div style={{flex:1, minWidth:260}}>
                  <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap"}}>
                    <span style={{fontSize:12, fontWeight:700, color:"var(--crimson)", background:"var(--crimson-light)", padding:"2px 8px", borderRadius:20}}>
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
                          background:"linear-gradient(135deg, #991B1B 0%, #B91C1C 100%)",
                          color:"white",
                          fontWeight:700,
                          fontSize:13.5,
                          padding:"9px 18px",
                          boxShadow:"0 2px 8px rgba(153,27,27,.25)"
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
                      <a href={item.edit_url} target="_blank" rel="noreferrer" style={{color:"var(--crimson)", textDecoration:"underline"}}>
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
      <div style={{textAlign:"center", margin:"28px 0 16px"}}>
        <button
          type="button"
          className="btn-vibrant-new"
          onClick={onReset}
          title="คลิกเพื่อเริ่มสร้างแบบทดสอบชุดใหม่ทันที"
        >
          <span>✨ 🚀</span>
          <span>สร้างข้อสอบชุดใหม่</span>
          <span style={{fontSize:13, opacity:.9, background:"rgba(255,255,255,.25)", padding:"3px 10px", borderRadius:20}}>เริ่มใหม่</span>
        </button>
      </div>

      {userRole !== "admin" && (
        <div style={{marginTop:16,background:"linear-gradient(135deg, #7F1D1D 0%, #991B1B 50%, #B91C1C 100%)",border:"1.5px solid #F59E0B",borderRadius:16,padding:"24px",color:"white",textAlign:"center",boxShadow:"0 4px 16px rgba(127,29,29,.22)"}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:6,color:"#FEF3C7"}}>🔥 ปลดล็อก Pro</div>
          <div style={{fontSize:13,opacity:.9,marginBottom:4}}>อ่านไฟล์ข้อสอบวันนี้ <strong>{usageCount}/{dailyLimit??10}</strong> ครั้ง</div>
          <div style={{fontSize:13,opacity:.8,marginBottom:16}}>อัปเกรด → สร้างได้ไม่จำกัด • ไม่มีวันหมดอายุ</div>
          <button className="btn" style={{background:"white",color:"var(--crimson)",fontWeight:700,borderRadius:20,padding:"10px 28px",fontSize:14}}>
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
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  const FORM_CREATION_STEPS = [
    { label: "จัดเตรียมและตรวจสอบโครงสร้างข้อสอบ", icon: "📋" },
    { label: "เชื่อมต่อไปยัง Google Apps Script และ Google Drive", icon: "📡" },
    { label: "สร้างฟอร์มแบบทดสอบชุดใหม่ใน Google Form", icon: "📝" },
    { label: "บรรจุคำถาม ตัวเลือก พร้อมตั้งค่าเฉลยอัตโนมัติ", icon: "🎯" },
    { label: "บันทึกข้อมูลและสร้างลิงก์สำหรับส่งให้นักเรียน", icon: "✨" },
  ];

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
    setLoading(true);
    setLoadingStepIndex(0);
    setSubmitError("");

    let curStep = 0;
    const iv = setInterval(() => {
      curStep++;
      if (curStep <= 3) {
        setLoadingStepIndex(curStep);
      }
    }, 2200);

    try {
      // Deduplicate question text and choices to prevent Google Forms API rejection
      const seen = new Map<string, number>();
      const cleanedQuestions = questions.map((q: any) => {
        const base = q.text.trim() || "คำถาม";
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const text = count > 0 ? `${base} (${count + 1})` : base;
        const qType = q.type || "multiple_choice";
        const pts = typeof q.points === "number" && q.points >= 0 ? q.points : 1;

        if (qType === "short_answer" || qType === "paragraph") {
          return {
            ...q,
            type: qType,
            points: pts,
            text,
            choices: [],
            answer: -1,
            answerText: q.answerText || ""
          };
        }

        // Deduplicate choices, tracking new index of the correct answer
        const choiceKey = (c: string, idx: number) => c.trim() || `ตัวเลือก ${idx + 1}`;
        const keyToNewIdx = new Map<string, number>();
        const uniqueChoices: string[] = [];
        (q.choices || []).forEach((c: string, idx: number) => {
          const k = choiceKey(c, idx);
          if (!keyToNewIdx.has(k)) { keyToNewIdx.set(k, uniqueChoices.length); uniqueChoices.push(c); }
        });
        const answerKey = choiceKey((q.choices || [])[q.answer] ?? "", q.answer);
        const newAnswer = keyToNewIdx.get(answerKey) ?? 0;
        return { ...q, type: "multiple_choice", points: pts, text, choices: uniqueChoices, answer: newAnswer };
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
      if (!data.success) throw new Error(data.error);

      // Finished successfully!
      setLoadingStepIndex(4);
      await new Promise(r => setTimeout(r, 600));
      clearInterval(iv);
      setLoading(false);

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
      clearInterval(iv);
      setLoading(false);
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

  const isSchoolUser = user?.is_google || (user?.email && user.email.toLowerCase().endsWith("@wangluangpitt.ac.th")) || (typeof user?.key === "string" && user.key.toLowerCase().endsWith("@wangluangpitt.ac.th")) || user?.role === "admin";

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-modal">
              <div className="loading-animation-container">
                <div className="pulse-ring" />
                <div className="orbital-spinner" />
                <div className="loading-center-icon">🚀</div>
              </div>
              <div className="loading-title">กำลังสร้าง Google Form</div>
              <div className="loading-desc">
                ระบบกำลังจัดเตรียมข้อสอบ {questions.length} ข้อ และสร้างแบบทดสอบลงใน Google Drive ของคุณครู
              </div>

              <div className="loading-steps">
                {FORM_CREATION_STEPS.map((s, idx) => {
                  const isDone = idx < loadingStepIndex;
                  const isCurrent = idx === loadingStepIndex;
                  return (
                    <div key={s.label} className={`loading-step-item ${isDone ? "done" : isCurrent ? "active" : "pending"}`}>
                      <div className="loading-step-icon">
                        {isDone ? "✓" : isCurrent ? "⏳" : "•"}
                      </div>
                      <div style={{flex:1}}>{s.label}</div>
                      {isCurrent && <span className="loading-step-badge active">กำลังทำ...</span>}
                      {isDone && <span className="loading-step-badge done">เรียบร้อย</span>}
                    </div>
                  );
                })}
              </div>

              <div className="loading-bar-wrapper">
                <div className="loading-bar-fill" style={{ width: `${Math.min(100, (loadingStepIndex + 1) * 20)}%` }} />
              </div>

              <div className="loading-note">
                <span>🔒</span>
                <span>ระบบกำลังทำงานอย่างปลอดภัย กรุณาอย่าปิดหรือรีเฟรชหน้าต่างนี้</span>
              </div>
            </div>
          </div>
        )}
        <div className="topbar">
          <div className="topbar-brand">
            {isSchoolUser ? (
              <img
                src="/school-logo.png"
                alt="ตราโรงเรียนวังหลวงพิทยาสรรพ์"
                style={{
                  height: 42,
                  width: "auto",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.3))"
                }}
              />
            ) : (
              <Logo />
            )}
            <div style={{lineHeight: 1.2}}>
              <div style={{
                fontFamily: "'Prompt', sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: "white",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}>
                {isSchoolUser ? "โรงเรียนวังหลวงพิทยาสรรพ์" : "FormAuto"}
                {isSchoolUser && (
                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    background: "rgba(245, 158, 11, 0.25)",
                    color: "#FEF3C7",
                    border: "1px solid rgba(245, 158, 11, 0.5)",
                    padding: "1px 8px",
                    borderRadius: 12,
                    letterSpacing: "0.5px"
                  }}>
                    ว.พ.
                  </span>
                )}
              </div>
              <div style={{fontSize: 11.5, color: "rgba(255, 255, 255, 0.85)", fontWeight: 400}}>
                {isSchoolUser ? "FormAuto • ระบบสร้างและวิเคราะห์ข้อสอบออนไลน์" : "ระบบสร้าง Google Form ข้อสอบอัตโนมัติ"}
              </div>
            </div>
          </div>
          <div className="topbar-user">
            {isSchoolUser ? (
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.18)",borderRadius:20,padding:"4px 12px",border:"1px solid rgba(255,255,255,.25)"}}>
                <span style={{fontSize:12,fontWeight:600,color:"#FEF3C7"}}>✨ ใช้งานไม่จำกัด</span>
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
            <span className={`role-badge ${user.role==="admin"?"role-admin":"role-user"}`}>
              {user.role==="admin" ? "👑 Admin" : isSchoolUser ? "🏫 คุณครู ว.พ." : "👤 User"}
            </span>
            <button className="btn btn-icon" onClick={handleLogout} title="ออกจากระบบ"><LogoutIcon /></button>
          </div>
        </div>

        <div className="main-layout">
          <div className="sidebar">
            {isSchoolUser && (
              <div style={{
                background: "linear-gradient(135deg, #FEF2F2 0%, #FFFBEB 100%)",
                border: "1px solid #FEE2E2",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 10
              }}>
                <img src="/school-logo.png" alt="Logo" style={{height: 36, width: "auto", objectFit: "contain"}} />
                <div style={{fontSize: 12, lineHeight: 1.25}}>
                  <div style={{fontWeight: 700, color: "var(--crimson)"}}>วังหลวงพิทยาสรรพ์</div>
                  <div style={{color: "var(--gray-600)", fontSize: 11}}>สพม.หนองคาย</div>
                </div>
              </div>
            )}

            <button className={`sidebar-item ${tab==="create"?"active":""}`} onClick={() => { setTab("create"); }}>
              <FormIcon /> สร้างข้อสอบใหม่
            </button>

            <div style={{marginTop: 2, marginBottom: 4}}>
              <button
                className={`sidebar-item ${tab==="sheets"?"active":""}`}
                onClick={() => { setTab("sheets"); setSelectedGrade("all"); setSelectedRoom("all"); }}
                style={tab==="sheets"?{background:"var(--crimson-light)",color:"var(--crimson)",fontWeight:700}:{}}>
                <SheetIcon /> 📊 ผลการสอบ & ชีตคะแนน
              </button>

              {/* Classroom Sub-Menu in Sidebar */}
              <div style={{
                marginLeft: 10,
                paddingLeft: 8,
                borderLeft: "2.5px solid #FCA5A5",
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
                        background: isSelected ? "var(--crimson-light)" : "transparent",
                        color: isSelected ? "var(--crimson)" : "var(--gray-600)",
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
                      {isSelected && <span style={{fontSize: 9, color: "var(--crimson)"}}>●</span>}
                    </button>
                  );
                })}

                {/* Specific Room Dropdown inside Left Sidebar */}
                {selectedGrade !== "all" && (
                  <div style={{marginTop: 4, padding: "4px 2px"}}>
                    <div style={{fontSize: 10.5, fontWeight: 600, color: "var(--crimson)", marginBottom: 3}}>
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
                        border: "1.5px solid var(--crimson)",
                        fontSize: "11.5px",
                        background: "white",
                        color: "var(--crimson)",
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
            <div className="sidebar-footer">
              develop by พงศกร ดรโคตร์กอก
            </div>
          </div>

          <div className="content">
           {tab==="admin" && user.role==="admin" ? <AdminPanel adminKey={user.key} /> :
            tab==="sheets" ? <SheetsTab user={user} selectedGrade={selectedGrade} setSelectedGrade={setSelectedGrade} selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom} /> :
            tab==="history" ? <HistoryTab user={user} /> : (
              <>
                <div className="stepper">
                  {steps.map((s,i) => {
                    const isClickable = i < step;
                    return (
                      <div key={s} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:0}}>
                        <div
                          className={`step-item ${isClickable ? "step-clickable" : ""}`}
                          style={{display:"flex",alignItems:"center",gap:6,cursor:isClickable?"pointer":"default"}}
                          onClick={() => { if (isClickable) setStep(i); }}
                          title={isClickable ? `คลิกเพื่อย้อนกลับไป: ขั้นตอนที่ ${i+1} ${s}` : undefined}
                        >
                          <div className={`step-dot ${i<step?"done":i===step?"active":"pending"}`}>
                            {i<step?<CheckIcon />:i+1}
                          </div>
                          <span className={`step-label ${i<step?"done":i===step?"active":"pending"}`}>{s}</span>
                        </div>
                        {i<steps.length-1 && <div className={`step-line ${i<step?"done":""}`} style={{flex:1,margin:"0 6px"}}/>}
                      </div>
                    );
                  })}
                </div>

                {step > 0 && step < 4 && (
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,padding:"10px 16px",background:"white",borderRadius:"var(--radius)",border:"1px solid var(--gray-200)",boxShadow:"var(--shadow-sm)"}}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setStep(s => s - 1)}
                      style={{display:"inline-flex",alignItems:"center",gap:6,fontWeight:700,color:"var(--gray-700)"}}
                    >
                      ← ย้อนกลับไปขั้นตอนก่อนหน้า ({steps[step-1]})
                    </button>
                    <span style={{fontSize:13,color:"var(--gray-600)"}}>
                      ขั้นตอนที่ {step+1}: <strong>{steps[step]}</strong>
                    </span>
                  </div>
                )}

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
                    <div className="card-title" style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                      <span>🚀 พร้อมสร้าง Google Form</span>
                      <span className="badge badge-green" style={{fontSize:12,padding:"4px 10px"}}>ขั้นตอนสุดท้ายก่อนเริ่มสร้าง</span>
                    </div>
                    <div className="card-sub">กรุณาตรวจสอบข้อมูลภาพรวมของแบบทดสอบก่อนกดยืนยันสร้างฟอร์ม</div>
                    
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:12,marginBottom:24}}>
                      <div style={{padding:"14px 18px",background:"var(--gray-50)",borderRadius:"var(--radius-lg)",border:"1px solid var(--gray-200)"}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--crimson)",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                          <span>📄</span> ชื่อแบบทดสอบ
                        </div>
                        <div style={{fontSize:15,fontWeight:700,color:"var(--gray-900)"}}>{formTitle || "(ไม่ได้ระบุ)"}</div>
                      </div>

                      {formDesc ? (
                        <div style={{padding:"14px 18px",background:"var(--gray-50)",borderRadius:"var(--radius-lg)",border:"1px solid var(--gray-200)"}}>
                          <div style={{fontSize:12,fontWeight:700,color:"var(--gray-600)",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                            <span>📝</span> คำอธิบายแบบทดสอบ
                          </div>
                          <div style={{fontSize:14,color:"var(--gray-800)"}}>{formDesc}</div>
                        </div>
                      ) : (
                        <div style={{padding:"14px 18px",background:"var(--gray-50)",borderRadius:"var(--radius-lg)",border:"1px solid var(--gray-200)"}}>
                          <div style={{fontSize:12,fontWeight:700,color:"var(--gray-600)",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                            <span>🎯</span> ระดับชั้น / ห้องเป้าหมาย
                          </div>
                          <div style={{fontSize:14,color:"var(--gray-800)"}}>
                            {targetGrade ? targetGrade : "ทุกระดับชั้น"} {targetRooms.length > 0 && `(${targetRooms.join(", ")})`}
                          </div>
                        </div>
                      )}

                      {(() => {
                        const sumPts = questions.reduce((s: number, q: any) => s + (typeof q.points === "number" && q.points >= 0 ? q.points : 1), 0);
                        const mc = questions.filter((q: any) => !q.type || q.type === "multiple_choice").length;
                        const sa = questions.filter((q: any) => q.type === "short_answer").length;
                        const pa = questions.filter((q: any) => q.type === "paragraph").length;
                        const hasManual = sa > 0 || pa > 0;

                        return (
                          <div style={{padding:"14px 18px",background:"var(--gray-50)",borderRadius:"var(--radius-lg)",border:"1px solid var(--gray-200)"}}>
                            <div style={{fontSize:12,fontWeight:700,color:"var(--green)",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                              <span>❓</span> จำนวนข้อสอบ & คะแนนเต็ม
                            </div>
                            <div style={{fontSize:15,fontWeight:700,color:"var(--gray-900)",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              <span>{questions.length} ข้อ ({sumPts} คะแนน)</span>
                              {hasManual ? (
                                <span className="badge" style={{background:"#FEF3C7",color:"#92400E",fontSize:11}}>
                                  มีข้อเขียน/ตรวจในระบบได้
                                </span>
                              ) : (
                                <span className="badge badge-green" style={{fontSize:11}}>
                                  ตรวจอัตโนมัติ 100%
                                </span>
                              )}
                            </div>
                            <div style={{fontSize:12,color:"var(--gray-500)",marginTop:4,display:"flex",gap:6,flexWrap:"wrap"}}>
                              <span>ปรนัย {mc} ข้อ</span>
                              {sa > 0 && <span>• เติมคำ {sa} ข้อ</span>}
                              {pa > 0 && <span>• อัตนัย {pa} ข้อ</span>}
                            </div>
                          </div>
                        );
                      })()}

                      <div style={{padding:"14px 18px",background:"var(--gray-50)",borderRadius:"var(--radius-lg)",border:"1px solid var(--gray-200)"}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--gray-600)",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                          <span>📋</span> ช่องข้อมูลนักเรียน ({headers.length} ช่อง)
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                          {headers.map((h: any) => (
                            <span key={h.id} style={{fontSize:12,padding:"2px 8px",background:"white",border:"1px solid var(--gray-300)",borderRadius:6,fontWeight:600}}>
                              {h.label || "ช่องข้อมูล"}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {submitError && (
                      <div style={{marginBottom:18,padding:"14px 18px",background:"var(--red-light)",borderRadius:"var(--radius)",fontSize:13,color:"var(--red)",display:"flex",alignItems:"center",gap:8}}>
                        <span>⚠️</span>
                        <span>{submitError}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn-create-form"
                      onClick={handleSubmit}
                      disabled={loading}
                      title="คลิกเพื่อเริ่มสร้างแบบทดสอบ Google Form ทันที"
                    >
                      <div className="btn-create-icon">
                        🚀
                      </div>
                      <div style={{flex:1,textAlign:"left"}}>
                        <div className="btn-create-title">สร้าง Google Form ทันที</div>
                        <div className="btn-create-sub">ระบบจะนำคำถาม ตัวเลือก และเฉลยไปสร้างเป็นฟอร์มใน Google Drive ให้ทันที</div>
                      </div>
                      <div style={{fontSize:22,fontWeight:800,opacity:0.9,marginRight:4}}>
                        ➔
                      </div>
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

            <div className="app-footer">
              develop by พงศกร ดรโคตร์กอก
            </div>
          </div>
        </div>
      </div>
    </>
  );
}