import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { ExecutiveDashboard } from "./ExecutiveDashboard";
import { INITIAL_EXAM_BANK } from "./examBankData";
import QuestionBank from "./QuestionBank";
import ExamPlayer from "./ExamPlayer";
import { SgsGradebook } from "./SgsGradebook";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const SCRIPT_URL = import.meta.env.VITE_SCRIPT_URL;
const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_KEY || "placeholder"
);

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
  .history-table tr:hover td { background:var(--gray-50); }

  /* ================= EXECUTIVE & EXAM BANK STYLES ================= */
  .exec-container { max-width: 1280px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 24px; animation: slideUp .35s ease; }
  .exec-hero-card {
    background: linear-gradient(135deg, #4C1D95 0%, #6D28D9 45%, #2563EB 100%);
    border-radius: var(--radius-lg);
    padding: 30px 34px;
    color: white;
    box-shadow: 0 10px 25px -5px rgba(109, 40, 217, 0.35);
    position: relative;
    overflow: hidden;
  }
  .exec-hero-card::after {
    content: "";
    position: absolute;
    right: -40px;
    bottom: -40px;
    width: 260px;
    height: 260px;
    background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%);
    border-radius: 50%;
    pointer-events: none;
  }
  .exec-hero-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.25);
    padding: 4px 12px;
    border-radius: 20px;
    margin-bottom: 12px;
  }
  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4ADE80;
    box-shadow: 0 0 8px #4ADE80;
    animation: livePulse 1.8s infinite;
  }
  @keyframes livePulse { 0% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0.5; transform: scale(0.9); } }
  .exec-hero-title {
    font-family: 'Prompt', sans-serif;
    font-size: 25px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 8px;
  }
  .exec-hero-subtitle {
    font-size: 14px;
    opacity: 0.92;
    line-height: 1.6;
    max-width: 880px;
    margin-bottom: 20px;
  }
  .exec-quick-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    background: rgba(0, 0, 0, 0.16);
    padding: 12px 18px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }
  .exec-term-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
  }
  .exec-term-selector select {
    background: white;
    color: var(--gray-900);
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 13px;
    outline: none;
    cursor: pointer;
  }
  .btn-exec {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    border: none;
    white-space: nowrap;
  }
  .btn-exec-primary {
    background: #FBBF24;
    color: #78350F;
    box-shadow: 0 2px 8px rgba(251, 191, 36, 0.4);
  }
  .btn-exec-primary:hover {
    background: #F59E0B;
    transform: translateY(-1px);
  }
  .btn-exec-secondary {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
  .btn-exec-secondary:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  .btn-exec-outline {
    background: white;
    color: #4C1D95;
    font-weight: 700;
  }
  .btn-exec-outline:hover {
    background: #F5F3FF;
  }
  .exec-nav-pills {
    display: flex;
    gap: 8px;
    background: #EDE9FE;
    padding: 6px;
    border-radius: 12px;
    border: 1px solid #DDD6FE;
    flex-wrap: wrap;
  }
  .exec-nav-pill {
    padding: 9px 18px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #6D28D9;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Prompt', sans-serif;
  }
  .exec-nav-pill:hover {
    background: rgba(255, 255, 255, 0.6);
  }
  .exec-nav-pill.active {
    background: white;
    color: #4C1D95;
    box-shadow: var(--shadow-sm);
  }
  .exec-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }
  .exec-kpi-card {
    background: white;
    border-radius: var(--radius-lg);
    padding: 20px;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--gray-200);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.2s ease;
  }
  .exec-kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: #DDD6FE;
  }
  .kpi-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    margin-bottom: 14px;
  }
  .kpi-label {
    font-size: 13px;
    color: var(--gray-600);
    font-weight: 500;
    margin-bottom: 6px;
  }
  .kpi-value {
    font-family: 'Prompt', sans-serif;
    font-size: 30px;
    font-weight: 700;
    color: var(--gray-900);
    line-height: 1;
    margin-bottom: 8px;
  }
  .kpi-unit {
    font-size: 14px;
    font-weight: 500;
    color: var(--gray-500);
  }
  .kpi-trend {
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .kpi-trend.positive { color: #059669; }
  .kpi-trend.highlight { color: #7C3AED; }
  .kpi-trend.neutral { color: var(--gray-600); }
  .exec-analytics-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .exec-panel-card {
    background: white;
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--gray-200);
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
  }
  .panel-title {
    font-family: 'Prompt', sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: var(--gray-900);
  }
  .panel-subtitle {
    font-size: 12px;
    color: var(--gray-500);
    margin-top: 2px;
  }
  .subject-bar-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .subject-bar-item {
    cursor: pointer;
    padding: 8px 10px;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .subject-bar-item:hover {
    background: var(--gray-50);
  }
  .subject-bar-item.selected {
    background: #F5F3FF;
    outline: 1.5px solid #7C3AED;
  }
  .subject-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    margin-bottom: 6px;
  }
  .subject-icon { margin-right: 6px; }
  .subject-name { font-weight: 600; color: var(--gray-800); }
  .subject-counts { font-size: 12px; color: var(--gray-600); }
  .subject-track {
    height: 8px;
    background: var(--gray-100);
    border-radius: 4px;
    overflow: hidden;
  }
  .subject-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.4s ease;
  }
  .grade-pill-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
  }
  .grade-pill {
    background: var(--gray-50);
    border: 1.5px solid var(--gray-200);
    border-radius: 8px;
    padding: 10px 6px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
  }
  .grade-pill:hover {
    border-color: #7C3AED;
    background: #F5F3FF;
  }
  .grade-pill.active {
    background: #7C3AED;
    border-color: #7C3AED;
    color: white;
  }
  .grade-badge-title {
    font-family: 'Prompt', sans-serif;
    font-size: 14px;
    font-weight: 700;
  }
  .grade-pill.active .grade-badge-title { color: white; }
  .grade-badge-count {
    font-size: 11px;
    color: var(--gray-500);
    margin-top: 2px;
  }
  .grade-pill.active .grade-badge-count { color: #E9D5FF; }
  .bloom-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }
  .bloom-card {
    background: var(--gray-50);
    border-radius: 8px;
    padding: 12px;
    border: 1px solid var(--gray-200);
  }
  .bloom-name { font-size: 12px; font-weight: 600; color: var(--gray-700); margin-bottom: 4px; }
  .bloom-pct { font-family: 'Prompt', sans-serif; font-size: 22px; font-weight: 700; line-height: 1; margin-bottom: 4px; }
  .bloom-desc { font-size: 11px; color: var(--gray-500); line-height: 1.3; }
  .bloom-standard-callout {
    background: #F5F3FF;
    border: 1px solid #DDD6FE;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    color: #5B21B6;
    line-height: 1.5;
  }
  .exec-bank-section {
    background: white;
    border-radius: var(--radius-lg);
    padding: 28px;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--gray-200);
  }
  .bank-section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .bank-section-badge {
    font-size: 11px;
    font-weight: 700;
    color: #7C3AED;
    background: #EDE9FE;
    padding: 3px 8px;
    border-radius: 20px;
    display: inline-block;
    margin-bottom: 6px;
    letter-spacing: 0.8px;
  }
  .bank-section-title {
    font-family: 'Prompt', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--gray-900);
  }
  .bank-section-desc {
    font-size: 13px;
    color: var(--gray-600);
    margin-top: 4px;
  }
  .view-mode-btn {
    padding: 6px 12px;
    border: 1.5px solid var(--gray-200);
    background: white;
    color: var(--gray-600);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .view-mode-btn.active {
    background: #7C3AED;
    border-color: #7C3AED;
    color: white;
  }
  .bank-filter-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .search-input-wrap {
    flex: 1;
    min-width: 260px;
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-icon {
    position: absolute;
    left: 12px;
    color: var(--gray-400);
    font-size: 14px;
    pointer-events: none;
  }
  .search-input {
    width: 100%;
    padding: 10px 36px 10px 36px;
    border: 1.5px solid var(--gray-200);
    border-radius: var(--radius);
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }
  .search-input:focus { border-color: #7C3AED; }
  .clear-search-btn {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: var(--gray-400);
    cursor: pointer;
    font-size: 14px;
  }
  .filter-select-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-select {
    padding: 9px 12px;
    border: 1.5px solid var(--gray-200);
    border-radius: var(--radius);
    font-size: 13px;
    background: white;
    color: var(--gray-800);
    outline: none;
    font-weight: 500;
  }
  .filter-select:focus { border-color: #7C3AED; }
  .btn-reset-filters {
    padding: 8px 12px;
    background: var(--red-light);
    color: var(--red);
    border: none;
    border-radius: var(--radius);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .exam-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 18px;
  }
  .exam-card {
    background: white;
    border: 1.5px solid var(--gray-200);
    border-radius: var(--radius-lg);
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.2s ease;
  }
  .exam-card:hover {
    border-color: #7C3AED;
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  .exam-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .subject-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .grade-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    background: #F1F5F9;
    color: #334155;
  }
  .type-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
    background: #FEF3C7;
    color: #92400E;
  }
  .exam-code {
    font-family: monospace;
    font-size: 12px;
    font-weight: 700;
    color: #6D28D9;
    margin-bottom: 4px;
  }
  .exam-title {
    font-family: 'Prompt', sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: var(--gray-900);
    line-height: 1.4;
    margin-bottom: 8px;
  }
  .exam-desc {
    font-size: 12px;
    color: var(--gray-600);
    line-height: 1.5;
    margin-bottom: 14px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .exam-details-list {
    background: var(--gray-50);
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }
  .detail-label { color: var(--gray-500); }
  .detail-val { font-weight: 600; color: var(--gray-800); }
  .exam-card-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    border-top: 1px solid var(--gray-100);
    padding-top: 14px;
  }
  .btn-card-action {
    font-size: 12px;
    font-weight: 600;
    padding: 7px 11px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .btn-card-action.preview-btn {
    background: #EDE9FE;
    color: #7C3AED;
    flex: 1;
  }
  .btn-card-action.preview-btn:hover { background: #DDD6FE; }
  .btn-card-action.link-btn {
    background: #ECFDF5;
    color: #047857;
  }
  .btn-card-action.link-btn:hover { background: #D1FAE5; }
  .btn-card-action.edit-btn {
    background: #EFF6FF;
    color: #1D4ED8;
  }
  .btn-card-action.edit-btn:hover { background: #DBEAFE; }
  .btn-card-action.clone-btn {
    background: #F3F4F6;
    color: #374151;
  }
  .btn-card-action.clone-btn:hover { background: #E5E7EB; }

  /* Modal preview */
  .modal.exec-preview-modal {
    max-width: 720px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
  }
  .modal-header-banner {
    padding: 24px 28px;
    background: #F8FAFC;
    border-bottom: 1px solid var(--gray-200);
  }
  .modal-close-btn {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--gray-400);
    cursor: pointer;
    padding: 4px;
    line-height: 1;
  }
  .modal-close-btn:hover { color: var(--gray-800); }
  .preview-meta-strip {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--gray-600);
    margin-top: 12px;
    flex-wrap: wrap;
    background: white;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--gray-200);
  }
  .modal-body-scroll {
    padding: 24px 28px;
    overflow-y: auto;
    flex: 1;
  }
  .preview-questions-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .preview-question-card {
    border: 1px solid var(--gray-200);
    border-radius: 8px;
    padding: 16px;
    background: white;
  }
  .pq-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .pq-num {
    font-size: 12px;
    font-weight: 700;
    color: #7C3AED;
    background: #EDE9FE;
    padding: 2px 8px;
    border-radius: 20px;
  }
  .pq-bloom-tag {
    font-size: 11px;
    color: var(--gray-600);
    background: var(--gray-100);
    padding: 2px 8px;
    border-radius: 12px;
  }
  .pq-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--gray-900);
    margin-bottom: 12px;
    line-height: 1.5;
  }
  .pq-choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .pq-choice-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--gray-200);
    background: var(--gray-50);
    font-size: 13px;
  }
  .pq-choice-item.correct {
    border-color: #10B981;
    background: #ECFDF5;
    font-weight: 600;
    color: #065F46;
  }
  .pq-choice-bullet {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    background: white;
    border: 1.5px solid var(--gray-300);
    color: var(--gray-600);
    flex-shrink: 0;
  }
  .pq-choice-bullet.correct {
    background: #10B981;
    border-color: #10B981;
    color: white;
  }
  .pq-choice-text { flex: 1; }
  .correct-tag {
    font-size: 10px;
    background: #10B981;
    color: white;
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 700;
  }
  .pq-explanation {
    margin-top: 10px;
    padding: 8px 12px;
    background: #FFFBEB;
    border-radius: 6px;
    font-size: 12px;
    color: #92400E;
    line-height: 1.4;
  }
  .modal-footer-actions {
    padding: 16px 28px;
    border-top: 1px solid var(--gray-200);
    background: #F8FAFC;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* PRINT STYLING FOR EXECUTIVE PRESENTATION */
  @media print {
    .topbar, .sidebar, .exec-quick-actions, .exec-nav-pills, .bank-filter-bar, .exam-card-actions, .btn { display: none !important; }
    .main-layout { display: block !important; }
    .content { padding: 0 !important; }
    .exec-container { max-width: 100% !important; gap: 16px !important; }
    .exec-hero-card { background: #4C1D95 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .exec-kpi-card, .exec-panel-card, .exec-bank-section { box-shadow: none !important; border: 1px solid #ccc !important; }
  }
`;

// ICONS
export const Logo = () => (
  <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="#991B1B"/>
    <path d="M8 10h16M8 16h10M8 22h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="24" cy="22" r="4" fill="#F59E0B"/>
    <path d="M22 22l1.5 1.5L26 20" stroke="#7F1D1D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6M15.5 7.5l3 3" />
  </svg>
);
const ExecutiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 14h12M3 14V6l5-3 5 3v8M6 14V9h4v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ExamBankIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1v-9a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6 2.5v11M2.5 6.5h3.5M2.5 9.5h3.5" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const TrashIcon = () => <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 4h9M5 4V3h5v1M6 7v4M9 7v4M4 4l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const CopyIcon = () => <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M3 10V3h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ExternalIcon = () => <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M7 2h4v4M11 2L6 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 3H3a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const CheckIcon = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const FormIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const UploadIcon = () => <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 18V8M10 12l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const RefreshIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8A5 5 0 113 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M13 4v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const SheetIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2" width="11" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M2.5 6h11M6.5 6v8M10.5 6v8" stroke="currentColor" strokeWidth="1.2"/></svg>;
const ChartIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13.5h12M4 11V7M8 11V4M12 11V8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11.5l3.5-3.5L11 4.5M14.5 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
// ============ LOGIN ============
export function LoginPage({ onLogin, onClose }: { onLogin: (u: any) => void; onClose?: () => void }) {
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
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              background: "var(--gray-100)",
              border: "1px solid var(--gray-300)",
              borderRadius: "50%",
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--gray-600)",
              fontWeight: 700,
              zIndex: 10
            }}
            title="ปิด / กลับสู่โหมดผู้บริหาร"
          >
            ✕
          </button>
        )}

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
            เข้าสู่ระบบสำหรับคุณครูและบุคลากร
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

        {onClose && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ width: "100%", marginTop: 10, borderRadius: 12, padding: "11px", fontSize: 13.5, fontWeight: 600 }}
          >
            🏛️ กลับสู่หน้าแดชบอร์ดผู้บริหาร (ไม่ต้องล็อกอิน)
          </button>
        )}

        <div style={{textAlign:"center",marginTop:18,fontSize:12,color:"var(--gray-400)"}}>
          กรุณาติดต่อผู้ดูแลระบบเพื่อรับ Key
        </div>

        <div style={{textAlign:"center",marginTop:16,fontSize:11.5,color:"var(--gray-400)",opacity:0.7,letterSpacing:0.3,userSelect:"none"}}>
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

  const genKey = (role: string) => {
    const prefix = role === "admin" ? "ADM" : "USR";
    const r = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${r()}-${r()}-${r()}`;
  };

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

// ============ SUBJECT GROUPS (8 กลุ่มสาระการเรียนรู้ สพฐ.) ============
export interface SubjectGroup {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  codePrefix?: string;
}

export const SUBJECT_GROUPS: SubjectGroup[] = [
  { id: "all", name: "ทุกกลุ่มสาระการเรียนรู้", shortName: "ทุกกลุ่มสาระฯ", icon: "📚", color: "var(--crimson)", bgColor: "#FEF2F2", borderColor: "var(--crimson)" },
  { id: "thai", name: "กลุ่มสาระฯ ภาษาไทย", shortName: "ภาษาไทย", icon: "🇹🇭", color: "#B91C1C", bgColor: "#FEF2F2", borderColor: "#FECACA", codePrefix: "ท" },
  { id: "math", name: "กลุ่มสาระฯ คณิตศาสตร์", shortName: "คณิตศาสตร์", icon: "📐", color: "#1D4ED8", bgColor: "#EFF6FF", borderColor: "#BFDBFE", codePrefix: "ค" },
  { id: "science", name: "กลุ่มสาระฯ วิทยาศาสตร์และเทคโนโลยี", shortName: "วิทย์ฯ-เทคโน", icon: "🔬", color: "#047857", bgColor: "#ECFDF5", borderColor: "#A7F3D0", codePrefix: "ว" },
  { id: "social", name: "กลุ่มสาระฯ สังคมศึกษา ศาสนา และวัฒนธรรม", shortName: "สังคมศึกษา", icon: "🌏", color: "#D97706", bgColor: "#FFFBEB", borderColor: "#FDE68A", codePrefix: "ส" },
  { id: "foreign", name: "กลุ่มสาระฯ ภาษาต่างประเทศ", shortName: "ภาษาต่างประเทศ", icon: "🇬🇧", color: "#7C3AED", bgColor: "#F5F3FF", borderColor: "#DDD6FE", codePrefix: "อ/จ" },
  { id: "health", name: "กลุ่มสาระฯ สุขศึกษาและพลศึกษา", shortName: "สุขศึกษา-พละ", icon: "🏃", color: "#EA580C", bgColor: "#FFF7ED", borderColor: "#FFEDD5", codePrefix: "พ" },
  { id: "art", name: "กลุ่มสาระฯ ศิลปะ", shortName: "ศิลปะ", icon: "🎨", color: "#DB2777", bgColor: "#FDF2F8", borderColor: "#FBCFE8", codePrefix: "ศ" },
  { id: "career", name: "กลุ่มสาระฯ การงานอาชีพ", shortName: "การงานอาชีพ", icon: "🛠️", color: "#4B5563", bgColor: "#F9FAFB", borderColor: "#E5E7EB", codePrefix: "ง" },
  { id: "activity", name: "กิจกรรมพัฒนาผู้เรียน / อื่นๆ", shortName: "กิจกรรม/อื่นๆ", icon: "🧭", color: "#0891B2", bgColor: "#ECFEFF", borderColor: "#A5F3FC", codePrefix: "ก/I" },
];

export const detectSubjectFromTitle = (title: string, desc = ""): string => {
  const text = `${title} ${desc}`.toLowerCase();

  // Health & PE (พ)
  if (/(พ[\d๐-๙]{5}|[ (]พ[\d๐-๙]|สุขศึกษา|พลศึกษา|ยิมนาส|ฟุตซอล|บาสเกตบอล|ตะกร้อ|ลีลาศ|ธุรกิจการกีฬา|การจัดการแข่งขัน|กีฬา|สุขภาพ)/.test(text)) return "health";
  // Art (ศ - ศิลปะ, ดนตรี, นาฏศิลป์)
  if (/(ศ[\d๐-๙]{5}|[ (]ศ[\d๐-๙]|ศิลปะ|ทัศนศิลป์|ประวัติศาสตร์ศิลป์|ดนตรี|นาฏศิลป์)/.test(text)) return "art";
  // Career (ง)
  if (/(ง[\d๐-๙]{5}|[ (]ง[\d๐-๙]|การงานอาชีพ|งานช่าง|เกษตร|ขยายพันธ์|การดำรงชีวิตและครอบครัว|อาชีวอนามัย|เครื่องมือวัด)/.test(text)) return "career";
  // Thai (ท)
  if (/(ท[\d๐-๙]{5}|[ (]ท[\d๐-๙]|ภาษาไทย|วรรณกรรม|การอ่าน|การเขียน|วรรณคดี|เรียงความ)/.test(text)) return "thai";
  // Foreign (อ, จ)
  if (/(อ[\d๐-๙]{5}|จ[\d๐-๙]{5}|[ (][อจ][\d๐-๙]|ภาษาอังกฤษ|อังกฤษ|ภาษาจีน|汉语|english|listening|speaking)/.test(text)) return "foreign";
  // Math (ค)
  if (/(ค[\d๐-๙]{5}|[ (]ค[\d๐-๙]|คณิตศาสตร์|คณิต|พีชคณิต|เรขาคณิต|แคลคูลัส|สถิติ)/.test(text)) return "math";
  // Science & Tech (ว)
  if (/(ว[\d๐-๙]{5}|[ (]ว[\d๐-๙]|วิทยาศาสตร์|วิทยาศษสตร์|ฟิสิกส์|เคมี|ชีววิทยา|ชีวภาพ|ดาราศาสตร์|คอมพิวเตอร์|เทคโนโลยี|วิทยาการคำนวณ|coding)/.test(text)) return "science";
  // Social (ส)
  if (/(ส[\d๐-๙]{5}|[ (]ส[\d๐-๙]|สังคมศึกษา|สังคม|ประวัติศาสตร์|หน้าที่พลเมือง|ภูมิศาสตร์|ศาสนา|ศีลธรรม|เศรษฐศาสตร์)/.test(text)) return "social";
  // Activity (I, ก)
  if (/(i[\d๐-๙]{5}|การค้นคว้าอิสระ|\bis\b|กิจกรรม)/.test(text)) return "activity";

  return "";
};

export const getExamSubjectGroup = (item: any): SubjectGroup => {
  if (!item) return SUBJECT_GROUPS.find(g => g.id === "activity")!;
  const title = item.form_title || "";
  const desc = item.form_desc || "";
  const text = `${title} ${desc}`.toLowerCase();
  const id = item.id || "";
  const license = (item.license_key || "").toLowerCase();

  // 1. Explicit tag in form_desc: [กลุ่มสาระ: xxx]
  const tagMatch = text.match(/\[กลุ่มสาระ:\s*([^\]]+)\]/);
  if (tagMatch) {
    const raw = tagMatch[1].trim();
    const found = SUBJECT_GROUPS.find(g => g.id !== "all" && (g.id === raw || g.name.includes(raw) || g.shortName.includes(raw) || raw.includes(g.shortName)));
    if (found) return found;
  }

  // 2. ตรวจสอบจากรหัสวิชาและชื่อวิชาโดยตรง (ลำดับความสำคัญสูงสุด - ไม่ขึ้นกับว่าใครเป็นคนนำเข้าข้อสอบ)
  const detectedId = detectSubjectFromTitle(title, desc);
  if (detectedId) {
    const found = SUBJECT_GROUPS.find(g => g.id === detectedId);
    if (found) return found;
  }

  // 3. Fallback สำหรับข้อสอบรุ่นเก่าที่ไม่มีรหัสวิชาในชื่อ
  if (license.includes("duangkhae")) return SUBJECT_GROUPS.find(g => g.id === "thai")!;
  if (license.includes("pongsarkon")) return SUBJECT_GROUPS.find(g => g.id === "career")!;
  if (text.includes("เครื่องมือวัด") || text.includes("ขยายพันธ์")) return SUBJECT_GROUPS.find(g => g.id === "career")!;
  if (text.includes("ค้นคว้าอิสระ") || text.includes(" is ") || text.includes("i22201")) return SUBJECT_GROUPS.find(g => g.id === "activity")!;
  if (id.startsWith("2edeb292")) return SUBJECT_GROUPS.find(g => g.id === "foreign")!;

  return SUBJECT_GROUPS.find(g => g.id === "activity")!;
};

// ============ STEP 0: DETAILS ============
function StepDetails({
  formTitle, setFormTitle,
  formDesc, setFormDesc,
  targetGrade, setTargetGrade,
  targetRooms, setTargetRooms,
  targetSubject, setTargetSubject,
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
      <div className="card-sub">ตั้งชื่อหัวข้อสอบ เลือกกลุ่มสาระการเรียนรู้ และเลือกห้องเรียนที่ใช้ข้อสอบชุดนี้</div>

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
                onClick={() => {
                  const val = formTitle ? `${preset} ${formTitle}` : preset;
                  setFormTitle(val);
                  if (!targetSubject) {
                    const detected = detectSubjectFromTitle(val);
                    if (detected) setTargetSubject(detected);
                  }
                }}
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
          onChange={e => {
            const val = e.target.value;
            setFormTitle(val);
            if (!targetSubject) {
              const detected = detectSubjectFromTitle(val);
              if (detected) setTargetSubject(detected);
            }
          }}
        />
      </div>

      {/* Subject Group Selector */}
      <div className="field" style={{background:"var(--gray-50)", padding:"16px", borderRadius:"var(--radius)", border:"1px solid var(--gray-200)"}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:6}}>
          <label style={{fontWeight:700, margin:0, color:"var(--gray-800)"}}>
            📚 กลุ่มสาระการเรียนรู้ (8 กลุ่มสาระ สพฐ.):
          </label>
          {targetSubject && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              style={{fontSize:11, padding:"3px 8px", color:"var(--gray-500)"}}
              onClick={() => setTargetSubject("")}>
              ✕ ล้าง
            </button>
          )}
        </div>

        <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
          {SUBJECT_GROUPS.filter(g => g.id !== "all").map(g => {
            const isSelected = targetSubject === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setTargetSubject(g.id)}
                style={{
                  padding: "6px 13px",
                  borderRadius: "20px",
                  fontSize: "12.5px",
                  cursor: "pointer",
                  border: isSelected ? `2px solid ${g.color}` : "1.5px solid var(--gray-300)",
                  background: isSelected ? g.bgColor : "white",
                  color: isSelected ? g.color : "var(--gray-700)",
                  fontWeight: isSelected ? 700 : 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  boxShadow: isSelected ? `0 2px 6px ${g.bgColor}` : "none",
                  transition: "all .15s"
                }}>
                <span>{g.icon}</span>
                <span>{g.shortName}</span>
                {isSelected && <span>✓</span>}
              </button>
            );
          })}
        </div>
        {targetSubject && (
          <div style={{fontSize:12, color:"var(--gray-600)", marginTop:8, display:"flex", alignItems:"center", gap:6}}>
            <span>✨</span>
            <span>จัดอยู่ใน: <strong style={{color: SUBJECT_GROUPS.find(g => g.id === targetSubject)?.color}}>
              {SUBJECT_GROUPS.find(g => g.id === targetSubject)?.name}
            </strong> (ระบบจะจำแนกเข้าสู่แดชบอร์ดกลุ่มสาระฯ นี้ให้อัตโนมัติ)</span>
          </div>
        )}
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
function StepQuestions({ questions, setQuestions, licenseKey, onParsed, targetTotalScore, setTargetTotalScore }: any) {
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [hasAnswer, setHasAnswer] = useState<boolean | null>(null);
  const labels = ["ก","ข","ค","ง"];

  const handleDistributeTargetPoints = () => {
    if (questions.length === 0) return;
    const target = (targetTotalScore && targetTotalScore > 0) ? targetTotalScore : 20;
    const avgPts = target / questions.length;
    const isInteger = Number.isInteger(avgPts);

    if (isInteger && avgPts >= 1) {
      setQuestions((prev: any[]) => prev.map(q => ({ ...q, points: avgPts })));
      alert(`คำนวณและเฉลี่ยคะแนนให้เท่ากันทุกข้อเรียบร้อยแล้ว: ข้อละ ${avgPts} คะแนน (รวม ${target} คะแนนเต็ม)`);
    } else {
      setQuestions((prev: any[]) => prev.map(q => ({ ...q, points: 1 })));
      alert(`ตั้งค่าคะแนนเต็มรวมของชุดข้อสอบเป็น ${target} คะแนนเรียบร้อยแล้ว!\n(เฉลี่ยข้อละ ${avgPts.toFixed(2)} คะแนน ระบบจะแปลงและแสดงสัดส่วนคะแนนให้สัมพันธ์กับคะแนนเต็ม ${target} คะแนนในชีตและแดชบอร์ดโดยอัตโนมัติ)`);
    }
  };

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
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (geminiKey) {
      const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
      let lastErr = "";
      for (const model of models) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: {
                response_mime_type: "application/json",
                temperature: 0.1,
              },
            }),
          });
          const d = await res.json();
          if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
          const raw = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          return JSON.parse(clean);
        } catch (err: any) {
          lastErr = err.message;
        }
      }
      throw new Error(lastErr || "Failed to parse exam with Gemini");
    }

    // If user is google authenticated, attach their JWT token
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const { data, error } = await supabase.functions.invoke("parse-exam", {
      body: { parts, license_key: licenseKey || "DIRECT" },
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
        {/* กล่องกำหนดคะแนนเต็มรวมที่ครูต้องการ (Request 5) */}
        {questions.length > 0 && (
          <div style={{
            background: "linear-gradient(135deg, #FEF2F2 0%, #FFFBEB 100%)",
            border: "1.5px solid #F59E0B",
            borderRadius: "var(--radius)",
            padding: "14px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12
          }}>
            <div style={{display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap"}}>
              <span style={{fontSize: 22}}>🎯</span>
              <div>
                <div style={{fontSize: 14, fontWeight: 700, color: "var(--gray-900)"}}>
                  กำหนดคะแนนเต็มรวมของแบบทดสอบ (Target Total Points):
                </div>
                <div style={{fontSize: 12, color: "var(--gray-600)", marginTop: 2}}>
                  คุณครูตั้งคะแนนเต็มเท่าไหร่ก็ได้ ({questions.length} ข้อ) • ระบบจะเฉลี่ยและแปลงคะแนนแต่ละข้อให้สัมพันธ์กับคะแนนเต็มโดยอัตโนมัติ
                </div>
              </div>
            </div>

            <div style={{display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap"}}>
              <div style={{display: "flex", alignItems: "center", gap: 6, background: "white", padding: "5px 12px", borderRadius: 8, border: "1.5px solid #D97706"}}>
                <span style={{fontSize: 13, fontWeight: 700, color: "#92400E"}}>คะแนนเต็ม:</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={targetTotalScore || totalPoints || questions.length}
                  onChange={e => {
                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                    if (setTargetTotalScore) setTargetTotalScore(val);
                  }}
                  style={{
                    width: 55,
                    textAlign: "center",
                    fontWeight: 800,
                    fontSize: 15,
                    color: "var(--crimson)",
                    border: "none",
                    outline: "none"
                  }}
                />
                <span style={{fontSize: 12, fontWeight: 600, color: "var(--gray-600)"}}>คะแนน</span>
              </div>

              <button
                type="button"
                className="btn btn-sm"
                onClick={handleDistributeTargetPoints}
                style={{
                  background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 12.5,
                  boxShadow: "0 2px 6px rgba(217,119,6,.25)"
                }}>
                ⚖️ หารคะแนนเฉลี่ยเท่ากันทุกข้อ (ข้อละ {((targetTotalScore || totalPoints || questions.length) / questions.length).toFixed(2)} คะแนน)
              </button>
            </div>
          </div>
        )}

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
// Helper: ทำความสะอาดคำชี้แจง โดยไม่แสดงแท็ก [ห้อง: ...], [ระดับชั้น: ...] หรือ [กลุ่มสาระ: ...]
const cleanDesc = (desc?: string | null) => {
  if (!desc) return "";
  return desc.replace(/\s*\[(ห้อง|ระดับชั้น|กลุ่มสาระ):[^\]]*\]/g, "").trim();
};

// ============ HISTORY ============
function HistoryTab({ user, history: passedHistory, onRefresh }: any) {
  const [history, setHistory] = useState<any[]>(passedHistory || []);
  const [loading, setLoading] = useState(!passedHistory);
  const [copied, setCopied] = useState<Record<string,boolean>>({});

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("form_history").select("*").order("created_at", { ascending:false });
      if (error) throw error;
      setHistory(data || []);
      if (onRefresh) onRefresh();
    } catch {
      try {
        const local = JSON.parse(localStorage.getItem("fromauto_history") || "[]");
        setHistory(local);
      } catch {
        setHistory([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (passedHistory) {
      setHistory(passedHistory);
      setLoading(false);
    } else {
      fetchHistory();
    }
  }, [passedHistory]);

  const copy = (k: string, val: string) => {
    navigator.clipboard.writeText(val).catch(()=>{});
    setCopied(c => ({...c,[k]:true}));
    setTimeout(() => setCopied(c => ({...c,[k]:false})), 2000);
  };

  const deleteHistory = async (id: string) => {
    if (!confirm("ต้องการลบประวัตินี้ไหม?")) return;
    try {
      await supabase.from("form_history").delete().eq("id", id);
    } catch {}
    try {
      const local = JSON.parse(localStorage.getItem("fromauto_history") || "[]");
      localStorage.setItem("fromauto_history", JSON.stringify(local.filter((x: any) => x.id !== id)));
    } catch {}
    fetchHistory();
  };

  return (
    <div className="card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <div className="card-title">📜 ประวัติการสร้างฟอร์ม</div>
          <div style={{fontSize:13,color:"var(--gray-600)"}}>
            ประวัติการสร้างฟอร์มทั้งหมด
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
                    <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:4}}>
                      {(() => {
                        const sg = getExamSubjectGroup(h);
                        return (
                          <span style={{
                            background: sg.bgColor,
                            color: sg.color,
                            border: `1px solid ${sg.borderColor}`,
                            padding: "1px 7px",
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}>
                            <span>{sg.icon}</span>
                            <span>{sg.shortName}</span>
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{fontWeight:600,fontSize:14}}>{h.form_title}</div>
                    {cleanDesc(h.form_desc) && <div style={{fontSize:12,color:"var(--gray-500)",marginTop:2}}>{cleanDesc(h.form_desc)}</div>}
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

// ============ EXAM SCORE LEVEL SCALING (ระดับผลคะแนนสอบตามเกณฑ์ร้อยละ) ============
export function calculateScoreLevel(earned: number, total: number) {
  const pct = total > 0 ? (earned / total) * 100 : 0;
  if (pct >= 80) return { level: "ดีเยี่ยม", range: "80-100%", color: "#047857", bg: "#ECFDF5", border: "#A7F3D0", tier: "mastery", pct };
  if (pct >= 70) return { level: "ดีมาก", range: "70-79%", color: "#059669", bg: "#F0FDF4", border: "#BBF7D0", tier: "mastery", pct };
  if (pct >= 60) return { level: "ดี", range: "60-69%", color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE", tier: "developing", pct };
  if (pct >= 50) return { level: "ผ่านเกณฑ์", range: "50-59%", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", tier: "developing", pct };
  return { level: "ต้องปรับปรุง", range: "ต่ำกว่า 50%", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", tier: "at_risk", pct };
}


// ============ GLOBAL EXAM SCORE IN-MEMORY CACHE ============
const examScoreCache = new Map<string, any>();

// ============ STUDENT DEDUPLICATION & IDENTIFIER NORMALIZATION ============
// แก้ไขปัญหา: เด็กนักเรียน 1 คน ทำข้อสอบหลายวิชา (ทั้งโรงเรียนมี ~800 กว่าคน ไม่มีทางเป็น 1,100 คน)
// แท็กจาก "ห้อง" และ "เลขที่" เป็นกุญแจหลักตามคำขอของผู้ใช้ ป้องกันชื่อสะกดผิด/เว้นวรรคไม่ตรงกัน
export function normalizeRoomName(r: any): string {
  if (!r) return "";
  const str = String(r).trim().toLowerCase().replace(/\s+/g, "");
  const m = str.match(/(?:ม\.?|มัธยมศึกษาปีที่)?([1-6])(?:[\/\.\-]|ห้อง|ทับ)+([0-9]+)/);
  if (m) return `m${m[1]}_${m[2]}`;
  return str.replace(/[^a-z0-9ก-๙]/g, "");
}

export function normalizeStudentNo(n: any): string {
  if (n === undefined || n === null) return "";
  const digits = String(n).replace(/[^\d]/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10);
  return (isNaN(num) || num <= 0 || num > 70) ? "" : String(num);
}

export function normalizeStudentKey(student: any, fallbackIndex?: number, examContext?: any): string {
  if (!student || typeof student !== "object") return `anon_${fallbackIndex ?? Math.random()}`;

  // 1. ตรวจสอบเลขประจำตัวนักเรียน (ถ้ามีเลข 4-6 หลัก เช่น 12345)
  for (const k of ["เลขประจำตัว", "รหัสประจำตัว", "รหัสนักเรียน", "student_id", "std_id", "id"]) {
    const v = student[k];
    if (v !== undefined && v !== null && String(v).trim().length >= 4) {
      const clean = String(v).replace(/[^\d]/g, "");
      if (clean.length >= 4) return `id_${clean}`;
    }
  }

  // 2. ดึงชั้น/ห้อง และ เลขที่ (ตามที่ผู้ใช้สั่ง: แท็กจาก ห้อง และ เลขที่ เป็นหลัก)
  let rawRoom = "";
  for (const k of ["ชั้น", "ห้อง", "ห้องเรียน", "ระดับชั้น", "ระดับชั้น/ห้อง", "room", "class"]) {
    if (student[k]) { rawRoom = String(student[k]).trim(); break; }
  }
  // ถ้าในแถวคำตอบไม่มีห้อง ให้ดึงจากชื่อข้อสอบหรือรายละเอียดของข้อสอบ
  if (!rawRoom && examContext) {
    const textToScan = `${examContext.form_title || ""} ${examContext.form_desc || ""}`;
    const m = textToScan.match(/(?:ม\.?|มัธยมศึกษาปีที่)?([1-6])(?:[\/\.\-]|ห้อง|ทับ)+([0-9]+)/);
    if (m) rawRoom = `ม.${m[1]}/${m[2]}`;
  }
  const normR = normalizeRoomName(rawRoom);

  let rawNo = "";
  for (const k of ["เลขที่", "ลำดับที่", "no", "no."]) {
    if (student[k] !== undefined && student[k] !== null && String(student[k]).trim() !== "") {
      rawNo = String(student[k]).trim();
      break;
    }
  }
  const normN = normalizeStudentNo(rawNo);

  // สำคัญที่สุด: หากมี ห้อง + เลขที่ ให้ใช้เป็นกุญแจหลักทันที! เพราะในห้องเดียวกันเลขที่ไม่ซ้ำกัน
  if (normR && normN) {
    return `r_${normR}_no_${normN}`;
  }

  // 3. Fallback: ถ้าไม่มีเลขที่ หรือเลขที่ไม่สมบูรณ์ จึงใช้ ห้อง + ชื่อ (ตัดคำนำหน้าและช่องว่าง)
  let rawName = "";
  for (const k of ["ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อ", "name", "student_name", "fullname"]) {
    if (student[k]) { rawName = String(student[k]).trim(); break; }
  }
  const cleanName = rawName
    .replace(/^(ด\.ช\.|ด\.ญ\.|นาย|นางสาว|น\.ส\.|เด็กชาย|เด็กหญิง)\s*/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

  if (normR && cleanName) return `r_${normR}_name_${cleanName}`;
  if (cleanName) return `name_${cleanName}`;
  if (normN) return `no_${normN}`;
  return `idx_${fallbackIndex ?? Math.random()}`;
}

function ExamScoreDashboard({ exam, onBack, user }: { exam: any; onBack: () => void; user?: any }) {
  const isSchoolUser = user?.is_google ||
    (user?.email && user.email.toLowerCase().endsWith("@wangluangpitt.ac.th")) ||
    (typeof user?.key === "string" && user.key.toLowerCase().endsWith("@wangluangpitt.ac.th")) ||
    user?.role === "admin";
  const [activeTab, setActiveTab] = useState<"overview" | "classroom" | "item_analysis" | "at_risk" | "students" | "sheet">("overview");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("กำลังเชื่อมต่อ Google Sheets...");
  const [retryCount, setRetryCount] = useState(0);
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
  const [questionScores, setQuestionScores] = useState<Record<number, number>>({});

  // Modal for viewing item option distribution breakdown
  const [selectedQuestionModal, setSelectedQuestionModal] = useState<any>(null);
  const [atRiskCopied, setAtRiskCopied] = useState(false);

  const loadData = async (forceRefreshArg: any = false, attempt = 0) => {
    const forceRefresh = forceRefreshArg === true;
    setLoading(true);
    setError("");

    if (!exam.sheet_url || !exam.sheet_url.trim()) {
      setData({ success: true, sheetTitle: exam.form_title, columnHeaders: [], students: [], totalMaxPoints: exam.question_count || 20, stats: { totalStudents: 0 } });
      setLoading(false);
      return;
    }

    const sheetId = exam.sheet_url.match(/[-\w]{25,}/)?.[0] || exam.sheet_url.trim();
    const cacheKey = `exam_score_${sheetId}`;

    // 1. ตรวจสอบ In-Memory Cache หรือ SessionStorage ก่อน
    if (!forceRefresh) {
      if (examScoreCache.has(sheetId)) {
        const cached = examScoreCache.get(sheetId);
        setData(cached);
        setLoading(false);
        return;
      }
      try {
        const saved = sessionStorage.getItem(cacheKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.success && Array.isArray(parsed.students)) {
            examScoreCache.set(sheetId, parsed);
            setData(parsed);
            setLoading(false);
            return;
          }
        }
      } catch (err) {}
    }

    setLoadingStatus(attempt > 0 ? `กำลังลองเชื่อมต่อ Google Sheets ใหม่อัตโนมัติ (ครั้งที่ ${attempt + 1})...` : "กำลังเชื่อมต่อ Google Sheets และอ่านคะแนนจริงของนักเรียน...");

    const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 50000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
      } catch (err) {
        clearTimeout(id);
        throw err;
      }
    };

    const parseJsonResponse = async (res: Response) => {
      const text = await res.text();
      const trimmed = text.trim();
      if (trimmed.startsWith("<") || trimmed.includes("<!DOCTYPE") || trimmed.includes("<html")) {
        throw new Error("HTML_ERROR: Google Apps Script ตอบกลับด้วยหน้าเว็บ HTML");
      }
      return JSON.parse(text);
    };

    let resultJson: any = null;
    let fetchError = "";

    try {
      const getUrl = `${SCRIPT_URL}?sheetId=${encodeURIComponent(sheetId)}`;
      const res = await fetchWithTimeout(getUrl, { method: "GET" }, 50000);
      if (res.ok) {
        const json = await parseJsonResponse(res);
        if (json && json.success && Array.isArray(json.students)) {
          resultJson = json;
        } else if (json && !json.success) {
          fetchError = json.error || "ไม่สามารถอ่านข้อมูลคะแนนจาก Google Sheets ได้";
        }
      } else {
        fetchError = `HTTP ${res.status}: ไม่สามารถเข้าถึง Google Apps Script ได้`;
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        fetchError = "การเชื่อมต่อ Google Sheets ใช้เวลานานเกินกำหนด (Timeout 50s)";
      } else {
        fetchError = e.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets";
      }
    }

    if (resultJson && resultJson.success && Array.isArray(resultJson.students)) {
      examScoreCache.set(sheetId, resultJson);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(resultJson)); } catch (err) {}
      setData(resultJson);
      setLoading(false);
      setRetryCount(0);
    } else {
      // Auto-retry loop: หากโหลดไม่สำเร็จ ให้ลองใหม่ต่อเนื่องสูงสุด 5 ครั้ง
      if (attempt < 5) {
        setRetryCount(attempt + 1);
        setLoadingStatus(`การเชื่อมต่อขัดข้อง กำลังโหลดใหม่ต่อเนื่อง (ครั้งที่ ${attempt + 1}/5)... [ห้ามใช้ข้อมูลจำลอง]`);
        setTimeout(() => {
          loadData(true, attempt + 1);
        }, 2500 + attempt * 1500);
      } else {
        if (fetchError) setError(fetchError);
        setData(resultJson || { success: false, sheetTitle: exam.form_title, columnHeaders: [], students: [], totalMaxPoints: exam.question_count || 20 });
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [exam.sheet_url]);

  const getSafeStr = (val: any): string => {
    if (val === undefined || val === null) return "";
    if (val instanceof Date) return val.toLocaleString("th-TH");
    return String(val).trim();
  };

  const isSystemOrProfileColumn = (colName: string): boolean => {
    if (!colName) return true;
    const clean = colName.trim().toLowerCase();
    if (clean === "_rowindex" || clean.startsWith("_")) return true;
    if (/^(ประทับเวลา|timestamp|time\s*stamp|submission\s*time|วันที่และเวลา)$/i.test(clean)) return true;
    if (/^(คะแนน|score|total\s*score|คะแนนรวม|คะแนนที่ได้|points)(\s*[/(\[].*)?$/i.test(clean) || clean.startsWith("คะแนน") || clean.startsWith("score")) return true;
    if (/^(ชื่อ|ชื่อ-สกุล|ชื่อ-นามสกุล|ชื่อ\s*-\s*สกุล|ชื่อ\s*-\s*นามสกุล|ชื่อผู้สอบ|ชื่อนักเรียน|name|full[\s\-_]*name|student[\s\-_]*name)$/i.test(clean)) return true;
    if (/^(ชั้น|ห้อง|ห้องเรียน|ระดับชั้น|ระดับชั้น[\s\-_/]*ห้อง|ชั้น[\s\-_/]*ห้อง|ห้อง[\s\-_/]*ชั้น|room|class|grade)$/i.test(clean)) return true;
    if (/^(เลขที่|ลำดับที่|เลขที่นักเรียน|no\.?|student\s*no\.?|roll\s*no\.?)$/i.test(clean)) return true;
    if (/^(เลขประจำตัว|รหัสประจำตัว|รหัสนักเรียน|เลขประจำตัวนักเรียน|student[\s\-_]*id|std[\s\-_]*id)$/i.test(clean)) return true;
    if (/^(อีเมล|ที่อยู่อีเมล|email|email[\s\-_]*address)$/i.test(clean)) return true;
    if (/^(คำนำหน้า|คำนำหน้านาม|prefix|title)$/i.test(clean)) return true;
    return false;
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
      const kLower = k.toLowerCase().trim();
      const found = entries.find(([key]) => key.toLowerCase().trim() === kLower);
      if (found && found[1] !== undefined && found[1] !== null && found[1] !== "") {
        return getSafeStr(found[1]);
      }
    }
    return "";
  };

  const getStudentRoom = (s: any): string => {
    const raw = getStudentField(s, ["ชั้น", "ห้องเรียน", "ห้อง", "ระดับชั้น", "room", "class", "grade"]);
    if (raw) return raw;
    for (const [k, v] of Object.entries(s)) {
      if (k.includes("ห้อง") || k.includes("ชั้น")) {
        const val = getSafeStr(v);
        if (val) return val;
      }
    }
    return "ไม่ระบุห้อง";
  };

  const getStudentNo = (s: any): number => {
    const raw = getStudentField(s, ["เลขที่", "ลำดับที่", "no.", "no", "number"]);
    if (raw) {
      const n = parseInt(raw.replace(/\D/g, ""), 10);
      if (!isNaN(n)) return n;
    }
    return 9999;
  };

  // กรองเฉพาะแถวนักเรียนจริงที่มีข้อมูล
  const rawStudents: any[] = useMemo(() => {
    const list: any[] = (data?.students && Array.isArray(data.students)) ? data.students : [];
    return list.filter(s => {
      if (!s || typeof s !== "object") return false;
      const name = getStudentField(s, ["ชื่อ", "ชื่อ-สกุล", "ชื่อ-นามสกุล", "name", "student_name"]);
      const time = getStudentField(s, ["ประทับเวลา", "timestamp", "time"]);
      const rawScore = getStudentField(s, ["คะแนน", "score", "total score", "points", "คะแนนรวม"]);
      const room = getStudentField(s, ["ชั้น", "ห้องเรียน", "ห้อง", "ระดับชั้น"]);
      const no = getStudentField(s, ["เลขที่", "ลำดับที่", "no"]);
      return Boolean(name || time || rawScore || (room && no));
    });
  }, [data?.students]);

  // ดึงรายชื่อคอลัมน์ที่เป็นคำถามข้อสอบจริง
  const questionColumns: string[] = useMemo(() => {
    const keysFromRows = new Set<string>();
    rawStudents.forEach(s => {
      Object.keys(s).forEach(k => {
        if (!isSystemOrProfileColumn(k) && String(k).trim()) {
          keysFromRows.add(k);
        }
      });
    });

    const headers = (data?.columnHeaders && Array.isArray(data.columnHeaders) && data.columnHeaders.length > 0)
      ? data.columnHeaders
      : Array.from(keysFromRows);

    const filtered = headers.filter((h: string) => !isSystemOrProfileColumn(h) && String(h).trim());
    return filtered.length > 0 ? filtered : Array.from(keysFromRows);
  }, [data?.columnHeaders, rawStudents]);

  // คำนวณคะแนนเต็ม (totalMax) อย่างแม่นยำ
  const totalMax = useMemo(() => {
    let maxEarned = 0;
    rawStudents.forEach(s => {
      const raw = getStudentField(s, ["คะแนน", "score", "total score", "points", "คะแนนรวม"]);
      if (raw) {
        const p = parseFloat(String(raw).split("/")[0]);
        if (!isNaN(p) && p > maxEarned) maxEarned = p;
      }
    });

    let headerMax = 0;
    const allHeaders = (data?.columnHeaders && data.columnHeaders.length > 0)
      ? data.columnHeaders
      : (rawStudents.length > 0 ? Object.keys(rawStudents[0]) : []);
    for (const h of allHeaders) {
      if (h.toLowerCase().includes("คะแนน") || h.toLowerCase().includes("score")) {
        const match = h.match(/(?:\/|เต็ม|out of|\()\s*(\d+(?:\.\d+)?)/i);
        if (match && parseFloat(match[1]) > 0) {
          headerMax = parseFloat(match[1]);
          break;
        }
      }
    }

    let denomMax = 0;
    rawStudents.forEach(s => {
      const raw = getStudentField(s, ["คะแนน", "score", "total score", "points", "คะแนนรวม"]);
      if (raw && String(raw).includes("/")) {
        const p = parseFloat(String(raw).split("/")[1]);
        if (!isNaN(p) && p > denomMax) denomMax = p;
      }
    });

    const qCount = questionColumns.length;
    const backendMax = (data?.totalMaxPoints && data.totalMaxPoints > 0)
      ? data.totalMaxPoints
      : (data?.stats?.totalScore ? parseFloat(data.stats.totalScore) : 0);

    let candidate = headerMax || denomMax;
    if (!candidate || candidate < maxEarned) {
      if (qCount > 0 && (backendMax <= 0 || (backendMax < qCount && maxEarned <= qCount) || backendMax < maxEarned)) {
        candidate = qCount;
      } else if (backendMax > 0 && backendMax >= maxEarned) {
        candidate = backendMax;
      } else {
        candidate = exam.question_count || qCount || 20;
      }
    }

    if (maxEarned > candidate) {
      candidate = Math.max(maxEarned, qCount);
    }

    return candidate > 0 ? candidate : 20;
  }, [data?.totalMaxPoints, data?.stats?.totalScore, data?.columnHeaders, rawStudents, questionColumns, exam.question_count]);

  const parseScore = (s: any, defaultTotal: number = totalMax) => {
    const raw = getStudentField(s, ["คะแนน", "score", "total score", "points", "คะแนนรวม"]);
    if (!raw) return { str: "-", earned: 0, total: defaultTotal, isPass: false };
    const rawStr = String(raw).trim();
    if (rawStr.includes("/")) {
      const parts = rawStr.split("/");
      const earned = parseFloat(parts[0]) || 0;
      const total = parseFloat(parts[1]) || defaultTotal;
      const effectiveTotal = Math.max(total, defaultTotal, earned);
      return {
        str: `${earned} / ${effectiveTotal}`,
        earned,
        total: effectiveTotal,
        isPass: earned >= Math.ceil(effectiveTotal * 0.5)
      };
    }
    const earned = parseFloat(rawStr) || 0;
    const effectiveTotal = Math.max(defaultTotal, earned);
    return {
      str: `${earned} / ${effectiveTotal}`,
      earned,
      total: effectiveTotal,
      isPass: earned >= Math.ceil(effectiveTotal * 0.5)
    };
  };

  // Descriptive Statistics Calculation
  const studentScores = rawStudents.map(s => parseScore(s, totalMax).earned).filter(n => !isNaN(n));
  const passThresh = Math.ceil(totalMax * 0.5);
  const totalCount = studentScores.length;
  const computedAvgNum = totalCount > 0 ? (studentScores.reduce((a, b) => a + b, 0) / totalCount) : 0;
  const computedAvg = totalCount > 0 ? computedAvgNum.toFixed(2) + " คะแนน" : "-";
  const computedMax = totalCount > 0 ? Math.max(...studentScores) + " คะแนน" : "-";
  const computedMin = totalCount > 0 ? Math.min(...studentScores) + " คะแนน" : "-";
  const computedPass = studentScores.filter(s => s >= passThresh).length;
  const computedFail = totalCount - computedPass;
  const computedPassRateNum = totalCount > 0 ? ((computedPass / totalCount) * 100) : 0;
  const computedPassRate = totalCount > 0 ? computedPassRateNum.toFixed(1) + "%" : "0%";

  const computedMedian = (() => {
    if (totalCount === 0) return "-";
    const sorted = [...studentScores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) return sorted[mid].toFixed(1) + " คะแนน";
    return (((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1)) + " คะแนน";
  })();

  const computedSd = (() => {
    if (totalCount <= 1) return "0.00";
    const variance = studentScores.reduce((acc, v) => acc + Math.pow(v - computedAvgNum, 2), 0) / (totalCount - 1);
    return Math.sqrt(variance).toFixed(2);
  })();

  const computedRange = totalCount > 0 ? (Math.max(...studentScores) - Math.min(...studentScores)).toFixed(1) + " คะแนน" : "-";

  const overallQuality = (() => {
    if (totalCount === 0) return { text: "รอข้อมูลผู้สอบ", color: "var(--gray-600)", bg: "var(--gray-100)" };
    const avgPct = (computedAvgNum / totalMax) * 100;
    if (avgPct >= 75) return { text: "🌟 ดีเยี่ยม (Mastery)", color: "#047857", bg: "#ECFDF5" };
    if (avgPct >= 60) return { text: "👍 ดี (Proficient)", color: "#1D4ED8", bg: "#EFF6FF" };
    if (avgPct >= 50) return { text: "🎯 ปานกลาง (Developing)", color: "#D97706", bg: "#FFFBEB" };
    return { text: "⚠️ ต้องพัฒนาเร่งด่วน (Needs Support)", color: "#DC2626", bg: "#FEF2F2" };
  })();

  // 5-Tier Performance Level Breakdown
  const scoreLevelCounts = {
    "ดีเยี่ยม": 0,
    "ดีมาก": 0,
    "ดี": 0,
    "ผ่านเกณฑ์": 0,
    "ต้องปรับปรุง": 0
  };

  rawStudents.forEach(s => {
    const sc = parseScore(s, totalMax);
    const sl = calculateScoreLevel(sc.earned, totalMax);
    scoreLevelCounts[sl.level as keyof typeof scoreLevelCounts]++;
  });

  // Classroom Analysis
  const roomsSet = new Set<string>();
  rawStudents.forEach(s => {
    const r = getStudentRoom(s);
    if (r) roomsSet.add(r);
  });
  const allRooms = Array.from(roomsSet).sort();

  const classroomAnalysis = allRooms.map(rm => {
    const rmStudents = rawStudents.filter(s => getStudentRoom(s) === rm);
    const rmScores = rmStudents.map(s => parseScore(s, totalMax).earned).filter(n => !isNaN(n));
    const rmCount = rmScores.length;
    const rmAvgNum = rmCount > 0 ? (rmScores.reduce((a, b) => a + b, 0) / rmCount) : 0;
    const rmMax = rmCount > 0 ? Math.max(...rmScores) : 0;
    const rmMin = rmCount > 0 ? Math.min(...rmScores) : 0;
    const rmPass = rmScores.filter(sc => sc >= passThresh).length;
    const rmFail = rmCount - rmPass;
    const rmPassPct = rmCount > 0 ? (rmPass / rmCount) * 100 : 0;
    const rmSd = rmCount > 1
      ? Math.sqrt(rmScores.reduce((acc, v) => acc + Math.pow(v - rmAvgNum, 2), 0) / (rmCount - 1))
      : 0;

    const atRisk = rmScores.filter(sc => sc < passThresh).length;
    let tierLabel = "ดี";
    let tierColor = "#1D4ED8";
    let tierBg = "#EFF6FF";
    const rmPct = (rmAvgNum / totalMax) * 100;
    if (rmPct >= 75) { tierLabel = "ดีเยี่ยม"; tierColor = "#047857"; tierBg = "#ECFDF5"; }
    else if (rmPct >= 65) { tierLabel = "ดีมาก"; tierColor = "#059669"; tierBg = "#F0FDF4"; }
    else if (rmPct >= 50) { tierLabel = "ผ่านเกณฑ์"; tierColor = "#D97706"; tierBg = "#FFFBEB"; }
    else { tierLabel = "ต้องพัฒนา"; tierColor = "#DC2626"; tierBg = "#FEF2F2"; }

    return {
      room: rm,
      count: rmCount,
      avgNum: rmAvgNum,
      avgStr: rmCount > 0 ? rmAvgNum.toFixed(2) : "-",
      avgPct: rmCount > 0 ? rmPct.toFixed(1) + "%" : "0%",
      max: rmCount > 0 ? rmMax : "-",
      min: rmCount > 0 ? rmMin : "-",
      sd: rmCount > 1 ? rmSd.toFixed(2) : "-",
      passCount: rmPass,
      failCount: rmFail,
      passPct: rmPassPct,
      passRateStr: rmCount > 0 ? rmPassPct.toFixed(1) + "%" : "0%",
      atRiskCount: atRisk,
      tierLabel,
      tierColor,
      tierBg,
      students: rmStudents
    };
  }).sort((a, b) => b.avgNum - a.avgNum);

  // Item Analysis (วิเคราะห์ข้อสอบรายข้อ) จากคำตอบจริงของนักเรียน
  const itemAnalysis = questionColumns.map((colName: string, idx: number) => {
    const responses = rawStudents.map(s => getSafeStr(s[colName])).filter(v => v !== "" && v !== "-");
    const totalResponses = responses.length;
    const freqMap: Record<string, number> = {};
    responses.forEach(r => {
      freqMap[r] = (freqMap[r] || 0) + 1;
    });
    const sortedChoices = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
    const topChoice = sortedChoices[0] || ["-", 0];
    const topChoicePct = totalResponses > 0 ? (topChoice[1] / totalResponses) * 100 : 0;

    // ตรวจจับลักษณะข้อสอบว่าเป็น ข้อสอบอัตนัย / เขียนบรรยาย หรือไม่
    const avgLen = totalResponses > 0 ? (responses.reduce((sum, r) => sum + r.length, 0) / totalResponses) : 0;
    const isSubjectiveKeyword = /(อัตนัย|บรรยาย|อธิบาย|แสดงวิธีทำ|จงเขียน|ความคิดเห็น|essay|paragraph|ข้อเขียน)/i.test(colName);
    const isHighVariance = totalResponses >= 4 && (sortedChoices.length / totalResponses) > 0.5 && avgLen > 15;
    const isSubjective = isSubjectiveKeyword || avgLen > 28 || isHighVariance;

    let difficultyLabel = "ปานกลาง (เหมาะสม)";
    let difficultyColor = "#D97706";
    let difficultyBg = "#FFFBEB";

    if (isSubjective) {
      difficultyLabel = "ข้อสอบอัตนัย (รอครูตรวจให้คะแนน)";
      difficultyColor = "#7C3AED";
      difficultyBg = "#F5F3FF";
    } else if (topChoicePct >= 70) {
      difficultyLabel = "ค่อนข้างง่าย (เข้าใจดี)";
      difficultyColor = "#047857";
      difficultyBg = "#ECFDF5";
    } else if (topChoicePct < 40) {
      difficultyLabel = "ค่อนข้างยาก (ควรทบทวน)";
      difficultyColor = "#DC2626";
      difficultyBg = "#FEF2F2";
    }

    return {
      index: idx + 1,
      title: colName,
      totalResponses,
      isSubjective,
      avgLen: Math.round(avgLen),
      topChoice: isSubjective ? `คำตอบเขียนบรรยาย (${sortedChoices.length} รูปแบบ)` : topChoice[0],
      topChoiceCount: topChoice[1],
      topChoicePct: isSubjective ? 100 : topChoicePct,
      choices: sortedChoices,
      distinctCount: sortedChoices.length,
      difficultyLabel,
      difficultyColor,
      difficultyBg
    };
  });

  const sortedByConsensus = [...itemAnalysis].sort((a, b) => b.topChoicePct - a.topChoicePct);
  const topMasteryQuestions = sortedByConsensus.slice(0, 3);
  const topConfusingQuestions = [...itemAnalysis].sort((a, b) => a.topChoicePct - b.topChoicePct).slice(0, 3);

  // At-Risk Student Intervention (<50%)
  const atRiskStudents = rawStudents.filter(s => parseScore(s, totalMax).earned < passThresh);

  const copyAtRiskList = () => {
    if (atRiskStudents.length === 0) return;
    const lines = [
      `🚨 รายชื่อนักเรียนกลุ่มเสี่ยง / ต้องช่วยเหลือเร่งด่วน (<50%)`,
      `แบบทดสอบ: ${exam.form_title}`,
      `คะแนนเต็ม: ${totalMax} คะแนน | เกณฑ์ผ่าน: ${passThresh} คะแนน`,
      `จำนวนนักเรียนกลุ่มเสี่ยง: ${atRiskStudents.length} คน`,
      `---------------------------------------`,
      ...atRiskStudents.map((s, idx) => {
        const no = getStudentField(s, ["เลขที่", "ลำดับที่", "no.", "no"]);
        const name = getStudentField(s, ["ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อ", "Name"]);
        const room = getStudentRoom(s);
        const score = parseScore(s, totalMax);
        const gap = passThresh - score.earned;
        return `${idx + 1}. [ห้อง ${room}${no ? ` เลขที่ ${no}` : ""}] ${name || "ไม่ระบุชื่อ"} - ได้ ${score.earned}/${totalMax} คะแนน (ขาดอีก ${gap > 0 ? gap : 1} คะแนน)`;
      })
    ];
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
    setAtRiskCopied(true);
    setTimeout(() => setAtRiskCopied(false), 2500);
  };

  // Filter & Sort Students
  const filteredStudents = rawStudents.filter(s => {
    const text = Object.values(s).map(v => getSafeStr(v)).join(" ").toLowerCase();
    const matchSearch = !searchTerm || text.includes(searchTerm.toLowerCase());
    const studentRoom = getStudentRoom(s);
    const matchR = roomFilter === "all" || studentRoom === roomFilter || studentRoom.includes(roomFilter);
    return matchSearch && matchR;
  });

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
      const tA = getStudentField(a, ["ประทับเวลา", "timestamp", "time"]);
      const tB = getStudentField(b, ["ประทับเวลา", "timestamp", "time"]);
      return tB.localeCompare(tA);
    });
  };

  const sortedStudents = sortStudentList(filteredStudents);

  const handleOpenGrading = (student: any) => {
    setGradingStudent(student);
    const parsed = parseScore(student, totalMax);
    setNewScoreInput(String(parsed.earned));
    setGradeSuccessMsg("");
    setGradeErrorMsg("");

    // เตรียมคะแนนรายข้อเริ่มต้นสำหรับตรวจข้อสอบอัตนัย
    const qaList = getStudentQuestionAnswers(student);
    const initScores: Record<number, number> = {};
    const defaultPtsPerQ = qaList.length > 0 ? (totalMax / qaList.length) : 1;
    qaList.forEach((_qa, idx) => {
      initScores[idx] = defaultPtsPerQ;
    });
    setQuestionScores(initScores);
  };

  const handleQuestionScoreChange = (qIdx: number, val: string) => {
    const num = val === "" ? 0 : parseFloat(val);
    const updated = { ...questionScores, [qIdx]: isNaN(num) ? 0 : num };
    setQuestionScores(updated);

    // รวมคะแนนรายข้อทั้งหมดเข้าสู่คะแนนรวมโดยอัตโนมัติ
    const sum = Object.values(updated).reduce((acc, v) => acc + (typeof v === "number" ? v : 0), 0);
    setNewScoreInput(String(Math.round(sum * 10) / 10));
  };

  const getStudentQuestionAnswers = (s: any) => {
    if (!s || typeof s !== "object") return [];
    return Object.entries(s)
      .filter(([k]) => !isSystemOrProfileColumn(k))
      .map(([qTitle, answerVal]) => {
        const manualInfo = data?.manualQuestions?.find((mq: any) => {
          const mText = typeof mq === "string" ? mq : mq?.text;
          return mText && (qTitle === mText || qTitle.includes(mText) || mText.includes(qTitle));
        });

        const strAns = getSafeStr(answerVal);
        const isSubjectiveKeyword = /(อัตนัย|บรรยาย|อธิบาย|แสดงวิธีทำ|จงเขียน|ความคิดเห็น|essay|paragraph|ข้อเขียน|เติมคำ)/i.test(qTitle);
        const isLongText = strAns.length >= 25;
        const isManual = Boolean(manualInfo) || isSubjectiveKeyword || isLongText;
        const guideline = (typeof manualInfo === "object" ? manualInfo?.answerText : "") || "";

        return {
          title: qTitle,
          answer: strAns,
          isManual,
          guideline
        };
      });
  };

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
    setGradeSuccessMsg("");
    setGradeErrorMsg("");

    try {
      const rowIndex = gradingStudent._rowIndex;
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "update_score",
          sheetUrl: exam.sheet_url,
          sheetId: exam.sheet_url.match(/[-\w]{25,}/)?.[0] || exam.sheet_url.trim(),
          rowIndex: rowIndex,
          newScore: earnedVal,
          totalMax: totalMax
        })
      });

      const resJson = await res.json();
      if (resJson && resJson.success) {
        setGradeSuccessMsg(`✅ บันทึกคะแนนสำเร็จ (${earnedVal} / ${totalMax})`);
        setData((prev: any) => {
          if (!prev || !prev.students) return prev;
          const updated = prev.students.map((st: any) => {
            if (st._rowIndex === rowIndex) {
              return {
                ...st,
                "คะแนน": `${earnedVal} / ${totalMax}`,
                "score": `${earnedVal} / ${totalMax}`
              };
            }
            return st;
          });
          return { ...prev, students: updated };
        });
        setTimeout(() => {
          setGradingStudent(null);
        }, 1200);
      } else {
        setGradeErrorMsg(resJson.error || "เกิดข้อผิดพลาดในการบันทึกคะแนน");
      }
    } catch (e: any) {
      setGradeErrorMsg(e.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSavingScore(false);
    }
  };

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
            ← กลับไปดูภาพรวมทั้งโรงเรียน
          </button>
          <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
            <button className="btn btn-secondary btn-sm" onClick={() => loadData(true)} disabled={loading}>
              <RefreshIcon /> รีเฟรชคะแนน
            </button>
            {exam.sheet_url && (
              <button className="btn btn-sm" onClick={() => window.open(exam.sheet_url, "_blank")} style={{background:"#0F9D58", color:"white", fontWeight:600}}>
                <SheetIcon /> เปิดใน Google Sheets
              </button>
            )}
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
            <div style={{display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4}}>
              {isSchoolUser && (
                <div style={{fontSize: 12, fontWeight: 700, color: "var(--crimson)", display: "flex", alignItems: "center", gap: 6}}>
                  <span>🏫 โรงเรียนวังหลวงพิทยาสรรพ์</span>
                  <span style={{background: "var(--amber-100)", color: "var(--amber-800)", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800}}>ว.พ.</span>
                </div>
              )}
              {(() => {
                const sg = getExamSubjectGroup(exam);
                return (
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: sg.bgColor,
                    color: sg.color,
                    border: `1px solid ${sg.color}40`,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4
                  }}>
                    <span>{sg.icon}</span>
                    <span>{sg.name}</span>
                  </span>
                );
              })()}
            </div>
            <h1 style={{fontSize: 19, fontWeight: 700, color: "var(--gray-900)", margin: 0}}>
              {exam.form_title}
            </h1>
            <div style={{fontSize: 12.5, color: "var(--gray-600)", marginTop: 4}}>
              {exam.form_desc || "ไม่มีคำอธิบายชุดข้อสอบ"}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: "flex",
          gap: 6,
          marginTop: 18,
          borderBottom: "1px solid var(--gray-200)",
          overflowX: "auto",
          paddingBottom: 0
        }}>
          {[
            { id: "overview", label: "📊 ภาพรวมและแจกแจงผลสอบ", count: null },
            { id: "classroom", label: "🏫 เปรียบเทียบห้องเรียน", count: classroomAnalysis.length > 0 ? `${classroomAnalysis.length} ห้อง` : null },
            { id: "item_analysis", label: "🎯 วิเคราะห์ข้อสอบรายข้อ", count: questionColumns.length > 0 ? `${questionColumns.length} ข้อ` : null },
            { id: "at_risk", label: "🚨 นักเรียนกลุ่มเสี่ยงช่วยเหลือเร่งด่วน", count: atRiskStudents.length > 0 ? `${atRiskStudents.length} คน` : null, isAlert: atRiskStudents.length > 0 },
            { id: "students", label: "👥 รายชื่อและผลคะแนน", count: rawStudents.length > 0 ? `${rawStudents.length} คน` : null },
            { id: "sheet", label: "📄 แผ่นงาน Google Sheets ตัวจริง", count: null },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              style={{
                background: "none",
                border: "none",
                borderBottom: activeTab === t.id ? "3px solid var(--crimson)" : "3px solid transparent",
                padding: "8px 14px",
                fontSize: 13.5,
                fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? "var(--crimson)" : (t.isAlert ? "#DC2626" : "var(--gray-600)"),
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                transition: "all .2s"
              }}>
              <span>{t.label}</span>
              {t.count !== null && (
                <span style={{
                  background: t.isAlert
                    ? (activeTab === t.id ? "#DC2626" : "#FEE2E2")
                    : (activeTab === t.id ? "var(--crimson)" : "var(--gray-200)"),
                  color: t.isAlert
                    ? (activeTab === t.id ? "white" : "#DC2626")
                    : (activeTab === t.id ? "white" : "var(--gray-700)"),
                  padding: "2px 7px",
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* FULL LOADING GUARD: แสดงสถานะการโหลดสดต่อเนื่อง และไม่เรนเดอร์แท็บใด ๆ จนกว่าจะได้คะแนนจริง */}
      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "64px 20px" }}>
          <div className="spinner" style={{ width: 44, height: 44, margin: "0 auto 16px", borderColor: "var(--crimson)", borderTopColor: "transparent" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-800)", marginBottom: 8 }}>
            {loadingStatus}
          </div>
          <div style={{ fontSize: 13, color: "var(--gray-500)", maxWidth: 500, margin: "0 auto 16px" }}>
            ระบบกำลังดึงข้อมูลคะแนนจริงและคำตอบรายข้อของนักเรียนจาก Google Sheets เพื่อคำนวณสถิติและตารางวิเคราะห์คุณภาพข้อสอบ (Item Analysis)...
          </div>
          {retryCount > 0 && (
            <div style={{ fontSize: 12, color: "#92400E", background: "#FEF3C7", border: "1px solid #FCD34D", padding: "6px 16px", borderRadius: 20, display: "inline-block" }}>
              ⏳ กำลังพยายามเชื่อมต่อใหม่อัตโนมัติ (ครั้งที่ {retryCount})... หรือกดปุ่มด้านล่างเพื่อลองทันที
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-sm btn-secondary" onClick={() => loadData(true)}>
              🔄 ลองเชื่อมต่อใหม่อีกครั้ง
            </button>
          </div>
        </div>
      ) : error && rawStudents.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px", border: "1.5px solid #FECACA", background: "#FEF2F2" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#DC2626", marginBottom: 6 }}>
            ไม่สามารถเชื่อมต่อข้อมูลคะแนนจาก Google Sheets ได้
          </div>
          <div style={{ fontSize: 13, color: "#991B1B", marginBottom: 16 }}>
            {error}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-sm" onClick={() => loadData(true)} style={{ background: "var(--crimson)", color: "white", fontWeight: 700 }}>
              🔄 ลองโหลดข้อมูลใหม่อีกครั้ง
            </button>
            {exam.sheet_url && (
              <button className="btn btn-sm btn-secondary" onClick={() => window.open(exam.sheet_url, "_blank")} style={{ background: "white" }}>
                เปิด Google Sheets โดยตรง ↗
              </button>
            )}
          </div>
        </div>
      ) : rawStudents.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "56px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-800)", marginBottom: 6 }}>
            ยังไม่มีนักเรียนส่งคำตอบในข้อสอบชุดนี้ (0 คน)
          </div>
          <div style={{ fontSize: 13, color: "var(--gray-500)", maxWidth: 450, margin: "0 auto 16px" }}>
            เมื่อนักเรียนทำข้อสอบผ่าน Google Forms ข้อมูลจะถูกบันทึกลงใน Google Sheets โดยอัตโนมัติ คุณครูสามารถกดรีเฟรชเพื่อตรวจสอบผลได้ตลอดเวลา
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-sm btn-secondary" onClick={() => loadData(true)}>
              🔄 ตรวจสอบการส่งข้อสอบอีกครั้ง
            </button>
            {exam.sheet_url && (
              <button className="btn btn-sm btn-secondary" onClick={() => window.open(exam.sheet_url, "_blank")}>
                เปิดดูชีต ↗
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Live Data Success Banner */}
          <div style={{
            background: "linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)",
            border: "1.5px solid #10B981",
            borderRadius: "var(--radius-lg)",
            padding: "12px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.12)"
          }}>
            <div style={{display: "flex", alignItems: "center", gap: 10}}>
              <span style={{fontSize: 22}}>✅</span>
              <div>
                <div style={{fontSize: 13.5, fontWeight: 700, color: "#065F46"}}>
                  เชื่อมต่อและดึงคะแนนจริงจาก Google Sheets สำเร็จ ({rawStudents.length} คน | {classroomAnalysis.length} ห้องเรียน)
                </div>
                <div style={{fontSize: 12, color: "#047857", marginTop: 2}}>
                  คะแนนเฉลี่ย: <strong>{computedAvg}</strong> | อัตราสอบผ่าน: <strong>{computedPassRate}</strong> ({computedPass} คน) | คะแนนเต็ม: {totalMax} คะแนน | ข้อสอบ: {questionColumns.length} ข้อ
                </div>
              </div>
            </div>
            <div style={{display: "flex", gap: 8, alignItems: "center"}}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => loadData(true)}
                style={{background: "#059669", color: "white", fontSize: 12, fontWeight: 700, boxShadow: "0 2px 6px rgba(5,150,105,0.3)"}}>
                🔄 ดึงคะแนนสดล่าสุด
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => window.open(exam.sheet_url, "_blank")}
                style={{background: "white", borderColor: "#A7F3D0", color: "#065F46", fontSize: 12}}>
                เปิด Google Sheet ↗
              </button>
            </div>
          </div>

          {/* ==================== TAB 1: OVERVIEW & GRADE BANDS ==================== */}
          {activeTab === "overview" && (
            <div>
              {/* Executive Summary Cards */}
              <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20}}>
                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid var(--crimson)"}}>
                  <div style={{fontSize: 12, color: "var(--gray-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5}}>
                    ผู้เข้าสอบทั้งหมด
                  </div>
                  <div style={{fontSize: 28, fontWeight: 800, color: "var(--gray-900)", marginTop: 4}}>
                    {totalCount} <span style={{fontSize: 14, fontWeight: 500, color: "var(--gray-500)"}}>คน</span>
                  </div>
                  <div style={{fontSize: 11.5, color: "var(--gray-600)", marginTop: 4}}>
                    ครอบคลุม {classroomAnalysis.length} ห้องเรียน
                  </div>
                </div>

                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #2563EB"}}>
                  <div style={{fontSize: 12, color: "var(--gray-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5}}>
                    คะแนนเฉลี่ย (Mean)
                  </div>
                  <div style={{fontSize: 28, fontWeight: 800, color: "#1E3A8A", marginTop: 4}}>
                    {computedAvgNum.toFixed(2)} <span style={{fontSize: 14, fontWeight: 500, color: "var(--gray-500)"}}>/ {totalMax}</span>
                  </div>
                  <div style={{fontSize: 11.5, color: "#2563EB", marginTop: 4, fontWeight: 600}}>
                    คิดเป็น {totalMax > 0 ? ((computedAvgNum / totalMax) * 100).toFixed(1) : 0}% ของคะแนนเต็ม
                  </div>
                </div>

                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #059669"}}>
                  <div style={{fontSize: 12, color: "var(--gray-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5}}>
                    อัตราการสอบผ่าน (≥50%)
                  </div>
                  <div style={{fontSize: 28, fontWeight: 800, color: "#065F46", marginTop: 4}}>
                    {computedPassRate}
                  </div>
                  <div style={{fontSize: 11.5, color: "#059669", marginTop: 4, fontWeight: 600}}>
                    ผ่าน {computedPass} คน | ไม่ผ่าน {computedFail} คน
                  </div>
                </div>

                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #7C3AED"}}>
                  <div style={{fontSize: 12, color: "var(--gray-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5}}>
                    ระดับคุณภาพโดยรวม
                  </div>
                  <div style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 20,
                    background: overallQuality.bg,
                    color: overallQuality.color,
                    fontWeight: 700,
                    fontSize: 13.5,
                    marginTop: 8
                  }}>
                    {overallQuality.text}
                  </div>
                  <div style={{fontSize: 11.5, color: "var(--gray-600)", marginTop: 6}}>
                    ส่วนเบี่ยงเบนมาตรฐาน SD: {computedSd}
                  </div>
                </div>
              </div>

              {/* 5 Performance Bands (เกณฑ์ 5 ระดับผลคะแนนสอบ) */}
              <div className="card" style={{marginBottom: 20}}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6}}>
                  <div className="card-title" style={{margin:0}}>
                    📊 การกระจายตัวตาม 5 ระดับผลคะแนนสอบ (Performance Bands)
                  </div>
                  <span style={{fontSize: 12, color: "var(--gray-500)"}}>
                    ตามเกณฑ์ร้อยละความสามารถทางวิชาการ (ไม่มีเกรด 0-4)
                  </span>
                </div>
                <div className="card-sub" style={{marginBottom: 16}}>
                  การจัดกลุ่มระดับความสามารถของผู้เรียนเพื่อการวินิจฉัยและพัฒนาคุณภาพการเรียนรู้
                </div>

                <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12}}>
                  {[
                    { level: "ดีเยี่ยม", range: "80-100%", count: scoreLevelCounts["ดีเยี่ยม"], color: "#047857", bg: "#ECFDF5", border: "#A7F3D0", desc: "เข้าใจลึกซึ้ง บรรลุผลสัมฤทธิ์ระดับสูง" },
                    { level: "ดีมาก", range: "70-79%", count: scoreLevelCounts["ดีมาก"], color: "#059669", bg: "#F0FDF4", border: "#BBF7D0", desc: "เข้าใจเนื้อหาเป็นอย่างดี มีทักษะประยุกต์" },
                    { level: "ดี", range: "60-69%", count: scoreLevelCounts["ดี"], color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE", desc: "เข้าใจตามเกณฑ์มาตรฐาน พัฒนาต่อยอดได้" },
                    { level: "ผ่านเกณฑ์", range: "50-59%", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", count: scoreLevelCounts["ผ่านเกณฑ์"], desc: "ผ่านเกณฑ์ขั้นต่ำ ควรเสริมแรงจุดอ่อน" },
                    { level: "ต้องปรับปรุง", range: "ต่ำกว่า 50%", count: scoreLevelCounts["ต้องปรับปรุง"], color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", desc: "ต้องได้รับการสอนเสริมช่วยเหลือเร่งด่วน" },
                  ].map(b => {
                    const pct = totalCount > 0 ? (b.count / totalCount) * 100 : 0;
                    return (
                      <div
                        key={b.level}
                        style={{
                          background: b.bg,
                          border: `1.5px solid ${b.border}`,
                          borderRadius: "var(--radius)",
                          padding: "16px 14px",
                          position: "relative",
                          transition: "all .2s"
                        }}>
                        <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4}}>
                          <span style={{fontWeight: 700, color: b.color, fontSize: 15}}>{b.level}</span>
                          <span style={{fontSize: 11.5, color: "var(--gray-600)", fontWeight: 600}}>{b.range}</span>
                        </div>
                        <div style={{display: "flex", alignItems: "baseline", gap: 6, margin: "8px 0 4px"}}>
                          <span style={{fontSize: 26, fontWeight: 800, color: b.color}}>{b.count}</span>
                          <span style={{fontSize: 13, color: "var(--gray-600)", fontWeight: 600}}>คน ({pct.toFixed(1)}%)</span>
                        </div>
                        <div style={{
                          height: 6,
                          background: "rgba(0,0,0,0.06)",
                          borderRadius: 3,
                          overflow: "hidden",
                          marginBottom: 8
                        }}>
                          <div style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: b.color,
                            borderRadius: 3,
                            transition: "width .5s ease"
                          }} />
                        </div>
                        <div style={{fontSize: 11, color: "var(--gray-600)", lineHeight: 1.3}}>
                          {b.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Descriptive Statistics Table */}
              <div className="card">
                <div className="card-title" style={{marginBottom: 4}}>
                  📐 สถิติพรรณนาเชิงลึก (Descriptive Statistics)
                </div>
                <div className="card-sub" style={{marginBottom: 16}}>
                  ค่าสถิติเชิงลึกสำหรับการประกันคุณภาพการศึกษาและการประเมินความเที่ยงตรง
                </div>

                <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14}}>
                  <div style={{background: "var(--gray-50)", padding: 12, borderRadius: 8}}>
                    <div style={{fontSize: 11.5, color: "var(--gray-500)", fontWeight: 600}}>มัธยฐาน (Median)</div>
                    <div style={{fontSize: 18, fontWeight: 700, color: "var(--gray-800)", marginTop: 2}}>{computedMedian}</div>
                    <div style={{fontSize: 11, color: "var(--gray-500)", marginTop: 2}}>จุดกึ่งกลางของชุดคะแนน</div>
                  </div>

                  <div style={{background: "var(--gray-50)", padding: 12, borderRadius: 8}}>
                    <div style={{fontSize: 11.5, color: "var(--gray-500)", fontWeight: 600}}>คะแนนสูงสุด (Max)</div>
                    <div style={{fontSize: 18, fontWeight: 700, color: "#047857", marginTop: 2}}>{computedMax}</div>
                    <div style={{fontSize: 11, color: "var(--gray-500)", marginTop: 2}}>คะแนนที่ทำได้สูงสุดในรุ่น</div>
                  </div>

                  <div style={{background: "var(--gray-50)", padding: 12, borderRadius: 8}}>
                    <div style={{fontSize: 11.5, color: "var(--gray-500)", fontWeight: 600}}>คะแนนต่ำสุด (Min)</div>
                    <div style={{fontSize: 18, fontWeight: 700, color: "#DC2626", marginTop: 2}}>{computedMin}</div>
                    <div style={{fontSize: 11, color: "var(--gray-500)", marginTop: 2}}>คะแนนที่ต่ำที่สุดในรุ่น</div>
                  </div>

                  <div style={{background: "var(--gray-50)", padding: 12, borderRadius: 8}}>
                    <div style={{fontSize: 11.5, color: "var(--gray-500)", fontWeight: 600}}>พิสัย (Range)</div>
                    <div style={{fontSize: 18, fontWeight: 700, color: "var(--gray-800)", marginTop: 2}}>{computedRange}</div>
                    <div style={{fontSize: 11, color: "var(--gray-500)", marginTop: 2}}>ระยะห่างระหว่างคะแนนสูงสุด-ต่ำสุด</div>
                  </div>

                  <div style={{background: "var(--gray-50)", padding: 12, borderRadius: 8}}>
                    <div style={{fontSize: 11.5, color: "var(--gray-500)", fontWeight: 600}}>ส่วนเบี่ยงเบนมาตรฐาน (SD)</div>
                    <div style={{fontSize: 18, fontWeight: 700, color: "var(--gray-800)", marginTop: 2}}>{computedSd}</div>
                    <div style={{fontSize: 11, color: "var(--gray-500)", marginTop: 2}}>การกระจายตัวรอบค่าเฉลี่ย</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: CLASSROOM COMPARISON ==================== */}
          {activeTab === "classroom" && (
            <div>
              <div className="card">
                <div className="card-title" style={{marginBottom: 4}}>
                  🏫 ผลการวิเคราะห์เปรียบเทียบรายห้องเรียน ({classroomAnalysis.length} ห้อง)
                </div>
                <div className="card-sub" style={{marginBottom: 16}}>
                  เปรียบเทียบคะแนนเฉลี่ย อัตราการสอบผ่าน และนักเรียนกลุ่มเสี่ยงในแต่ละห้อง
                </div>

                {classroomAnalysis.length === 0 ? (
                  <div style={{textAlign: "center", padding: 30, color: "var(--gray-500)"}}>ไม่พบข้อมูลห้องเรียน</div>
                ) : (
                  <div style={{overflowX: "auto"}}>
                    <table style={{width: "100%", borderCollapse: "collapse", fontSize: 13}}>
                      <thead>
                        <tr style={{background: "var(--gray-50)", borderBottom: "2px solid var(--gray-200)"}}>
                          <th style={{padding: "10px 12px", textAlign: "left"}}>ห้องเรียน</th>
                          <th style={{padding: "10px 12px", textAlign: "center"}}>จำนวนผู้สอบ</th>
                          <th style={{padding: "10px 12px", textAlign: "center"}}>คะแนนเฉลี่ย</th>
                          <th style={{padding: "10px 12px", textAlign: "center"}}>ร้อยละเฉลี่ย</th>
                          <th style={{padding: "10px 12px", textAlign: "center"}}>อัตราสอบผ่าน (≥50%)</th>
                          <th style={{padding: "10px 12px", textAlign: "center"}}>สูงสุด / ต่ำสุด</th>
                          <th style={{padding: "10px 12px", textAlign: "center"}}>ส่วนเบี่ยงเบน (SD)</th>
                          <th style={{padding: "10px 12px", textAlign: "center"}}>กลุ่มเสี่ยง (&lt;50%)</th>
                          <th style={{padding: "10px 12px", textAlign: "center"}}>ระดับคุณภาพ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classroomAnalysis.map((rm) => (
                          <tr key={rm.room} style={{borderBottom: "1px solid var(--gray-100)"}}>
                            <td style={{padding: "10px 12px", fontWeight: 700, color: "var(--gray-900)"}}>
                              {rm.room}
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center"}}>
                              {rm.count} คน
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "var(--crimson)"}}>
                              {rm.avgStr} <span style={{fontSize: 11, fontWeight: 500, color: "var(--gray-500)"}}>/ {totalMax}</span>
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 600}}>
                              {rm.avgPct}
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center"}}>
                              <div style={{fontWeight: 700, color: rm.passPct >= 70 ? "#047857" : rm.passPct >= 50 ? "#D97706" : "#DC2626"}}>
                                {rm.passRateStr}
                              </div>
                              <div style={{fontSize: 11, color: "var(--gray-500)"}}>({rm.passCount}/{rm.count} คน)</div>
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center", fontSize: 12}}>
                              <span style={{color: "#047857", fontWeight: 600}}>{rm.max}</span> / <span style={{color: "#DC2626", fontWeight: 600}}>{rm.min}</span>
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center", color: "var(--gray-600)"}}>
                              {rm.sd}
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center"}}>
                              {rm.atRiskCount > 0 ? (
                                <span style={{background: "#FEE2E2", color: "#DC2626", padding: "2px 8px", borderRadius: 10, fontWeight: 700, fontSize: 12}}>
                                  {rm.atRiskCount} คน
                                </span>
                              ) : (
                                <span style={{color: "#059669", fontWeight: 600, fontSize: 12}}>0 คน</span>
                              )}
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center"}}>
                              <span style={{
                                padding: "3px 10px",
                                borderRadius: 12,
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: rm.tierBg,
                                color: rm.tierColor
                              }}>
                                {rm.tierLabel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 3: ITEM ANALYSIS (วิเคราะห์ข้อสอบรายข้อ) ==================== */}
          {activeTab === "item_analysis" && (
            <div>
              {/* Executive Highlights */}
              <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 20}}>
                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #059669", background: "linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)"}}>
                  <div style={{fontSize: 13, fontWeight: 700, color: "#047857", marginBottom: 6}}>
                    🟢 ข้อที่ผู้เรียนตอบได้ดีที่สุด (Top High Mastery)
                  </div>
                  <div style={{fontSize: 12.5, color: "var(--gray-600)", marginBottom: 8}}>
                    เนื้อหาในข้อเหล่านี้ นักเรียนส่วนใหญ่ทำความเข้าใจได้ดีมาก
                  </div>
                  <div style={{display: "grid", gap: 6}}>
                    {topMasteryQuestions.map((q: any) => (
                      <div key={q.index} style={{fontSize: 12.5, display: "flex", justifyContent: "space-between", background: "white", padding: "6px 10px", borderRadius: 6, border: "1px solid #A7F3D0"}}>
                        <span style={{fontWeight: 600, color: "#065F46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%"}}>
                          ข้อ {q.index}. {q.title}
                        </span>
                        <strong style={{color: "#059669"}}>{q.topChoicePct.toFixed(0)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #DC2626", background: "linear-gradient(135deg, #FFFFFF 0%, #FEF2F2 100%)"}}>
                  <div style={{fontSize: 13, fontWeight: 700, color: "#DC2626", marginBottom: 6}}>
                    🔴 ข้อที่นักเรียนตอบสับสนสูงสุด (Needs Revision / Review)
                  </div>
                  <div style={{fontSize: 12.5, color: "var(--gray-600)", marginBottom: 8}}>
                    คำตอบกระจายตัวสูง แนะนำให้คุณครูนำข้อเหล่านี้มาเฉลยและทบทวนในห้องเรียน
                  </div>
                  <div style={{display: "grid", gap: 6}}>
                    {topConfusingQuestions.map((q: any) => (
                      <div key={q.index} style={{fontSize: 12.5, display: "flex", justifyContent: "space-between", background: "white", padding: "6px 10px", borderRadius: 6, border: "1px solid #FECACA"}}>
                        <span style={{fontWeight: 600, color: "#991B1B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%"}}>
                          ข้อ {q.index}. {q.title}
                        </span>
                        <strong style={{color: "#DC2626"}}>กระจายตัวสูง</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Item Analysis Table */}
              <div className="card">
                <div className="card-title" style={{marginBottom: 4}}>
                  🎯 ตารางวิเคราะห์คุณภาพข้อสอบรายข้อ (Item Analysis)
                </div>
                <div className="card-sub" style={{marginBottom: 16}}>
                  คำนวณจากคำตอบจริงของนักเรียนทั้งหมด {rawStudents.length} คน • คลิกปุ่ม "ดูแจกแจงตัวเลือก 🔍" เพื่อดูสัดส่วนตัวเลือกทั้งหมด
                </div>

                {itemAnalysis.length === 0 ? (
                  <div style={{textAlign: "center", padding: 30, color: "var(--gray-500)"}}>
                    ชีตนี้บันทึกเฉพาะคะแนนรวม และไม่มีคอลัมน์คำถามรายข้อ
                  </div>
                ) : (
                  <div style={{overflowX: "auto"}}>
                    <table style={{width: "100%", borderCollapse: "collapse", fontSize: 13}}>
                      <thead>
                        <tr style={{background: "var(--gray-50)", borderBottom: "2px solid var(--gray-200)"}}>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 60}}>ข้อที่</th>
                          <th style={{padding: "10px 12px", textAlign: "left"}}>คำถาม / โจทย์</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 100}}>ผู้ตอบ (คน)</th>
                          <th style={{padding: "10px 12px", textAlign: "left", width: 220}}>คำตอบยอดนิยม (Most Popular)</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 110}}>สัดส่วน (%)</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 160}}>ระดับความยากง่าย</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 140}}>การแจกแจง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemAnalysis.map((q: any) => (
                          <tr key={q.index} style={{borderBottom: "1px solid var(--gray-100)"}}>
                            <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 700}}>
                              #{q.index}
                            </td>
                            <td style={{padding: "10px 12px", fontWeight: 600, color: "var(--gray-900)"}}>
                              {q.title}
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center"}}>
                              {q.totalResponses} คน
                            </td>
                            <td style={{padding: "10px 12px", color: "var(--gray-700)", fontSize: 12.5}}>
                              {q.isSubjective ? (
                                <span style={{
                                  background: "#F5F3FF",
                                  color: "#7C3AED",
                                  border: "1px solid #DDD6FE",
                                  padding: "2px 8px",
                                  borderRadius: 8,
                                  fontWeight: 700,
                                  fontSize: 11.5,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }}>
                                  ✍️ อัตนัย ({q.distinctCount} รูปแบบ)
                                </span>
                              ) : (
                                <div style={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 210}}>
                                  {q.topChoice}
                                </div>
                              )}
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 700, color: q.difficultyColor}}>
                              {q.isSubjective ? (
                                <span style={{fontSize: 11, color: "#7C3AED", fontWeight: 700}}>เขียนบรรยาย</span>
                              ) : (
                                `${q.topChoicePct.toFixed(1)}%`
                              )}
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center"}}>
                              <span style={{
                                padding: "3px 9px",
                                borderRadius: 10,
                                fontSize: 11.5,
                                fontWeight: 700,
                                background: q.difficultyBg,
                                color: q.difficultyColor
                              }}>
                                {q.difficultyLabel}
                              </span>
                            </td>
                            <td style={{padding: "10px 12px", textAlign: "center"}}>
                              <div style={{display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap"}}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => setSelectedQuestionModal(q)}
                                  style={{fontSize: 11.5, padding: "3px 8px"}}>
                                  {q.isSubjective ? "คำตอบนักเรียน 🔍" : "แจกแจงตัวเลือก 🔍"}
                                </button>
                                {q.isSubjective && (
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    onClick={() => setActiveTab("students")}
                                    style={{
                                      fontSize: 11,
                                      padding: "3px 8px",
                                      background: "#FEF3C7",
                                      color: "#92400E",
                                      border: "1px solid #F59E0B",
                                      fontWeight: 700
                                    }}
                                    title="ไปยังหน้ารายชื่อเพื่อตรวจให้คะแนนนักเรียน">
                                    ✏️ ให้คะแนน
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 4: AT-RISK STUDENTS ==================== */}
          {activeTab === "at_risk" && (
            <div>
              <div className="card" style={{borderLeft: "5px solid #DC2626"}}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12}}>
                  <div>
                    <div className="card-title" style={{color: "#DC2626", margin: 0}}>
                      🚨 นักเรียนกลุ่มที่ต้องให้ความช่วยเหลือเร่งด่วน ({atRiskStudents.length} คน)
                    </div>
                    <div className="card-sub" style={{marginTop: 4}}>
                      นักเรียนที่ได้คะแนนต่ำกว่าเกณฑ์ 50% ({passThresh} คะแนน) ที่คุณครูควรจัดกิจกรรมสอนเสริมหรือซ่อมเสริม
                    </div>
                  </div>
                  {atRiskStudents.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={copyAtRiskList}
                      style={{background: atRiskCopied ? "#059669" : "#DC2626", color: "white", fontWeight: 700}}>
                      {atRiskCopied ? "✅ คัดลอกรายชื่อแล้ว" : "📋 คัดลอกรายชื่อส่งต่อคุณครูประจำชั้น"}
                    </button>
                  )}
                </div>

                {atRiskStudents.length === 0 ? (
                  <div style={{textAlign: "center", padding: 36, background: "#ECFDF5", borderRadius: 8, color: "#065F46"}}>
                    <div style={{fontSize: 32, marginBottom: 8}}>🎉</div>
                    <div style={{fontSize: 16, fontWeight: 700}}>ยินดีด้วย! ไม่มีนักเรียนที่ได้คะแนนต่ำกว่าเกณฑ์ 50%</div>
                    <div style={{fontSize: 12.5, opacity: 0.85, marginTop: 4}}>นักเรียนทุกคนผ่านเกณฑ์การประเมินขั้นต่ำเรียบร้อยแล้ว</div>
                  </div>
                ) : (
                  <div style={{overflowX: "auto"}}>
                    <table style={{width: "100%", borderCollapse: "collapse", fontSize: 13}}>
                      <thead>
                        <tr style={{background: "#FEF2F2", borderBottom: "2px solid #FECACA"}}>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 60}}>ลำดับ</th>
                          <th style={{padding: "10px 12px", textAlign: "left"}}>ชื่อ-สกุล</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 100}}>ห้องเรียน</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 80}}>เลขที่</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 130}}>คะแนนที่ได้</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 130}}>ขาดอีก (คะแนน)</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 120}}>การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atRiskStudents.map((s, idx) => {
                          const parsed = parseScore(s, totalMax);
                          const gap = passThresh - parsed.earned;
                          return (
                            <tr key={idx} style={{borderBottom: "1px solid var(--gray-100)"}}>
                              <td style={{padding: "10px 12px", textAlign: "center", color: "var(--gray-500)"}}>{idx + 1}</td>
                              <td style={{padding: "10px 12px", fontWeight: 700, color: "var(--gray-900)"}}>
                                {getStudentField(s, ["ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อ", "Name"]) || "ไม่ระบุชื่อ"}
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center"}}>
                                <span style={{background: "#F1F5F9", padding: "2px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600}}>
                                  {getStudentRoom(s)}
                                </span>
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 600}}>
                                {getStudentNo(s) !== 9999 ? getStudentNo(s) : "-"}
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#DC2626"}}>
                                {parsed.earned} / {totalMax}
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "#D97706"}}>
                                {gap > 0 ? `-${gap.toFixed(1)}` : "-"}
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center"}}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => handleOpenGrading(s)}
                                  style={{fontSize: 11.5}}>
                                  ✏️ ตรวจ/แก้คะแนน
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 5: STUDENTS & RESULTS ==================== */}
          {activeTab === "students" && (
            <div>
              <div className="card">
                {/* Subjective Grading Info Banner */}
                <div style={{
                  background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
                  border: "1.5px solid #FCD34D",
                  borderRadius: "10px",
                  padding: "14px 18px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                  boxShadow: "0 2px 8px rgba(245,158,11,0.15)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "28px" }}>✍️</span>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "#92400E" }}>
                        ระบบตรวจคำตอบรายคน & บันทึกคะแนนข้อสอบอัตนัย (In-App Manual Grading)
                      </div>
                      <div style={{ fontSize: "12.5px", color: "#B45309", marginTop: "2px" }}>
                        คุณครูสามารถคลิกปุ่ม <strong>"✏️ ตรวจคำตอบ & ให้คะแนน"</strong> ในตารางด้านล่าง เพื่อเปิดดูคำตอบที่นักเรียนแต่ละคนพิมพ์ส่งมา ใส่คะแนนรายข้อ และกดบันทึกกลับไปยัง Google Sheet ได้ทันที
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14}}>
                  <div>
                    <div className="card-title" style={{margin: 0}}>
                      👥 รายชื่อผู้สอบและคะแนนรายบุคคล ({sortedStudents.length} คน)
                    </div>
                    <div className="card-sub" style={{marginTop: 4}}>
                      สามารถค้นหาชื่อ กรองตามห้องเรียน จัดเรียงตามคะแนน และคลิกเพื่อตรวจแก้คะแนนได้
                    </div>
                  </div>

                  <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
                    <input
                      type="text"
                      placeholder="🔍 ค้นหาชื่อ-สกุล หรือเลขที่..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{
                        padding: "6px 12px",
                        border: "1px solid var(--gray-300)",
                        borderRadius: "var(--radius)",
                        fontSize: 12.5,
                        width: 200,
                        outline: "none"
                      }}
                    />

                    <select
                      value={roomFilter}
                      onChange={e => setRoomFilter(e.target.value)}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid var(--gray-300)",
                        borderRadius: "var(--radius)",
                        fontSize: 12.5,
                        outline: "none"
                      }}>
                      <option value="all">ทุกห้องเรียน ({allRooms.length})</option>
                      {allRooms.map(rm => (
                        <option key={rm} value={rm}>{rm}</option>
                      ))}
                    </select>

                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as any)}
                      style={{
                        padding: "6px 10px",
                        border: "1px solid var(--gray-300)",
                        borderRadius: "var(--radius)",
                        fontSize: 12.5,
                        outline: "none"
                      }}>
                      <option value="no">เรียงตามเลขที่</option>
                      <option value="score_desc">เรียงคะแนนมาก → น้อย</option>
                      <option value="score_asc">เรียงคะแนนน้อย → มาก</option>
                      <option value="time">เรียงตามเวลาส่ง</option>
                    </select>
                  </div>
                </div>

                {sortedStudents.length === 0 ? (
                  <div style={{textAlign: "center", padding: 30, color: "var(--gray-500)"}}>ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา</div>
                ) : (
                  <div style={{overflowX: "auto"}}>
                    <table style={{width: "100%", borderCollapse: "collapse", fontSize: 13}}>
                      <thead>
                        <tr style={{background: "var(--gray-50)", borderBottom: "2px solid var(--gray-200)"}}>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 60}}>เลขที่</th>
                          <th style={{padding: "10px 12px", textAlign: "left"}}>ชื่อ-สกุล</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 90}}>ห้องเรียน</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 120}}>คะแนนที่ได้</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 90}}>ร้อยละ</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 120}}>ระดับผลคะแนน</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 100}}>สถานะ</th>
                          <th style={{padding: "10px 12px", textAlign: "center", width: 110}}>จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedStudents.map((s, idx) => {
                          const parsed = parseScore(s, totalMax);
                          const sl = calculateScoreLevel(parsed.earned, totalMax);
                          const no = getStudentNo(s);
                          const name = getStudentField(s, ["ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อ", "Name"]) || "ไม่ระบุชื่อ";
                          return (
                            <tr key={idx} style={{borderBottom: "1px solid var(--gray-100)"}}>
                              <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 700}}>
                                {no !== 9999 ? no : "-"}
                              </td>
                              <td style={{padding: "10px 12px", fontWeight: 600, color: "var(--gray-900)"}}>
                                {name}
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center"}}>
                                <span style={{background: "#F1F5F9", padding: "2px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600}}>
                                  {getStudentRoom(s)}
                                </span>
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 700, color: parsed.isPass ? "#047857" : "#DC2626"}}>
                                {parsed.str}
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center", fontWeight: 700, color: "var(--gray-700)"}}>
                                {totalMax > 0 ? ((parsed.earned / totalMax) * 100).toFixed(1) : 0}%
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center"}}>
                                <span style={{
                                  padding: "3px 10px",
                                  borderRadius: 12,
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  background: sl.bg,
                                  color: sl.color,
                                  border: `1px solid ${sl.border}`
                                }}>
                                  {sl.level}
                                </span>
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center"}}>
                                <span style={{
                                  padding: "2px 8px",
                                  borderRadius: 10,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: parsed.isPass ? "#ECFDF5" : "#FEF2F2",
                                  color: parsed.isPass ? "#065F46" : "#DC2626"
                                }}>
                                  {parsed.isPass ? "✅ ผ่าน" : "❌ ปรับปรุง"}
                                </span>
                              </td>
                              <td style={{padding: "10px 12px", textAlign: "center"}}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => handleOpenGrading(s)}
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: "#FEF3C7",
                                    color: "#92400E",
                                    border: "1px solid #F59E0B",
                                    padding: "4px 10px",
                                    borderRadius: "6px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px"
                                  }}>
                                  ✏️ ตรวจ/ให้คะแนน
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 6: GOOGLE SHEET ==================== */}
          {activeTab === "sheet" && (
            <div className="card">
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12}}>
                <div className="card-title" style={{margin: 0}}>
                  📄 ข้อมูลดิบจาก Google Sheets ({exam.form_title})
                </div>
                {exam.sheet_url && (
                  <button className="btn btn-sm" onClick={() => window.open(exam.sheet_url, "_blank")} style={{background:"#0F9D58", color:"white", fontWeight:600}}>
                    เปิดในแท็บใหม่ ↗
                  </button>
                )}
              </div>
              <div style={{height: 600, border: "1px solid var(--gray-200)", borderRadius: 8, overflow: "hidden"}}>
                {exam.sheet_url ? (
                  <iframe
                    src={exam.sheet_url.replace(/\/edit.*$/, "/preview")}
                    style={{width: "100%", height: "100%", border: "none"}}
                    title="Google Sheet Preview"
                  />
                ) : (
                  <div style={{display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--gray-500)"}}>
                    ไม่พบ URL ของ Google Sheets สำหรับข้อสอบชุดนี้
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: Item Options Distribution */}
      {selectedQuestionModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 16
        }}>
          <div className="card" style={{maxWidth: 580, width: "100%", margin: 0, padding: 24, maxHeight: "90vh", overflowY: "auto"}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16}}>
              <div>
                <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 4}}>
                  <span style={{fontSize: 12, fontWeight: 700, color: "var(--crimson)", background: "var(--crimson-light)", padding: "2px 8px", borderRadius: 8}}>
                    ข้อที่ {selectedQuestionModal.index}
                  </span>
                  {selectedQuestionModal.isSubjective && (
                    <span style={{fontSize: 11.5, fontWeight: 700, color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", padding: "2px 8px", borderRadius: 8}}>
                      ✍️ ข้อสอบอัตนัย / เขียนบรรยาย
                    </span>
                  )}
                </div>
                <h3 style={{fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginTop: 6, marginBottom: 4}}>
                  {selectedQuestionModal.title}
                </h3>
                <div style={{fontSize: 12, color: "var(--gray-500)"}}>
                  ผู้ตอบทั้งหมด {selectedQuestionModal.totalResponses} คน • รูปแบบคำตอบที่นักเรียนพิมพ์ {selectedQuestionModal.distinctCount} แบบ
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQuestionModal(null)}
                style={{background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--gray-500)"}}>
                ✕
              </button>
            </div>

            {selectedQuestionModal.isSubjective && (
              <div style={{
                background: "#FFFBEB",
                border: "1.5px solid #FCD34D",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "#92400E",
                marginBottom: 14,
                lineHeight: 1.5
              }}>
                💡 <strong>คำชี้แจง:</strong> รายการด้านล่างคือคำตอบที่นักเรียนแต่ละคนพิมพ์ตอบ (ไม่ใช่เฉลยของแบบทดสอบ) คุณครูสามารถกดปุ่ม <strong>"✏️ ไปตรวจข้อสอบอัตนัย"</strong> ด้านล่างเพื่อดูคำตอบรายคนและใส่คะแนนได้
              </div>
            )}

            <div style={{display: "grid", gap: 10, marginTop: 16}}>
              {selectedQuestionModal.choices.map(([choiceText, count]: [string, number], cIdx: number) => {
                const choicePct = selectedQuestionModal.totalResponses > 0 ? (count / selectedQuestionModal.totalResponses) * 100 : 0;
                const isTop = cIdx === 0;
                return (
                  <div
                    key={cIdx}
                    style={{
                      background: isTop && !selectedQuestionModal.isSubjective ? "#F0FDF4" : "var(--gray-50)",
                      border: isTop && !selectedQuestionModal.isSubjective ? "1.5px solid #86EFAC" : "1px solid var(--gray-200)",
                      borderRadius: 8,
                      padding: "10px 14px"
                    }}>
                    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4}}>
                      <span style={{fontSize: 13, fontWeight: isTop && !selectedQuestionModal.isSubjective ? 700 : 500, color: isTop && !selectedQuestionModal.isSubjective ? "#065F46" : "var(--gray-800)"}}>
                        {choiceText || "(เว้นว่าง/ไม่ได้ตอบ)"} {isTop && !selectedQuestionModal.isSubjective && "⭐"}
                      </span>
                      <span style={{fontSize: 13, fontWeight: 700, color: isTop && !selectedQuestionModal.isSubjective ? "#047857" : "var(--gray-700)"}}>
                        {count} คน ({choicePct.toFixed(1)}%)
                      </span>
                    </div>
                    <div style={{height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden"}}>
                      <div style={{
                        height: "100%",
                        width: `${choicePct}%`,
                        background: isTop && !selectedQuestionModal.isSubjective ? "#10B981" : "#94A3B8",
                        borderRadius: 3
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10}}>
              {selectedQuestionModal.isSubjective && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setSelectedQuestionModal(null);
                    setActiveTab("students");
                  }}
                  style={{
                    background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                    color: "white",
                    fontWeight: 700,
                    padding: "7px 16px"
                  }}>
                  ✏️ ไปตรวจข้อสอบอัตนัยรายคน ↗
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedQuestionModal(null)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: In-App Grading Modal */}
      {gradingStudent && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 16
        }}>
          <div className="card" style={{maxWidth: 620, width: "100%", margin: 0, padding: 24, maxHeight: "90vh", overflowY: "auto"}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14}}>
              <h3 style={{fontSize: 17, fontWeight: 700, color: "var(--gray-900)", margin: 0}}>
                ✏️ ตรวจและแก้ไขคะแนนนักเรียน
              </h3>
              <button
                type="button"
                onClick={() => setGradingStudent(null)}
                style={{background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--gray-500)"}}>
                ✕
              </button>
            </div>

            <div style={{background: "#F8FAFC", padding: 14, borderRadius: 8, marginBottom: 16}}>
              <div style={{fontSize: 14, fontWeight: 700, color: "var(--gray-900)"}}>
                {getStudentField(gradingStudent, ["ชื่อ-สกุล", "ชื่อ-นามสกุล", "ชื่อ", "Name"]) || "ไม่ระบุชื่อ"}
              </div>
              <div style={{fontSize: 12.5, color: "var(--gray-600)", marginTop: 2}}>
                ห้อง: {getStudentRoom(gradingStudent)} | เลขที่: {getStudentNo(gradingStudent) !== 9999 ? getStudentNo(gradingStudent) : "-"}
              </div>
            </div>

            {gradeSuccessMsg && (
              <div style={{padding: 10, background: "#ECFDF5", color: "#065F46", borderRadius: 6, fontSize: 13, fontWeight: 600, marginBottom: 12}}>
                {gradeSuccessMsg}
              </div>
            )}
            {gradeErrorMsg && (
              <div style={{padding: 10, background: "#FEF2F2", color: "#DC2626", borderRadius: 6, fontSize: 13, fontWeight: 600, marginBottom: 12}}>
                {gradeErrorMsg}
              </div>
            )}

            <div style={{marginBottom: 16}}>
              <label style={{display: "block", fontSize: 13, fontWeight: 700, color: "var(--gray-800)", marginBottom: 6}}>
                คะแนนที่ได้ (จากคะแนนเต็ม {totalMax} คะแนน):
              </label>
              <div style={{display: "flex", alignItems: "center", gap: 8}}>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={totalMax}
                  value={newScoreInput}
                  onChange={e => setNewScoreInput(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    border: "1.5px solid var(--crimson)",
                    borderRadius: "var(--radius)",
                    fontSize: 16,
                    fontWeight: 700,
                    width: 140,
                    outline: "none"
                  }}
                />
                <span style={{fontSize: 15, fontWeight: 600, color: "var(--gray-600)"}}>
                  / {totalMax} คะแนน
                </span>
              </div>
            </div>

            <div style={{maxHeight: 340, overflowY: "auto", border: "1px solid var(--gray-200)", borderRadius: 8, padding: 12, marginBottom: 16}}>
              <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6}}>
                <div style={{fontSize: 12.5, fontWeight: 700, color: "var(--gray-700)"}}>
                  📝 คำตอบและช่องให้คะแนนรายข้อ ({getStudentQuestionAnswers(gradingStudent).length} ข้อ):
                </div>
                <div style={{fontSize: 11.5, color: "var(--gray-500)"}}>
                  (กรอกคะแนนข้อสอบอัตนัย ระบบจะคำนวณรวมคะแนนให้อัตโนมัติ)
                </div>
              </div>
              <div style={{display: "grid", gap: 12}}>
                {getStudentQuestionAnswers(gradingStudent).map((qa, qIdx) => {
                  const defaultMaxQ = Math.max(1, Math.round(totalMax / Math.max(1, getStudentQuestionAnswers(gradingStudent).length)));
                  const qMax = (qa as any).points || defaultMaxQ;
                  return (
                    <div key={qIdx} style={{
                      background: qa.isManual ? "#FFFBEB" : "#F8FAFC",
                      border: qa.isManual ? "1.5px solid #FCD34D" : "1px solid var(--gray-200)",
                      padding: "12px 14px",
                      borderRadius: 8,
                      fontSize: 12.5
                    }}>
                      <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6}}>
                        <div style={{fontWeight: 700, color: "var(--gray-900)"}}>
                          ข้อ {qIdx + 1}. {qa.title}
                        </div>
                        {qa.isManual && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: "#FEF3C7",
                            color: "#92400E",
                            padding: "2px 8px",
                            borderRadius: 12,
                            whiteSpace: "nowrap"
                          }}>
                            ✍️ ข้อสอบอัตนัย / ข้อเขียน
                          </span>
                        )}
                      </div>

                      <div style={{
                        color: "#1E3A8A",
                        background: "white",
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid var(--gray-200)",
                        lineHeight: 1.4
                      }}>
                        <span style={{color: "var(--gray-500)", fontSize: 11.5}}>คำตอบที่นักเรียนพิมพ์: </span>
                        <strong>{qa.answer || "(ไม่ได้ตอบ / ว่างเปล่า)"}</strong>
                      </div>

                      {qa.guideline && (
                        <div style={{
                          fontSize: 11.5,
                          color: "#065F46",
                          background: "#ECFDF5",
                          padding: "6px 10px",
                          borderRadius: 6,
                          marginTop: 6,
                          border: "1px solid #A7F3D0"
                        }}>
                          💡 เกณฑ์การให้คะแนน / แนวคำตอบ: <strong>{qa.guideline}</strong>
                        </div>
                      )}

                      {/* ช่องให้คะแนนรายข้อ (สำหรับข้อสอบอัตนัย และข้อที่ครูต้องการให้คะแนนเอง) */}
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 8,
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: "1px dashed var(--gray-200)"
                      }}>
                        <span style={{fontSize: 12, fontWeight: 700, color: qa.isManual ? "#92400E" : "var(--gray-700)"}}>
                          {qa.isManual ? "✍️ คะแนนข้อสอบอัตนัยข้อนี้:" : "คะแนนข้อนี้:"}
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={qMax}
                          placeholder="0"
                          value={questionScores[qIdx] !== undefined ? questionScores[qIdx] : ""}
                          onChange={e => handleQuestionScoreChange(qIdx, e.target.value)}
                          style={{
                            width: 72,
                            textAlign: "center",
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: qa.isManual ? "2px solid #D97706" : "1.5px solid var(--gray-300)",
                            fontWeight: 800,
                            fontSize: 14,
                            color: "var(--crimson)",
                            background: "white",
                            outline: "none"
                          }}
                        />
                        <span style={{fontSize: 12, fontWeight: 600, color: "var(--gray-600)"}}>
                          / {qMax} คะแนน
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{display: "flex", justifyContent: "flex-end", gap: 10}}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setGradingStudent(null)}
                disabled={savingScore}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleSaveScore}
                disabled={savingScore}
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  color: "white",
                  padding: "8px 20px",
                  fontWeight: 700
                }}>
                {savingScore ? "⏳ กำลังบันทึก..." : "💾 บันทึกคะแนนลงชีต"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ SCORE ANALYTICS DASHBOARD VIEW (ภาพรวมทั้งโรงเรียน & เจาะลึกรายวิชา) ============
function ScoreAnalyticsView({
  user,
  selectedGrade: propGrade = "all",
  setSelectedGrade: setPropGrade,
  selectedRoom: _propRoom = "all",
  setSelectedRoom: _setPropRoom,
  selectedSubject: propSubject = "all",
  setSelectedSubject: setPropSubject,
  initialExamId
}: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [_loadingHistory, setLoadingHistory] = useState(true);
  const [analyticsMode, setAnalyticsMode] = useState<"schoolwide" | "single_exam">("schoolwide");
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || "");
  const [localSubject, setLocalSubject] = useState("all");
  const [localGrade, setLocalGrade] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Toggle ระหว่างการจำแนกตามรายบุคคล (Unique Students) VS จำแนกตามการส่งข้อสอบ (Exam Submissions)
  const [distributionMode, setDistributionMode] = useState<"unique_students" | "submissions">("unique_students");

  // ตัวกรองและการแสดงผลวิเคราะห์รายบุคคล (อ่อน / เก่ง / ยอดเยี่ยม รายวิชา)
  const [showStudentDiagnosticsModal, setShowStudentDiagnosticsModal] = useState<boolean>(false);
  const [showEmptyExamsModal, setShowEmptyExamsModal] = useState<boolean>(false);
  const [selectedTierFilter, setSelectedTierFilter] = useState<string>("all");
  const [selectedStudentRoom, setSelectedStudentRoom] = useState<string>("all");
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>("");
  const [studentSortBy, setStudentSortBy] = useState<"pct_desc" | "pct_asc" | "no" | "name">("pct_desc");
  const [selectedStudentScorecard, setSelectedStudentScorecard] = useState<any>(null);

  // Background Batch Progressive Loading State
  const [batchProgress, setBatchProgress] = useState({
    loaded: 0,
    total: 0,
    isFetching: false,
    currentExamTitle: ""
  });
  const [batchTick, setBatchTick] = useState(0);

  const currentSubject = setPropSubject ? propSubject : localSubject;
  const setCurrentSubject = setPropSubject || setLocalSubject;
  const currentGrade = setPropGrade ? propGrade : localGrade;
  const setCurrentGrade = setPropGrade || setLocalGrade;

  const fetchHistory = async () => {
    setLoadingHistory(true);
    let query = supabase.from("form_history").select("*").order("created_at", { ascending: false });
    if (user.role !== "admin") query = query.eq("license_key", user.key);
    const { data } = await query;
    const list = data || [];
    setHistory(list);
    if (list.length > 0 && !selectedExamId) {
      setSelectedExamId(list[0].id);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // On-Demand Batch Loader: ดึงข้อมูลเป็นครั้ง ๆ ตามความต้องการของผู้ใช้ (Request 3)
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // อ่านแคชเดิมที่มีอยู่แล้วทันที เพื่อแสดงผลทันทีแบบ 0ms ไม่ต้องรอโหลด
  useEffect(() => {
    if (history.length === 0) return;
    const examsWithSheet = history.filter(h => h.sheet_url && h.sheet_url.trim().length > 10);
    const totalSheets = examsWithSheet.length;
    let cachedCount = 0;
    examsWithSheet.forEach(exam => {
      const sheetId = exam.sheet_url.match(/[-\w]{25,}/)?.[0] || exam.sheet_url.trim();
      if (examScoreCache.has(sheetId)) {
        cachedCount++;
      } else {
        try {
          const saved = localStorage.getItem(`exam_score_${sheetId}`) || sessionStorage.getItem(`exam_score_${sheetId}`);
          if (saved) {
            const p = JSON.parse(saved);
            if (p && p.success) { examScoreCache.set(sheetId, p); cachedCount++; }
          }
        } catch (e) {}
      }
    });
    setBatchProgress({
      loaded: cachedCount,
      total: totalSheets,
      isFetching: false,
      currentExamTitle: ""
    });
    setBatchTick(t => t + 1);
  }, [history]);

  const startBatchLoader = async (forceRefresh: boolean = false) => {
    const examsWithSheet = history.filter(h => h.sheet_url && h.sheet_url.trim().length > 10);
    const totalSheets = examsWithSheet.length;
    if (totalSheets === 0) return;

    if (forceRefresh) {
      examsWithSheet.forEach(exam => {
        const sheetId = exam.sheet_url.match(/[-\w]{25,}/)?.[0] || exam.sheet_url.trim();
        examScoreCache.delete(sheetId);
        try { localStorage.removeItem(`exam_score_${sheetId}`); } catch(e) {}
        try { sessionStorage.removeItem(`exam_score_${sheetId}`); } catch(e) {}
      });
    }

    const controller = new AbortController();
    setAbortController(controller);
    setBatchProgress(prev => ({ ...prev, total: totalSheets, isFetching: true }));

    let cachedCount = 0;
    examsWithSheet.forEach(exam => {
      const sheetId = exam.sheet_url.match(/[-\w]{25,}/)?.[0] || exam.sheet_url.trim();
      if (examScoreCache.has(sheetId)) cachedCount++;
    });

    const uncachedExams = examsWithSheet.filter(exam => {
      const sheetId = exam.sheet_url.match(/[-\w]{25,}/)?.[0] || exam.sheet_url.trim();
      return !examScoreCache.has(sheetId);
    });

    setBatchProgress(prev => ({
      ...prev,
      loaded: cachedCount,
      total: totalSheets,
      isFetching: uncachedExams.length > 0
    }));
    setBatchTick(t => t + 1);

    if (uncachedExams.length === 0) {
      setBatchProgress(prev => ({ ...prev, isFetching: false, currentExamTitle: "" }));
      return;
    }

    const chunkSize = 3;
    for (let i = 0; i < uncachedExams.length; i += chunkSize) {
      if (controller.signal.aborted) break;
      const chunk = uncachedExams.slice(i, i + chunkSize);

      await Promise.allSettled(chunk.map(async exam => {
        const sheetId = exam.sheet_url.match(/[-\w]{25,}/)?.[0] || exam.sheet_url.trim();
        try {
          setBatchProgress(prev => ({ ...prev, currentExamTitle: exam.form_title }));
          const res = await fetch(`${SCRIPT_URL}?sheetId=${encodeURIComponent(sheetId)}`, { signal: controller.signal });
          const json = await res.json();
          if (json && json.success && Array.isArray(json.students)) {
            examScoreCache.set(sheetId, json);
            try { localStorage.setItem(`exam_score_${sheetId}`, JSON.stringify(json)); } catch (e) {}
            try { sessionStorage.setItem(`exam_score_${sheetId}`, JSON.stringify(json)); } catch (e) {}
          }
        } catch (e) {}
      }));

      if (!controller.signal.aborted) {
        cachedCount += chunk.length;
        setBatchProgress(prev => ({
          ...prev,
          loaded: Math.min(totalSheets, cachedCount),
          isFetching: cachedCount < totalSheets
        }));
        setBatchTick(t => t + 1);
      }
    }

    setBatchProgress(prev => ({ ...prev, isFetching: false, currentExamTitle: "" }));
    setAbortController(null);
  };

  const stopBatchLoader = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setBatchProgress(prev => ({ ...prev, isFetching: false, currentExamTitle: "" }));
  };

  const subjectCounts = useMemo(() => {
    const map: Record<string, number> = {};
    history.forEach(h => {
      const sg = getExamSubjectGroup(h);
      map[sg.id] = (map[sg.id] || 0) + 1;
    });
    return map;
  }, [history]);

  // Aggregated Schoolwide Metrics across ALL REAL EXAMS ONLY
  // รองรับ Deduplication ระดับบุคคล (Unique Students) และนับกระดาษคำตอบ (Submissions)
  const schoolwideData = useMemo(() => {
    let totalSubmissionsCount = 0;
    let totalScoreSum = 0;
    let totalMaxSum = 0;
    let passedSubmissionsCount = 0;

    const submissionLevelCounts: Record<string, number> = {
      "ดีเยี่ยม": 0,
      "ดีมาก": 0,
      "ดี": 0,
      "ผ่านเกณฑ์": 0,
      "ต้องปรับปรุง": 0
    };

    // แผนที่จัดเก็บข้อมูลนักเรียนรายคนแบบไม่ซ้ำ (Unique Students Map)
    const uniqueStudentsMap = new Map<string, {
      key: string;
      name: string;
      room: string;
      no: number;
      grade: string;
      exams: {
        examId: string;
        examTitle: string;
        subjectId: string;
        earned: number;
        total: number;
        pct: number;
      }[];
    }>();

    const subjectStatsMap: Record<string, {
      count: number;
      students: number;
      avgSum: number;
      passSum: number;
    }> = {};

    const gradeStatsMap: Record<string, {
      count: number;
      students: number;
      avgSum: number;
      passSum: number;
      uniqueStudentsCount: number;
    }> = {
      m1: { count: 0, students: 0, avgSum: 0, passSum: 0, uniqueStudentsCount: 0 },
      m2: { count: 0, students: 0, avgSum: 0, passSum: 0, uniqueStudentsCount: 0 },
      m3: { count: 0, students: 0, avgSum: 0, passSum: 0, uniqueStudentsCount: 0 },
      m4: { count: 0, students: 0, avgSum: 0, passSum: 0, uniqueStudentsCount: 0 },
      m5: { count: 0, students: 0, avgSum: 0, passSum: 0, uniqueStudentsCount: 0 },
      m6: { count: 0, students: 0, avgSum: 0, passSum: 0, uniqueStudentsCount: 0 },
    };

    let processedExamsCount = 0;
    const emptyExamsList: any[] = [];

    const examListWithStats = history.map(exam => {
      const sg = getExamSubjectGroup(exam);
      const sheetId = exam.sheet_url ? (exam.sheet_url.match(/[-\w]{25,}/)?.[0] || exam.sheet_url.trim()) : "";
      const realCached = sheetId ? examScoreCache.get(sheetId) : null;

      if (realCached && realCached.students && Array.isArray(realCached.students) && realCached.students.length > 0) {
        const rawRealSt: any[] = realCached.students;
        const realSt = rawRealSt.filter((s: any) => {
          if (!s || typeof s !== "object") return false;
          let hasVal = false;
          for (const k in s) {
            if (k !== "_rowIndex" && s[k] !== undefined && s[k] !== null && String(s[k]).trim() !== "") {
              hasVal = true; break;
            }
          }
          return hasVal;
        });

        let detectedMaxEarned = 0;
        const studentScoreItems = realSt.map((s: any, sIdx: number) => {
          let raw: any = s["คะแนน"] ?? s["score"] ?? s["คะแนนรวม"];
          if (raw === undefined) {
            for (const k in s) {
              if (k.toLowerCase().includes("คะแนน") || k.toLowerCase().includes("score")) { raw = s[k]; break; }
            }
          }
          let earned = 0;
          if (raw !== undefined && raw !== null && raw !== "") {
            const p = String(raw).split("/")[0];
            const n = parseFloat(p);
            earned = isNaN(n) ? 0 : n;
          }
          if (earned > detectedMaxEarned) detectedMaxEarned = earned;

          // Deduplication: สร้าง Key ประจำตัวนักเรียน โดยอิงจากห้องและเลขที่เป็นหลัก
          const studentKey = normalizeStudentKey(s, sIdx, exam);
          const rawRoom = (s["ชั้น"] || s["ห้อง"] || "").toString().trim();
          const rawName = (s["ชื่อ-สกุล"] || s["ชื่อ-นามสกุล"] || s["ชื่อ"] || "").toString().trim();
          const rawNo = parseInt((s["เลขที่"] || s["ลำดับที่"] || "").toString().replace(/\D/g, ""), 10) || 9999;

          // ระบุระดับชั้น
          let studentGrade = "";
          for (const g of ["m1", "m2", "m3", "m4", "m5", "m6"]) {
            if (matchRoom({ form_title: rawRoom, form_desc: "" }, g, "all")) {
              studentGrade = g; break;
            }
          }
          if (!studentGrade) {
            for (const g of ["m1", "m2", "m3", "m4", "m5", "m6"]) {
              if (matchRoom(exam, g, "all")) { studentGrade = g; break; }
            }
          }

          return { s, earned, studentKey, rawRoom, rawName, rawNo, studentGrade };
        });

        // ตรวจสอบคะแนนเต็มเป้าหมายที่คุณครูกำหนดไว้ (เช่น [คะแนนเต็ม: 20]) หรือจาก metadata
        const descMatch = (exam.form_desc || "").match(/\[คะแนนเต็ม:\s*(\d+(?:\.\d+)?)\]/);
        const targetTeacherMax = descMatch ? parseFloat(descMatch[1]) : 0;
        let realMax = (realCached.totalMaxPoints && realCached.totalMaxPoints > 0) ? realCached.totalMaxPoints : (exam.question_count || 20);
        if (targetTeacherMax > 0) {
          realMax = targetTeacherMax;
        } else if (detectedMaxEarned > realMax) {
          realMax = Math.max(detectedMaxEarned, exam.question_count || 0);
        }
        const passThreshold = Math.ceil(realMax * 0.5);
        const realCount = realSt.length;

        let examEarnedSum = 0;
        let examPassCount = 0;

        studentScoreItems.forEach(item => {
          examEarnedSum += item.earned;
          const isPassed = item.earned >= passThreshold;
          if (isPassed) examPassCount++;

          const scorePct = realMax > 0 ? (item.earned / realMax) * 100 : 0;
          const itemLevel = calculateScoreLevel(item.earned, realMax);
          submissionLevelCounts[itemLevel.level]++;
          totalSubmissionsCount++;
          totalScoreSum += item.earned;
          totalMaxSum += realMax;
          if (isPassed) passedSubmissionsCount++;

          // บันทึกลง Unique Students Map
          if (!uniqueStudentsMap.has(item.studentKey)) {
            uniqueStudentsMap.set(item.studentKey, {
              key: item.studentKey,
              name: item.rawName || (item.rawNo && item.rawNo !== 9999 ? `นักเรียนเลขที่ ${item.rawNo}` : "ไม่ระบุชื่อ"),
              room: item.rawRoom || "ไม่ระบุห้อง",
              no: item.rawNo,
              grade: item.studentGrade,
              exams: []
            });
          }
          const existingSt = uniqueStudentsMap.get(item.studentKey)!;
          if (item.rawName && (!existingSt.name || existingSt.name === "ไม่ระบุชื่อ" || item.rawName.length > existingSt.name.length)) {
            existingSt.name = item.rawName;
          }
          if (item.rawRoom && (!existingSt.room || existingSt.room === "ไม่ระบุห้อง")) {
            existingSt.room = item.rawRoom;
          }
          if (item.rawNo && item.rawNo !== 9999 && existingSt.no === 9999) {
            existingSt.no = item.rawNo;
          }
          existingSt.exams.push({
            examId: exam.id,
            examTitle: exam.form_title,
            subjectId: sg.id,
            earned: item.earned,
            total: realMax,
            pct: scorePct
          });
        });

        const realAvgNum = realCount > 0 ? (examEarnedSum / realCount) : 0;
        const realAvgPct = Math.min(100, Math.round((realAvgNum / realMax) * 100 * 10) / 10);
        const realPassRate = realCount > 0 ? Math.round((examPassCount / realCount) * 100 * 10) / 10 : 0;
        const realScoreLevel = calculateScoreLevel(realAvgNum, realMax);

        if (!subjectStatsMap[sg.id]) {
          subjectStatsMap[sg.id] = { count: 0, students: 0, avgSum: 0, passSum: 0 };
        }
        subjectStatsMap[sg.id].count += 1;
        subjectStatsMap[sg.id].students += realCount;
        subjectStatsMap[sg.id].avgSum += realAvgPct;
        subjectStatsMap[sg.id].passSum += realPassRate;

        for (const gr of ["m1", "m2", "m3", "m4", "m5", "m6"]) {
          if (matchRoom(exam, gr, "all")) {
            gradeStatsMap[gr].count++;
            gradeStatsMap[gr].students += realCount;
            gradeStatsMap[gr].avgSum += realAvgPct * realCount;
            gradeStatsMap[gr].passSum += realPassRate * realCount;
          }
        }

        processedExamsCount++;

        return {
          ...exam,
          subjectGroup: sg,
          avgPct: realAvgPct,
          passRate: realPassRate,
          studentCount: realCount,
          scoreLevel: realScoreLevel,
          isRealData: true,
          isLoading: false
        };
      }

      // ตรวจสอบว่าดึงชีตมาแล้วแต่ยังไม่มีนักเรียนส่งคำตอบหรือไม่ (0 คน)
      if (realCached && realCached.success && Array.isArray(realCached.students) && realCached.students.length === 0) {
        emptyExamsList.push({
          ...exam,
          subjectGroup: sg,
          reason: "ชีตว่างเปล่า ยังไม่มีนักเรียนส่งกระดาษคำตอบในระบบ Google Form"
        });
      }

      // หากยังโหลดไม่เสร็จ หรือเป็นชีตว่าง
      return {
        ...exam,
        subjectGroup: sg,
        avgPct: null,
        passRate: null,
        studentCount: 0,
        scoreLevel: null,
        isRealData: false,
        isLoading: !realCached && Boolean(exam.sheet_url)
      };
    });

    // คำนวณการกระจายตัวระดับรายบุคคล (Unique Students)
    const uniqueStudentLevelCounts: Record<string, number> = {
      "ดีเยี่ยม": 0,
      "ดีมาก": 0,
      "ดี": 0,
      "ผ่านเกณฑ์": 0,
      "ต้องปรับปรุง": 0
    };

    let uniqueStudentAvgPctSum = 0;
    let uniqueStudentPassCount = 0;

    uniqueStudentsMap.forEach(st => {
      // ค่าเฉลี่ยร้อยละรวมทุกวิชาที่นักเรียนคนนี้สอบ
      const meanPct = st.exams.reduce((sum, e) => sum + e.pct, 0) / st.exams.length;
      uniqueStudentAvgPctSum += meanPct;
      if (meanPct >= 50) uniqueStudentPassCount++;

      const stLevel = calculateScoreLevel(meanPct, 100);
      uniqueStudentLevelCounts[stLevel.level]++;

      if (st.grade && gradeStatsMap[st.grade]) {
        gradeStatsMap[st.grade].uniqueStudentsCount++;
      }
    });

    const uniqueStudentsTotal = uniqueStudentsMap.size;
    const overallStudentAvgPct = uniqueStudentsTotal > 0 ? (uniqueStudentAvgPctSum / uniqueStudentsTotal) : 0;
    const overallStudentPassRate = uniqueStudentsTotal > 0 ? ((uniqueStudentPassCount / uniqueStudentsTotal) * 100) : 0;
    const overallStudentLevel = calculateScoreLevel(overallStudentAvgPct, 100);

    const overallSubmissionAvgPct = totalMaxSum > 0 ? ((totalScoreSum / totalMaxSum) * 100) : 0;
    const overallSubmissionPassRate = totalSubmissionsCount > 0 ? ((passedSubmissionsCount / totalSubmissionsCount) * 100) : 0;
    const overallSubmissionLevel = calculateScoreLevel(overallSubmissionAvgPct, 100);

    // สร้างรายการวิเคราะห์ผลสัมฤทธิ์นักเรียนรายบุคคล (อ่อน / เก่ง / ยอดเยี่ยม)
    const uniqueStudentsList: any[] = [];
    uniqueStudentsMap.forEach(st => {
      if (st.exams.length === 0) return;
      const meanPct = Math.round((st.exams.reduce((sum, e) => sum + e.pct, 0) / st.exams.length) * 10) / 10;
      const stLevel = calculateScoreLevel(meanPct, 100);

      // เรียงลำดับวิชาที่สอบจากคะแนนมากไปน้อย
      const sortedExams = [...st.exams].sort((a, b) => b.pct - a.pct);
      
      // วิชาที่ยอดเยี่ยม / เด่นที่สุด (คะแนน >= 70% หรือวิชาที่ได้คะแนนสูงสุด)
      const topStrengths = sortedExams.filter(e => e.pct >= 70);
      const displayedStrengths = topStrengths.length > 0 ? topStrengths.slice(0, 3) : sortedExams.slice(0, 1);

      // วิชาที่อ่อน / ต้องพัฒนาเร่งด่วน (คะแนน < 50%)
      const weaknesses = sortedExams.filter(e => e.pct < 50).reverse();
      const displayedWeaknesses = weaknesses.length > 0 ? weaknesses.slice(0, 3) : [];

      // สรุปค่าเฉลี่ยตาม 8 กลุ่มสาระฯ สำหรับนักเรียนคนนี้
      const subjectGroupMap: Record<string, { totalEarned: number, totalMax: number, count: number }> = {};
      st.exams.forEach(e => {
        if (!subjectGroupMap[e.subjectId]) {
          subjectGroupMap[e.subjectId] = { totalEarned: 0, totalMax: 0, count: 0 };
        }
        subjectGroupMap[e.subjectId].totalEarned += e.earned;
        subjectGroupMap[e.subjectId].totalMax += e.total;
        subjectGroupMap[e.subjectId].count += 1;
      });

      const subjectGroupBreakdown = Object.entries(subjectGroupMap).map(([sgId, v]) => {
        const sg = SUBJECT_GROUPS.find(g => g.id === sgId) || { id: sgId, name: sgId, shortName: sgId, icon: "📚", color: "#475569" };
        const avgPct = v.totalMax > 0 ? Math.round((v.totalEarned / v.totalMax) * 100 * 10) / 10 : 0;
        return { ...sg, avgPct, count: v.count };
      }).sort((a, b) => b.avgPct - a.avgPct);

      uniqueStudentsList.push({
        ...st,
        meanPct,
        level: stLevel,
        totalExamsTaken: st.exams.length,
        passedExamsCount: st.exams.filter(e => e.pct >= 50).length,
        displayedStrengths,
        displayedWeaknesses,
        hasFailingSubjects: weaknesses.length > 0,
        subjectGroupBreakdown
      });
    });

    return {
      processedExamsCount,
      uniqueStudentsTotal,
      totalSubmissionsCount,
      uniqueStudentLevelCounts,
      submissionLevelCounts,
      overallStudentAvgPct: overallStudentAvgPct.toFixed(1),
      overallStudentPassRate: overallStudentPassRate.toFixed(1),
      overallStudentLevel,
      overallSubmissionAvgPct: overallSubmissionAvgPct.toFixed(1),
      overallSubmissionPassRate: overallSubmissionPassRate.toFixed(1),
      overallSubmissionLevel,
      subjectStatsMap,
      gradeStatsMap,
      examListWithStats,
      uniqueStudentsList,
      emptyExamsList
    };
  }, [history, batchTick]);

  const filteredExams = useMemo(() => {
    return schoolwideData.examListWithStats.filter(h => {
      const matchSub = currentSubject === "all" || h.subjectGroup.id === currentSubject;
      const matchGr = matchRoom(h, currentGrade, "all");
      const matchSearch = !searchTerm ||
        h.form_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.form_desc?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSub && matchGr && matchSearch;
    });
  }, [schoolwideData.examListWithStats, currentSubject, currentGrade, searchTerm]);

  const currentExam = useMemo(() => {
    if (filteredExams.length === 0) return history[0] || null;
    const found = filteredExams.find(e => e.id === selectedExamId);
    return found || filteredExams[0];
  }, [filteredExams, selectedExamId, history]);

  useEffect(() => {
    if (currentExam && currentExam.id !== selectedExamId) {
      setSelectedExamId(currentExam.id);
    }
  }, [currentExam]);

  const handleFilterSubjectAndDrilldown = (subjId: string) => {
    setCurrentSubject(subjId);
    setAnalyticsMode("single_exam");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activeLevelCounts = distributionMode === "unique_students"
    ? schoolwideData.uniqueStudentLevelCounts
    : schoolwideData.submissionLevelCounts;

  const activeTotalCount = distributionMode === "unique_students"
    ? schoolwideData.uniqueStudentsTotal
    : schoolwideData.totalSubmissionsCount;

  const activeUnit = distributionMode === "unique_students" ? "คน" : "ฉบับ";

  return (
    <div>
      {/* Top Banner with School Identity */}
      <div style={{
        background: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 55%, #B91C1C 100%)",
        borderBottom: "2.5px solid #F59E0B",
        borderRadius: "var(--radius-lg)",
        padding: "24px 28px",
        color: "white",
        marginBottom: 18,
        boxShadow: "0 4px 18px rgba(127,29,29,.22)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16
      }}>
        <div>
          <div style={{display: "flex", alignItems: "center", gap: 10, marginBottom: 6}}>
            <div style={{background: "rgba(255,255,255,.18)", borderRadius: 10, padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "center"}}>
              <ChartIcon />
            </div>
            <h2 style={{fontFamily: "'Prompt',sans-serif", fontSize: 22, fontWeight: 700, margin: 0}}>
              📊 แดชบอร์ดวิเคราะห์ผลคะแนนสอบ โรงเรียนวังหลวงพิทยาสรรพ์
            </h2>
          </div>
          <p style={{fontSize: 14, opacity: .9, margin: 0, maxWidth: 740}}>
            ระบบวิเคราะห์คะแนนสอบเชิงลึก 8 กลุ่มสาระการเรียนรู้ (สพฐ.) ทั้งในระดับ <strong>ภาพรวมทั้งโรงเรียน</strong> และ <strong>เจาะลึกรายวิชา/รายชีต</strong> จากข้อมูลคะแนนจริง (ไม่มีข้อมูลจำลอง)
          </p>
        </div>
        <div style={{display: "flex", gap: 12, alignItems: "center"}}>
          <div style={{background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 12, padding: "8px 16px", textAlign: "center"}}>
            <div style={{fontSize: 22, fontWeight: 800, color: "#FEF3C7"}}>{history.length}</div>
            <div style={{fontSize: 11, opacity: .9}}>ชุดข้อสอบในระบบ</div>
          </div>
          <button className="btn btn-sm" onClick={fetchHistory} style={{background: "white", color: "var(--crimson)", fontWeight: 700}}>
            <RefreshIcon /> รีเฟรช
          </button>
        </div>
      </div>

      {/* Mode Switcher: ภาพรวมทั้งโรงเรียน VS เจาะลึกรายวิชา/รายชีต */}
      <div style={{
        display: "flex",
        gap: 8,
        background: "var(--gray-100)",
        padding: 4,
        borderRadius: "var(--radius)",
        marginBottom: 20
      }}>
        <button
          type="button"
          onClick={() => setAnalyticsMode("schoolwide")}
          style={{
            flex: 1,
            padding: "10px 16px",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: analyticsMode === "schoolwide" ? "white" : "transparent",
            color: analyticsMode === "schoolwide" ? "var(--crimson)" : "var(--gray-600)",
            boxShadow: analyticsMode === "schoolwide" ? "0 2px 6px rgba(0,0,0,.08)" : "none",
            transition: "all .2s"
          }}>
          <span>🏛️ ภาพรวมทั้งโรงเรียน (Executive Analytics)</span>
        </button>

        <button
          type="button"
          onClick={() => setAnalyticsMode("single_exam")}
          style={{
            flex: 1,
            padding: "10px 16px",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: analyticsMode === "single_exam" ? "white" : "transparent",
            color: analyticsMode === "single_exam" ? "var(--crimson)" : "var(--gray-600)",
            boxShadow: analyticsMode === "single_exam" ? "0 2px 6px rgba(0,0,0,.08)" : "none",
            transition: "all .2s"
          }}>
          <span>🔍 เจาะลึกรายวิชา / รายชีต (Single Exam Drill-Down)</span>
        </button>
      </div>

      {/* On-Demand Data Sync Control Banner (Request 3) */}
      <div style={{
        background: batchProgress.isFetching ? "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)" : "white",
        border: batchProgress.isFetching ? "1.5px solid #3B82F6" : "1.5px solid var(--gray-200)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 20px",
        marginBottom: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 14,
        boxShadow: "var(--shadow-sm)"
      }}>
        <div style={{display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap"}}>
          {batchProgress.isFetching ? (
            <div className="spinner" style={{width: 24, height: 24, borderColor: "#2563EB", borderTopColor: "transparent"}} />
          ) : (
            <div style={{fontSize: 24}}>⚡</div>
          )}
          <div>
            <div style={{fontSize: 14, fontWeight: 700, color: batchProgress.isFetching ? "#1E40AF" : "var(--gray-900)"}}>
              {batchProgress.isFetching
                ? `กำลังประมวลผลคะแนนจริงจาก Google Sheets... (โหลดแล้ว ${batchProgress.loaded} / ${batchProgress.total} ชุด)`
                : `ข้อมูลคะแนนจาก Google Sheets: ดึงครบทั้ง ${history.length} ชุดแล้ว (มีผู้สอบ ${schoolwideData.processedExamsCount} ชุด | ว่างยังไม่มีผู้สอบ ${schoolwideData.emptyExamsList.length} ชุด)`}
            </div>
            <div style={{fontSize: 12, color: batchProgress.isFetching ? "#1D4ED8" : "var(--gray-600)", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap"}}>
              <span>{batchProgress.isFetching ? (batchProgress.currentExamTitle ? `กำลังอ่าน: ${batchProgress.currentExamTitle}` : "ระบบกำลังดึงข้อมูลคะแนนจริง...") : `ระบบดึงข้อมูลจากชีตครบ 100% แล้วทุกชุด (นักเรียนรวมทั้งโรงเรียน ${schoolwideData.uniqueStudentsTotal} คน)`}</span>
              {!batchProgress.isFetching && schoolwideData.emptyExamsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowEmptyExamsModal(true)}
                  style={{
                    background: "#FEF3C7",
                    color: "#92400E",
                    border: "1.5px solid #FCD34D",
                    borderRadius: 12,
                    padding: "2px 10px",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4
                  }}>
                  <span>ℹ️ ดูรายชื่อ {schoolwideData.emptyExamsList.length} ชุดที่ยังไม่มีผู้สอบ</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap"}}>
          {batchProgress.isFetching ? (
            <button
              type="button"
              className="btn btn-sm btn-red"
              onClick={stopBatchLoader}
              style={{fontWeight: 700}}>
              ⏹️ หยุดการดึงข้อมูล
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => startBatchLoader(false)}
                style={{
                  background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "8px 16px",
                  boxShadow: "0 2px 6px rgba(37,99,235,0.25)"
                }}>
                🔄 ซิงค์คะแนนล่าสุดจาก Google Sheets ({batchProgress.total - batchProgress.loaded > 0 ? `เหลืออีก ${batchProgress.total - batchProgress.loaded} ชุด` : `ดึงครบ ${history.length} ชุดแล้ว`})
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  if (confirm("ต้องการล้างแคชและดึงข้อมูลคะแนนใหม่ทั้งหมดจาก Google Sheets ใช่หรือไม่?")) {
                    startBatchLoader(true);
                  }
                }}
                style={{fontSize: 12}}>
                🧹 ดึงใหม่ทั้งหมด (ล้างแคช)
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: SCHOOLWIDE EXECUTIVE DASHBOARD */}
      {/* ========================================================================= */}
      {analyticsMode === "schoolwide" && (
        <div>
          {/* Executive Metrics Top Row */}
          <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20}}>
            <div className="card" style={{margin:0, padding: 20, borderLeft: "5px solid var(--crimson)", background: "white"}}>
              <div style={{fontSize: 12, color: "var(--gray-500)", fontWeight: 700, textTransform: "uppercase"}}>
                นักเรียนรายคน (Unique Students)
              </div>
              <div style={{fontSize: 30, fontWeight: 800, color: "var(--gray-900)", marginTop: 4}}>
                {schoolwideData.uniqueStudentsTotal} <span style={{fontSize: 14, fontWeight: 500, color: "var(--gray-500)"}}>คน</span>
              </div>
              <div style={{fontSize: 11.5, color: "var(--gray-600)", marginTop: 4}}>
                ส่งข้อสอบรวม <strong>{schoolwideData.totalSubmissionsCount}</strong> ฉบับ
              </div>
            </div>

            <div className="card" style={{margin:0, padding: 20, borderLeft: "5px solid #2563EB", background: "white"}}>
              <div style={{fontSize: 12, color: "var(--gray-500)", fontWeight: 700, textTransform: "uppercase"}}>
                คะแนนเฉลี่ยรวมทุกวิชา
              </div>
              <div style={{fontSize: 30, fontWeight: 800, color: "#1E3A8A", marginTop: 4}}>
                {distributionMode === "unique_students" ? schoolwideData.overallStudentAvgPct : schoolwideData.overallSubmissionAvgPct}%
              </div>
              <div style={{fontSize: 11.5, color: "#2563EB", marginTop: 4, fontWeight: 600}}>
                {distributionMode === "unique_students" ? "เฉลี่ยระดับรายคน" : "เฉลี่ยระดับกระดาษคำตอบ"}
              </div>
            </div>

            <div className="card" style={{margin:0, padding: 20, borderLeft: "5px solid #059669", background: "white"}}>
              <div style={{fontSize: 12, color: "var(--gray-500)", fontWeight: 700, textTransform: "uppercase"}}>
                อัตราการสอบผ่านรวม (≥50%)
              </div>
              <div style={{fontSize: 30, fontWeight: 800, color: "#065F46", marginTop: 4}}>
                {distributionMode === "unique_students" ? schoolwideData.overallStudentPassRate : schoolwideData.overallSubmissionPassRate}%
              </div>
              <div style={{fontSize: 11.5, color: "#059669", marginTop: 4, fontWeight: 600}}>
                เกณฑ์ผ่าน 50% ของคะแนนเต็ม
              </div>
            </div>

            <div className="card" style={{margin:0, padding: 20, borderLeft: "5px solid #7C3AED", background: "white"}}>
              <div style={{fontSize: 12, color: "var(--gray-500)", fontWeight: 700, textTransform: "uppercase"}}>
                ชุดข้อสอบที่ประมวลผลแล้ว
              </div>
              <div style={{fontSize: 30, fontWeight: 800, color: "#5B21B6", marginTop: 4}}>
                {schoolwideData.processedExamsCount} <span style={{fontSize: 14, fontWeight: 500, color: "var(--gray-500)"}}>/ {history.length}</span>
              </div>
              <div style={{fontSize: 11.5, color: "#7C3AED", marginTop: 4, fontWeight: 600}}>
                ชุดข้อสอบใน 8 กลุ่มสาระฯ
              </div>
            </div>
          </div>

          {/* Schoolwide Performance Bands with UNIQUE STUDENTS TOGGLE */}
          <div className="card" style={{marginBottom: 20}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 8}}>
              <div>
                <div className="card-title" style={{margin:0, display: "flex", alignItems: "center", gap: 8}}>
                  <span>📊 การกระจายตัวตาม 5 ระดับผลคะแนนสอบ</span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: distributionMode === "unique_students" ? "#EFF6FF" : "#FEF3C7",
                    color: distributionMode === "unique_students" ? "#1D4ED8" : "#92400E"
                  }}>
                    {distributionMode === "unique_students" ? "👤 จำแนกตามรายบุคคล (คน)" : "📄 จำแนกตามกระดาษคำตอบ (ฉบับ)"}
                  </span>
                </div>
                <div className="card-sub" style={{marginTop: 4}}>
                  {distributionMode === "unique_students"
                    ? `นับนักเรียน 1 คน = 1 ครั้ง โดยคำนวณจากคะแนนเฉลี่ยร้อยละรวมทุกวิชาที่นักเรียนสอบ (รวมนักเรียนทั้งสิ้น ${activeTotalCount} คน)`
                    : `นับตามจำนวนครั้งที่ส่งกระดาษคำตอบในทุกรายวิชา (รวมการส่งทั้งสิ้น ${activeTotalCount} ฉบับ)`}
                </div>
              </div>

              {/* TOGGLE BUTTON: สลับการนับคน VS นับฉบับ */}
              <div style={{
                display: "inline-flex",
                background: "var(--gray-100)",
                padding: 3,
                borderRadius: 8,
                border: "1px solid var(--gray-200)"
              }}>
                <button
                  type="button"
                  onClick={() => setDistributionMode("unique_students")}
                  style={{
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    background: distributionMode === "unique_students" ? "white" : "transparent",
                    color: distributionMode === "unique_students" ? "var(--crimson)" : "var(--gray-600)",
                    boxShadow: distributionMode === "unique_students" ? "0 1px 3px rgba(0,0,0,.1)" : "none"
                  }}>
                  👤 นับนักเรียนรายคน ({schoolwideData.uniqueStudentsTotal} คน)
                </button>
                <button
                  type="button"
                  onClick={() => setDistributionMode("submissions")}
                  style={{
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    background: distributionMode === "submissions" ? "white" : "transparent",
                    color: distributionMode === "submissions" ? "var(--crimson)" : "var(--gray-600)",
                    boxShadow: distributionMode === "submissions" ? "0 1px 3px rgba(0,0,0,.1)" : "none"
                  }}>
                  📄 นับรายฉบับ ({schoolwideData.totalSubmissionsCount} ฉบับ)
                </button>
              </div>
            </div>

            <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 14}}>
              {[
                { level: "ดีเยี่ยม", range: "80-100%", count: activeLevelCounts["ดีเยี่ยม"], color: "#047857", bg: "#ECFDF5", border: "#A7F3D0", desc: "เข้าใจลึกซึ้ง บรรลุผลสัมฤทธิ์ระดับสูง" },
                { level: "ดีมาก", range: "70-79%", count: activeLevelCounts["ดีมาก"], color: "#059669", bg: "#F0FDF4", border: "#BBF7D0", desc: "เข้าใจเนื้อหาเป็นอย่างดี มีทักษะประยุกต์" },
                { level: "ดี", range: "60-69%", count: activeLevelCounts["ดี"], color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE", desc: "เข้าใจตามเกณฑ์มาตรฐาน พัฒนาต่อยอดได้" },
                { level: "ผ่านเกณฑ์", range: "50-59%", count: activeLevelCounts["ผ่านเกณฑ์"], color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", desc: "ผ่านเกณฑ์ขั้นต่ำ ควรเสริมแรงจุดอ่อน" },
                { level: "ต้องปรับปรุง", range: "ต่ำกว่า 50%", count: activeLevelCounts["ต้องปรับปรุง"], color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", desc: "ต้องได้รับการสอนเสริมช่วยเหลือเร่งด่วน" },
              ].map(b => {
                const pct = activeTotalCount > 0 ? (b.count / activeTotalCount) * 100 : 0;
                const isSelected = selectedTierFilter === b.level;
                return (
                  <div
                    key={b.level}
                    onClick={() => {
                      setSelectedTierFilter(b.level);
                      setShowStudentDiagnosticsModal(true);
                    }}
                    style={{
                      background: b.bg,
                      border: isSelected ? `2.5px solid ${b.color}` : `1.5px solid ${b.border}`,
                      borderRadius: "var(--radius)",
                      padding: "16px 14px",
                      position: "relative",
                      cursor: "pointer",
                      boxShadow: isSelected ? `0 6px 16px rgba(0,0,0,0.12), 0 0 0 2px ${b.color}` : "none",
                      transform: isSelected ? "translateY(-3px)" : "none",
                      transition: "all .18s ease"
                    }}
                    title={`คลิกเพื่อกรองดูรายชื่อนักเรียนกลุ่ม "${b.level}" ด้านล่าง`}>
                    <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4}}>
                      <span style={{fontWeight: 700, color: b.color, fontSize: 15}}>{b.level}</span>
                      <span style={{fontSize: 11.5, color: "var(--gray-600)", fontWeight: 600}}>{b.range}</span>
                    </div>
                    <div style={{display: "flex", alignItems: "baseline", gap: 6, margin: "8px 0 4px"}}>
                      <span style={{fontSize: 26, fontWeight: 800, color: b.color}}>{b.count}</span>
                      <span style={{fontSize: 13, color: "var(--gray-600)", fontWeight: 600}}>{activeUnit} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div style={{
                      height: 6,
                      background: "rgba(0,0,0,0.06)",
                      borderRadius: 3,
                      overflow: "hidden",
                      marginBottom: 8
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: b.color,
                        borderRadius: 3,
                        transition: "width .5s ease"
                      }} />
                    </div>
                    <div style={{fontSize: 11, color: "var(--gray-600)", lineHeight: 1.3, marginBottom: 8}}>
                      {b.desc}
                    </div>
                    <div style={{
                      paddingTop: 6,
                      borderTop: "1px dashed rgba(0,0,0,0.12)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: b.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <span>🔍 คลิกดูรายคน</span>
                      <span>{b.count} {activeUnit} →</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Action Button to Open Student Diagnostics */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px dashed var(--gray-200)"
            }}>
              <div style={{fontSize: 12, color: "var(--gray-500)"}}>
                💡 คลิกที่การ์ดระดับคะแนนใดก็ได้ หรือกดปุ่มด้านขวา เพื่อเปิดหน้าต่างดูจุดเด่น-จุดอ่อนนักเรียนรายบุคคล
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setSelectedTierFilter("all");
                  setShowStudentDiagnosticsModal(true);
                }}
                style={{
                  background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 12.5,
                  padding: "7px 16px",
                  borderRadius: "var(--radius)",
                  boxShadow: "0 2px 6px rgba(37,99,235,0.25)"
                }}>
                👤 ดูวิเคราะห์นักเรียนรายบุคคล ({schoolwideData.uniqueStudentsTotal} คน) →
              </button>
            </div>
          </div>


          {/* ========================================================================= */}
          {/* MODAL: INDIVIDUAL STUDENT LEARNING DIAGNOSTICS & PROFILE (อ่อน / เก่ง / ยอดเยี่ยม รายวิชา) */}
          {/* ========================================================================= */}
          {showStudentDiagnosticsModal && (
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9998,
              padding: 16
            }}>
              <div className="card" style={{
                maxWidth: 1080,
                width: "100%",
                margin: 0,
                padding: 24,
                maxHeight: "92vh",
                overflowY: "auto",
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                borderTop: "4px solid var(--crimson)"
              }}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14}}>
              <div>
                <div className="card-title" style={{margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 18}}>
                  <span>👤 วิเคราะห์ศักยภาพนักเรียนรายบุคคล (อ่อน / เก่ง / ยอดเยี่ยม รายวิชา)</span>
                </div>
                <div className="card-sub" style={{marginTop: 4}}>
                  แสดงข้อมูลเจาะลึกนักเรียนแต่ละคน: <strong>วิชาที่ยอดเยี่ยม/เด่นที่สุด</strong> และ <strong>วิชาที่อ่อน/ควรได้รับการพัฒนาเร่งด่วน</strong> จากผลการสอบจริง
                </div>
              </div>

              <div style={{display: "flex", alignItems: "center", gap: 8}}>
                {selectedTierFilter !== "all" && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedTierFilter("all")}
                    style={{fontSize: 12, fontWeight: 700}}>
                    ✕ ดูนักเรียนทุกระดับ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowStudentDiagnosticsModal(false)}
                  style={{
                    background: "var(--gray-100)",
                    border: "1px solid var(--gray-200)",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "var(--gray-700)"
                  }}>
                  ✕ ปิดหน้าต่าง
                </button>
              </div>
            </div>

            {/* Filter Bar: Tier, Classroom, Search, Sort */}
            <div style={{
              background: "#F8FAFC",
              border: "1.5px solid var(--gray-200)",
              borderRadius: "var(--radius)",
              padding: "14px 16px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}>
              {/* Row 1: Filter by Performance Tier */}
              <div style={{display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap"}}>
                <span style={{fontSize: 12.5, fontWeight: 700, color: "var(--gray-700)"}}>🎯 ระดับคะแนน:</span>
                {[
                  { id: "all", label: "ทุกระดับ", count: schoolwideData.uniqueStudentsTotal, color: "var(--gray-700)", bg: "var(--gray-100)" },
                  { id: "ดีเยี่ยม", label: "🌟 ดีเยี่ยม", count: activeLevelCounts["ดีเยี่ยม"], color: "#047857", bg: "#ECFDF5" },
                  { id: "ดีมาก", label: "👍 ดีมาก", count: activeLevelCounts["ดีมาก"], color: "#059669", bg: "#F0FDF4" },
                  { id: "ดี", label: "📘 ดี", count: activeLevelCounts["ดี"], color: "#1D4ED8", bg: "#EFF6FF" },
                  { id: "ผ่านเกณฑ์", label: "📙 ผ่านเกณฑ์", count: activeLevelCounts["ผ่านเกณฑ์"], color: "#D97706", bg: "#FFFBEB" },
                  { id: "ต้องปรับปรุง", label: "⚠️ ต้องปรับปรุง", count: activeLevelCounts["ต้องปรับปรุง"], color: "#DC2626", bg: "#FEF2F2" },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTierFilter(t.id)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: selectedTierFilter === t.id ? 800 : 600,
                      cursor: "pointer",
                      border: selectedTierFilter === t.id ? `2px solid ${t.color}` : "1px solid var(--gray-300)",
                      background: selectedTierFilter === t.id ? t.bg : "white",
                      color: selectedTierFilter === t.id ? t.color : "var(--gray-700)",
                      boxShadow: selectedTierFilter === t.id ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                      transition: "all .15s"
                    }}>
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>

              {/* Row 2: Classroom Dropdown, Search Input, Sort Dropdown */}
              <div style={{display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap"}}>
                {/* Classroom Filter */}
                <div style={{display: "flex", alignItems: "center", gap: 6}}>
                  <span style={{fontSize: 12.5, fontWeight: 700, color: "var(--gray-700)"}}>🏫 ห้อง:</span>
                  <select
                    value={selectedStudentRoom}
                    onChange={e => setSelectedStudentRoom(e.target.value)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius)",
                      border: "1.5px solid var(--gray-200)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      outline: "none",
                      background: "white"
                    }}>
                    <option value="all">ทุกห้องเรียน (ทั้งโรงเรียน)</option>
                    {(() => {
                      const roomsSet = new Set<string>();
                      schoolwideData.uniqueStudentsList.forEach((s: any) => {
                        if (s.room && s.room !== "ไม่ระบุห้อง") roomsSet.add(s.room);
                      });
                      return Array.from(roomsSet).sort().map(rm => (
                        <option key={rm} value={rm}>{rm}</option>
                      ));
                    })()}
                  </select>
                </div>

                {/* Search Box */}
                <div style={{flex: 1, minWidth: 200}}>
                  <input
                    type="text"
                    placeholder="🔍 ค้นหาชื่อนักเรียน หรือ เลขที่..."
                    value={studentSearchTerm}
                    onChange={e => setStudentSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "6px 12px",
                      borderRadius: "var(--radius)",
                      border: "1.5px solid var(--gray-200)",
                      fontSize: 12.5,
                      outline: "none",
                      background: "white"
                    }}
                  />
                </div>

                {/* Sort Option */}
                <div style={{display: "flex", alignItems: "center", gap: 6}}>
                  <span style={{fontSize: 12.5, fontWeight: 700, color: "var(--gray-700)"}}>เรียงตาม:</span>
                  <select
                    value={studentSortBy}
                    onChange={e => setStudentSortBy(e.target.value as any)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius)",
                      border: "1.5px solid var(--gray-200)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      outline: "none",
                      background: "white"
                    }}>
                    <option value="pct_desc">คะแนนเฉลี่ยรวม (สูงสุด → ต่ำสุด)</option>
                    <option value="pct_asc">คะแนนเฉลี่ยรวม (ต่ำสุด → สูงสุด - ช่วยเด็กอ่อน)</option>
                    <option value="no">เลขที่และห้องเรียน</option>
                    <option value="name">ชื่อนักเรียน (ก - ฮ)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Filtered Students List */}
            {(() => {
              let list = schoolwideData.uniqueStudentsList.filter((s: any) => {
                const matchTier = selectedTierFilter === "all" || s.level.level === selectedTierFilter;
                const matchRoom = selectedStudentRoom === "all" || s.room === selectedStudentRoom;
                const matchSearch = !studentSearchTerm ||
                  s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
                  String(s.no).includes(studentSearchTerm) ||
                  s.room.toLowerCase().includes(studentSearchTerm.toLowerCase());
                return matchTier && matchRoom && matchSearch;
              });

              // Sorting
              list.sort((a: any, b: any) => {
                if (studentSortBy === "pct_desc") return b.meanPct - a.meanPct;
                if (studentSortBy === "pct_asc") return a.meanPct - b.meanPct;
                if (studentSortBy === "no") {
                  if (a.room !== b.room) return a.room.localeCompare(b.room, "th-TH");
                  return (a.no || 999) - (b.no || 999);
                }
                return a.name.localeCompare(b.name, "th-TH");
              });

              if (list.length === 0) {
                return (
                  <div style={{textAlign: "center", padding: "36px 16px", color: "var(--gray-500)", background: "var(--gray-50)", borderRadius: 8}}>
                    <div style={{fontSize: 32, marginBottom: 8}}>🔍</div>
                    <div style={{fontWeight: 700, fontSize: 14, color: "var(--gray-800)"}}>ไม่พบรายชื่อนักเรียนตามเงื่อนไขที่เลือก</div>
                    <div style={{fontSize: 12, marginTop: 4}}>ลองเลือก "ทุกระดับ" หรือเปลี่ยนคำค้นหา</div>
                  </div>
                );
              }

              return (
                <div>
                  <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 12.5, color: "var(--gray-600)", fontWeight: 600}}>
                    <span>แสดงนักเรียน <strong>{list.length}</strong> คน (จากทั้งหมด {schoolwideData.uniqueStudentsTotal} คน)</span>
                    <span>* คลิกที่ชื่อหรือปุ่ม "ดูสมุดพก" เพื่อดูผลการสอบครบทุกวิชา</span>
                  </div>

                  <div style={{overflowX: "auto"}}>
                    <table style={{width: "100%", borderCollapse: "collapse", fontSize: 12.5}}>
                      <thead>
                        <tr style={{background: "var(--gray-50)", borderBottom: "2px solid var(--gray-200)", color: "var(--gray-700)"}}>
                          <th style={{padding: "10px 10px", textAlign: "center", width: 90}}>ห้อง / เลขที่</th>
                          <th style={{padding: "10px 12px", textAlign: "left", minWidth: 160}}>ชื่อ-นามสกุล นักเรียน</th>
                          <th style={{padding: "10px 10px", textAlign: "center", width: 120}}>คะแนนเฉลี่ยรวม</th>
                          <th style={{padding: "10px 12px", textAlign: "left", minWidth: 200}}>🌟 วิชาที่ยอดเยี่ยม / เด่นที่สุด</th>
                          <th style={{padding: "10px 12px", textAlign: "left", minWidth: 200}}>⚠️ วิชาที่อ่อน / ควรพัฒนา</th>
                          <th style={{padding: "10px 10px", textAlign: "center", width: 100}}>สมุดพก</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((st: any, idx: number) => {
                          return (
                            <tr
                              key={st.key || idx}
                              style={{
                                borderBottom: "1px solid var(--gray-100)",
                                background: idx % 2 === 0 ? "white" : "#FAFAFA",
                                transition: "background .12s"
                              }}>
                              {/* ห้อง และ เลขที่ */}
                              <td style={{padding: "12px 10px", textAlign: "center", verticalAlign: "middle"}}>
                                <div style={{fontWeight: 700, color: "var(--gray-900)"}}>
                                  {st.room}
                                </div>
                                <div style={{fontSize: 11, color: "var(--gray-500)", marginTop: 2}}>
                                  เลขที่ {st.no !== 9999 ? st.no : "-"}
                                </div>
                              </td>

                              {/* ชื่อ-นามสกุล นักเรียน */}
                              <td style={{padding: "12px 12px", verticalAlign: "middle"}}>
                                <div
                                  onClick={() => setSelectedStudentScorecard(st)}
                                  style={{
                                    fontWeight: 700,
                                    color: "var(--gray-900)",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6
                                  }}>
                                  <span>👤</span>
                                  <span style={{textDecoration: "underline", textUnderlineOffset: 3}}>{st.name}</span>
                                </div>
                                <div style={{fontSize: 11, color: "var(--gray-500)", marginTop: 2}}>
                                  สอบแล้ว {st.totalExamsTaken} วิชา • สอบผ่าน {st.passedExamsCount} วิชา
                                </div>
                              </td>

                              {/* คะแนนเฉลี่ยรวม */}
                              <td style={{padding: "12px 10px", textAlign: "center", verticalAlign: "middle"}}>
                                <div style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: 12,
                                  background: st.level.bg,
                                  border: `1px solid ${st.level.border}`,
                                  color: st.level.color,
                                  fontWeight: 800,
                                  fontSize: 13
                                }}>
                                  {st.meanPct}%
                                </div>
                                <div style={{fontSize: 11, fontWeight: 600, color: st.level.color, marginTop: 2}}>
                                  {st.level.level}
                                </div>
                              </td>

                              {/* 🌟 วิชาที่ยอดเยี่ยม / เด่นที่สุด */}
                              <td style={{padding: "12px 12px", verticalAlign: "middle"}}>
                                <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                  {st.displayedStrengths.map((e: any, eIdx: number) => {
                                    const sg = SUBJECT_GROUPS.find(g => g.id === e.subjectId);
                                    return (
                                      <div
                                        key={eIdx}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 6,
                                          background: "#ECFDF5",
                                          border: "1px solid #A7F3D0",
                                          padding: "3px 8px",
                                          borderRadius: 6,
                                          fontSize: 11.5,
                                          color: "#065F46"
                                        }}>
                                        <span>{sg?.icon || "🌟"}</span>
                                        <span style={{fontWeight: 700, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                                          {e.examTitle}
                                        </span>
                                        <span style={{fontWeight: 800, color: "#047857", marginLeft: "auto"}}>
                                          {e.pct.toFixed(0)}%
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>

                              {/* ⚠️ วิชาที่อ่อน / ควรพัฒนาเร่งด่วน */}
                              <td style={{padding: "12px 12px", verticalAlign: "middle"}}>
                                {st.displayedWeaknesses.length > 0 ? (
                                  <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                    {st.displayedWeaknesses.map((e: any, eIdx: number) => {
                                      const sg = SUBJECT_GROUPS.find(g => g.id === e.subjectId);
                                      return (
                                        <div
                                          key={eIdx}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6,
                                            background: "#FEF2F2",
                                            border: "1px solid #FECACA",
                                            padding: "3px 8px",
                                            borderRadius: 6,
                                            fontSize: 11.5,
                                            color: "#991B1B"
                                          }}>
                                          <span>{sg?.icon || "⚠️"}</span>
                                          <span style={{fontWeight: 700, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                                            {e.examTitle}
                                          </span>
                                          <span style={{fontWeight: 800, color: "#DC2626", marginLeft: "auto"}}>
                                            {e.pct.toFixed(0)}%
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{display: "inline-flex", alignItems: "center", gap: 4, background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "3px 8px", borderRadius: 6, fontSize: 11.5, fontWeight: 700}}>
                                    <span>✅ ผ่านเกณฑ์ทุกวิชา</span>
                                  </div>
                                )}
                              </td>

                              {/* ปุ่มเปิดสมุดพก */}
                              <td style={{padding: "12px 10px", textAlign: "center", verticalAlign: "middle"}}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => setSelectedStudentScorecard(st)}
                                  style={{fontSize: 11.5, padding: "5px 10px", fontWeight: 700}}>
                                  📋 สมุดพก
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

                <div style={{marginTop: 18, textAlign: "right"}}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowStudentDiagnosticsModal(false)}
                    style={{fontWeight: 700}}>
                    ✕ ปิดหน้าต่างกลับสู่ภาพรวม 8 กลุ่มสาระฯ
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: รายชื่อชุดข้อสอบที่ยังไม่มีนักเรียนส่งคำตอบ */}
      {showEmptyExamsModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 16
        }}>
          <div className="card" style={{maxWidth: 620, width: "100%", margin: 0, padding: 24, maxHeight: "90vh", overflowY: "auto"}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16}}>
              <div>
                <h3 style={{fontSize: 17, fontWeight: 700, color: "var(--gray-900)", margin: 0}}>
                  📋 รายชื่อชุดข้อสอบที่ดึงแล้วแต่ยังไม่มีนักเรียนส่งคำตอบ ({schoolwideData.emptyExamsList.length} ชุด)
                </h3>
                <div style={{fontSize: 12.5, color: "var(--gray-500)", marginTop: 4}}>
                  ระบบดึงข้อมูลจาก Google Sheets สำเร็จแล้ว 100% แต่ในชีตเหล่านี้ยังไม่มีแถวคำตอบของนักเรียน
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmptyExamsModal(false)}
                style={{background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--gray-500)"}}>
                ✕
              </button>
            </div>

            <div style={{display: "grid", gap: 10, marginBottom: 18}}>
              {schoolwideData.emptyExamsList.map((ex: any, idx: number) => {
                const sg = ex.subjectGroup;
                return (
                  <div
                    key={ex.id || idx}
                    style={{
                      background: "#FFFBEB",
                      border: "1.5px solid #FDE68A",
                      borderRadius: 8,
                      padding: "12px 14px"
                    }}>
                    <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4}}>
                      <div style={{fontWeight: 700, color: "var(--gray-900)", fontSize: 13.5}}>
                        {idx + 1}. {ex.form_title}
                      </div>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        background: "#FEF3C7",
                        color: "#92400E",
                        padding: "2px 8px",
                        borderRadius: 10,
                        whiteSpace: "nowrap"
                      }}>
                        ผู้สอบ 0 คน
                      </span>
                    </div>

                    <div style={{display: "flex", gap: 8, alignItems: "center", fontSize: 11.5, color: "var(--gray-600)", marginTop: 4}}>
                      <span>{sg?.icon} {sg?.shortName}</span>
                      <span>•</span>
                      <span>คำถาม {ex.question_count || 0} ข้อ</span>
                    </div>

                    <div style={{display: "flex", gap: 8, marginTop: 8}}>
                      {ex.sheet_url && (
                        <a
                          href={ex.sheet_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{fontSize: 11.5, color: "#1D4ED8", textDecoration: "underline", fontWeight: 600}}>
                          📄 ตรวจสอบใน Google Sheets ↗
                        </a>
                      )}
                      {ex.view_url && (
                        <a
                          href={ex.view_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{fontSize: 11.5, color: "#059669", textDecoration: "underline", fontWeight: 600}}>
                          👁️ ลิงก์ทำข้อสอบนักเรียน ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{textAlign: "right"}}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowEmptyExamsModal(false)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: สมุดพกและประวัติผลการสอบนักเรียนรายบุคคล (Comprehensive Scorecard Modal) */}
          {selectedStudentScorecard && (
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16
            }}>
              <div className="card" style={{maxWidth: 720, width: "100%", margin: 0, padding: 24, maxHeight: "90vh", overflowY: "auto"}}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16}}>
                  <div style={{display: "flex", alignItems: "center", gap: 12}}>
                    <div style={{fontSize: 36, background: "#FEF2F2", borderRadius: "50%", width: 54, height: 54, display: "flex", alignItems: "center", justifyContent: "center"}}>
                      🎓
                    </div>
                    <div>
                      <div style={{fontSize: 18, fontWeight: 800, color: "var(--gray-900)"}}>
                        {selectedStudentScorecard.name}
                      </div>
                      <div style={{fontSize: 13, color: "var(--gray-600)", marginTop: 2}}>
                        ห้องเรียน: <strong>{selectedStudentScorecard.room}</strong> | เลขที่: <strong>{selectedStudentScorecard.no !== 9999 ? selectedStudentScorecard.no : "-"}</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentScorecard(null)}
                    style={{background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--gray-500)"}}>
                    ✕
                  </button>
                </div>

                {/* Scorecard Overview KPI */}
                <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16}}>
                  <div style={{background: selectedStudentScorecard.level.bg, border: `1.5px solid ${selectedStudentScorecard.level.border}`, padding: "12px", borderRadius: 8, textAlign: "center"}}>
                    <div style={{fontSize: 11, fontWeight: 700, color: selectedStudentScorecard.level.color}}>คะแนนเฉลี่ยรวมทุกวิชา</div>
                    <div style={{fontSize: 24, fontWeight: 800, color: selectedStudentScorecard.level.color, marginTop: 2}}>
                      {selectedStudentScorecard.meanPct}%
                    </div>
                    <div style={{fontSize: 11, fontWeight: 600, color: selectedStudentScorecard.level.color}}>ระดับ: {selectedStudentScorecard.level.level}</div>
                  </div>

                  <div style={{background: "#F8FAFC", border: "1.5px solid var(--gray-200)", padding: "12px", borderRadius: 8, textAlign: "center"}}>
                    <div style={{fontSize: 11, fontWeight: 700, color: "var(--gray-600)"}}>จำนวนวิชาที่สอบ</div>
                    <div style={{fontSize: 24, fontWeight: 800, color: "var(--gray-900)", marginTop: 2}}>
                      {selectedStudentScorecard.totalExamsTaken}
                    </div>
                    <div style={{fontSize: 11, color: "var(--gray-500)"}}>ชุดข้อสอบ</div>
                  </div>

                  <div style={{background: "#F0FDF4", border: "1.5px solid #BBF7D0", padding: "12px", borderRadius: 8, textAlign: "center"}}>
                    <div style={{fontSize: 11, fontWeight: 700, color: "#166534"}}>ผ่านเกณฑ์ (≥50%)</div>
                    <div style={{fontSize: 24, fontWeight: 800, color: "#166534", marginTop: 2}}>
                      {selectedStudentScorecard.passedExamsCount}
                    </div>
                    <div style={{fontSize: 11, color: "#166534"}}>จาก {selectedStudentScorecard.totalExamsTaken} วิชา</div>
                  </div>
                </div>

                {/* จุดเด่น vs จุดพัฒนา */}
                <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16}}>
                  <div style={{background: "#ECFDF5", border: "1.5px solid #A7F3D0", borderRadius: 8, padding: 12}}>
                    <div style={{fontSize: 12.5, fontWeight: 700, color: "#065F46", marginBottom: 6}}>
                      🌟 วิชาที่ยอดเยี่ยม / โดดเด่น:
                    </div>
                    <div style={{display: "grid", gap: 4}}>
                      {selectedStudentScorecard.displayedStrengths.map((e: any, idx: number) => (
                        <div key={idx} style={{fontSize: 12, color: "#047857", fontWeight: 600}}>
                          • {e.examTitle} (ได้ {e.pct.toFixed(0)}%)
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{background: selectedStudentScorecard.displayedWeaknesses.length > 0 ? "#FEF2F2" : "#F0FDF4", border: `1.5px solid ${selectedStudentScorecard.displayedWeaknesses.length > 0 ? "#FECACA" : "#BBF7D0"}`, borderRadius: 8, padding: 12}}>
                    <div style={{fontSize: 12.5, fontWeight: 700, color: selectedStudentScorecard.displayedWeaknesses.length > 0 ? "#991B1B" : "#166534", marginBottom: 6}}>
                      {selectedStudentScorecard.displayedWeaknesses.length > 0 ? "⚠️ วิชาที่ควรได้รับการสอนเสริม:" : "✅ ผลการประเมินรายวิชา:"}
                    </div>
                    {selectedStudentScorecard.displayedWeaknesses.length > 0 ? (
                      <div style={{display: "grid", gap: 4}}>
                        {selectedStudentScorecard.displayedWeaknesses.map((e: any, idx: number) => (
                          <div key={idx} style={{fontSize: 12, color: "#DC2626", fontWeight: 600}}>
                            • {e.examTitle} (ได้ {e.pct.toFixed(0)}% ต่ำกว่าเกณฑ์)
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{fontSize: 12, color: "#166534", fontWeight: 600}}>
                        นักเรียนสอบผ่านเกณฑ์ทุกวิชา ไม่พบวิชาที่ตก
                      </div>
                    )}
                  </div>
                </div>

                {/* ตารางแจกแจงทุกวิชาที่สอบ */}
                <div style={{marginBottom: 16}}>
                  <div style={{fontSize: 13, fontWeight: 700, color: "var(--gray-800)", marginBottom: 8}}>
                    📋 ผลคะแนนจำแนกตามรายวิชา ({selectedStudentScorecard.exams.length} วิชา):
                  </div>
                  <div style={{maxHeight: 240, overflowY: "auto", border: "1px solid var(--gray-200)", borderRadius: 8}}>
                    <table style={{width: "100%", borderCollapse: "collapse", fontSize: 12}}>
                      <thead>
                        <tr style={{background: "var(--gray-50)", borderBottom: "1.5px solid var(--gray-200)"}}>
                          <th style={{padding: "8px 10px", textAlign: "left"}}>แบบทดสอบ / วิชา</th>
                          <th style={{padding: "8px 10px", textAlign: "center"}}>คะแนนที่ได้</th>
                          <th style={{padding: "8px 10px", textAlign: "center"}}>ร้อยละ</th>
                          <th style={{padding: "8px 10px", textAlign: "center"}}>ผลการประเมิน</th>
                          <th style={{padding: "8px 10px", textAlign: "center"}}>ตรวจคำตอบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedStudentScorecard.exams.map((e: any, idx: number) => {
                          const sg = SUBJECT_GROUPS.find(g => g.id === e.subjectId);
                          const isPass = e.pct >= 50;
                          return (
                            <tr key={idx} style={{borderBottom: "1px solid var(--gray-100)"}}>
                              <td style={{padding: "8px 10px"}}>
                                <div style={{fontWeight: 700, color: "var(--gray-900)"}}>{e.examTitle}</div>
                                <div style={{fontSize: 11, color: "var(--gray-500)"}}>{sg?.icon} {sg?.shortName}</div>
                              </td>
                              <td style={{padding: "8px 10px", textAlign: "center", fontWeight: 700}}>
                                {e.earned} / {e.total}
                              </td>
                              <td style={{padding: "8px 10px", textAlign: "center", fontWeight: 800, color: isPass ? "#047857" : "#DC2626"}}>
                                {e.pct.toFixed(1)}%
                              </td>
                              <td style={{padding: "8px 10px", textAlign: "center"}}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 10,
                                  background: isPass ? "#ECFDF5" : "#FEF2F2",
                                  color: isPass ? "#047857" : "#DC2626"
                                }}>
                                  {isPass ? "✅ ผ่าน" : "❌ ปรับปรุง"}
                                </span>
                              </td>
                              <td style={{padding: "8px 10px", textAlign: "center"}}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => {
                                    setSelectedStudentScorecard(null);
                                    setSelectedExamId(e.examId);
                                    setAnalyticsMode("single_exam");
                                  }}
                                  style={{
                                    fontSize: 11,
                                    padding: "3px 8px",
                                    background: "#FEF3C7",
                                    color: "#92400E",
                                    border: "1px solid #F59E0B",
                                    fontWeight: 700,
                                    borderRadius: 6,
                                    cursor: "pointer"
                                  }}>
                                  ✏️ ตรวจคำตอบ ↗
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{textAlign: "right"}}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedStudentScorecard(null)}>
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* 8 Learning Areas Benchmark Cards */}
          <div className="card" style={{marginBottom: 20}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6}}>
              <div className="card-title" style={{margin:0}}>
                📚 ผลคะแนนเปรียบเทียบ 8 กลุ่มสาระการเรียนรู้ (สพฐ.)
              </div>
              <span style={{fontSize: 12, color: "var(--gray-500)"}}>
                คลิกที่กลุ่มสาระฯ เพื่อเจาะลึกดูชุดข้อสอบ
              </span>
            </div>
            <div className="card-sub" style={{marginBottom: 16}}>
              คำนวณจากคะแนนจริงของทุกชุดข้อสอบในแต่ละกลุ่มสาระฯ
            </div>

            <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14}}>
              {SUBJECT_GROUPS.filter(g => g.id !== "all").map(sg => {
                const st = schoolwideData.subjectStatsMap[sg.id];
                const examCount = st ? st.count : 0;
                const studentSubmissions = st ? st.students : 0;
                const avgPct = examCount > 0 ? (st.avgSum / examCount).toFixed(1) : "-";
                const passRate = examCount > 0 ? (st.passSum / examCount).toFixed(1) : "-";

                return (
                  <div
                    key={sg.id}
                    onClick={() => handleFilterSubjectAndDrilldown(sg.id)}
                    style={{
                      background: "white",
                      border: `1.5px solid ${sg.color}35`,
                      borderRadius: "var(--radius)",
                      padding: 16,
                      cursor: "pointer",
                      transition: "all .15s",
                      boxShadow: "0 2px 6px rgba(0,0,0,.04)"
                    }}>
                    <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10}}>
                      <div style={{display: "flex", alignItems: "center", gap: 8}}>
                        <span style={{fontSize: 20}}>{sg.icon}</span>
                        <span style={{fontWeight: 700, color: "var(--gray-900)", fontSize: 14}}>{sg.name}</span>
                      </div>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 10,
                        background: sg.bgColor,
                        color: sg.color
                      }}>
                        {examCount} ชุด
                      </span>
                    </div>

                    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8}}>
                      <div style={{background: "var(--gray-50)", padding: 8, borderRadius: 6}}>
                        <div style={{fontSize: 11, color: "var(--gray-500)"}}>คะแนนเฉลี่ย</div>
                        <div style={{fontSize: 18, fontWeight: 800, color: sg.color, marginTop: 2}}>
                          {avgPct !== "-" ? `${avgPct}%` : "รอข้อมูล"}
                        </div>
                      </div>
                      <div style={{background: "var(--gray-50)", padding: 8, borderRadius: 6}}>
                        <div style={{fontSize: 11, color: "var(--gray-500)"}}>อัตราสอบผ่าน</div>
                        <div style={{fontSize: 18, fontWeight: 800, color: "#059669", marginTop: 2}}>
                          {passRate !== "-" ? `${passRate}%` : "รอข้อมูล"}
                        </div>
                      </div>
                    </div>

                    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, fontSize: 11.5, color: "var(--gray-500)"}}>
                      <span>ส่งข้อสอบแล้ว: <strong>{studentSubmissions}</strong> ฉบับ</span>
                      <span style={{color: sg.color, fontWeight: 700}}>ดูรายละเอียด →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grade Level (ม.1 - ม.6) Comparison */}
          <div className="card" style={{marginBottom: 20}}>
            <div className="card-title" style={{marginBottom: 4}}>
              🏫 ผลการประเมินแยกตามระดับชั้น (มัธยมศึกษาปีที่ 1 - 6)
            </div>
            <div className="card-sub" style={{marginBottom: 16}}>
              เปรียบเทียบผลสัมฤทธิ์ทางการเรียนและการสอบผ่านในแต่ละระดับชั้น
            </div>

            <div style={{overflowX: "auto"}}>
              <table style={{width: "100%", borderCollapse: "collapse", fontSize: 13}}>
                <thead>
                  <tr style={{background: "var(--gray-50)", borderBottom: "2px solid var(--gray-200)"}}>
                    <th style={{padding: "10px 12px", textAlign: "left"}}>ระดับชั้น</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>จำนวนชุดข้อสอบ</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>นักเรียนรายคน (คน)</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>การส่งข้อสอบ (ฉบับ)</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>คะแนนเฉลี่ย (%)</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>อัตราสอบผ่าน (≥50%)</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: "m1", name: "ชั้นมัธยมศึกษาปีที่ 1 (ม.1)" },
                    { id: "m2", name: "ชั้นมัธยมศึกษาปีที่ 2 (ม.2)" },
                    { id: "m3", name: "ชั้นมัธยมศึกษาปีที่ 3 (ม.3)" },
                    { id: "m4", name: "ชั้นมัธยมศึกษาปีที่ 4 (ม.4)" },
                    { id: "m5", name: "ชั้นมัธยมศึกษาปีที่ 5 (ม.5)" },
                    { id: "m6", name: "ชั้นมัธยมศึกษาปีที่ 6 (ม.6)" },
                  ].map(gr => {
                    const st = schoolwideData.gradeStatsMap[gr.id];
                    const count = st.count;
                    const submissions = st.students;
                    const uniqueCount = st.uniqueStudentsCount;
                    const avgPct = submissions > 0 ? (st.avgSum / submissions).toFixed(1) : "-";
                    const passRate = submissions > 0 ? (st.passSum / submissions).toFixed(1) : "-";

                    return (
                      <tr key={gr.id} style={{borderBottom: "1px solid var(--gray-100)"}}>
                        <td style={{padding: "12px 14px", fontWeight: 700, color: "var(--gray-900)"}}>
                          {gr.name}
                        </td>
                        <td style={{padding: "12px 14px", textAlign: "center"}}>
                          {count} ชุด
                        </td>
                        <td style={{padding: "12px 14px", textAlign: "center", fontWeight: 700, color: "var(--crimson)"}}>
                          {uniqueCount} คน
                        </td>
                        <td style={{padding: "12px 14px", textAlign: "center"}}>
                          {submissions} ฉบับ
                        </td>
                        <td style={{padding: "12px 14px", textAlign: "center", fontWeight: 700}}>
                          {avgPct !== "-" ? `${avgPct}%` : "-"}
                        </td>
                        <td style={{padding: "12px 14px", textAlign: "center"}}>
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 12,
                            fontWeight: 700,
                            fontSize: 12,
                            background: passRate !== "-" && parseFloat(passRate) >= 70 ? "#ECFDF5" : "#FFFBEB",
                            color: passRate !== "-" && parseFloat(passRate) >= 70 ? "#047857" : "#D97706"
                          }}>
                            {passRate !== "-" ? `${passRate}%` : "-"}
                          </span>
                        </td>
                        <td style={{padding: "12px 14px", textAlign: "center"}}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setCurrentGrade(gr.id);
                              setAnalyticsMode("single_exam");
                            }}
                            style={{fontSize: 12}}>
                            ดูข้อสอบ {gr.id.toUpperCase()} ↗
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: SINGLE EXAM DRILL-DOWN DASHBOARD */}
      {/* ========================================================================= */}
      {analyticsMode === "single_exam" && (
        <div>
          {/* Exam Filter Bar */}
          <div className="card" style={{padding: 16, marginBottom: 18}}>
            {/* Subject Filter Pills */}
            <div style={{marginBottom: 12}}>
              <div style={{fontSize: 12, fontWeight: 700, color: "var(--gray-600)", marginBottom: 8}}>
                📚 เลือกกลุ่มสาระการเรียนรู้ (สพฐ.):
              </div>
              <div style={{display: "flex", gap: 6, flexWrap: "wrap"}}>
                {SUBJECT_GROUPS.map((sg) => {
                  const isSelected = currentSubject === sg.id;
                  const count = sg.id === "all" ? history.length : (subjectCounts[sg.id] || 0);
                  return (
                    <button
                      key={sg.id}
                      type="button"
                      onClick={() => setCurrentSubject(sg.id)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        fontSize: 12.5,
                        cursor: "pointer",
                        background: isSelected ? sg.color : "var(--gray-50)",
                        color: isSelected ? "white" : "var(--gray-800)",
                        border: isSelected ? `1.5px solid ${sg.color}` : "1px solid var(--gray-200)",
                        fontWeight: isSelected ? 700 : 500,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all .15s"
                      }}>
                      <span>{sg.icon}</span>
                      <span>{sg.shortName}</span>
                      <span style={{
                        background: isSelected ? "rgba(255,255,255,0.25)" : "var(--gray-200)",
                        color: isSelected ? "white" : "var(--gray-600)",
                        padding: "1px 6px",
                        borderRadius: 10,
                        fontSize: 11
                      }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grade Filter Pills & Search */}
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, paddingTop: 10, borderTop: "1px dashed var(--gray-200)"}}>
              <div style={{display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap"}}>
                <span style={{fontSize: 12, fontWeight: 700, color: "var(--crimson)"}}>🏫 ระดับชั้น:</span>
                {[
                  { id: "all", label: "ทุกชั้น" },
                  { id: "m1", label: "ม.1" },
                  { id: "m2", label: "ม.2" },
                  { id: "m3", label: "ม.3" },
                  { id: "m4", label: "ม.4" },
                  { id: "m5", label: "ม.5" },
                  { id: "m6", label: "ม.6" },
                ].map(g => (
                  <button
                    key={g.id}
                    type="button"
                    className="btn btn-sm"
                    style={{
                      fontSize: 11.5,
                      padding: "3px 12px",
                      borderRadius: 16,
                      background: currentGrade === g.id ? "var(--crimson)" : "var(--gray-100)",
                      color: currentGrade === g.id ? "white" : "var(--gray-700)",
                      border: currentGrade === g.id ? "1px solid var(--crimson)" : "1px solid var(--gray-200)",
                      fontWeight: currentGrade === g.id ? 700 : 500
                    }}
                    onClick={() => setCurrentGrade(g.id)}>
                    {g.label}
                  </button>
                ))}
              </div>

              <div style={{display: "flex", gap: 8, alignItems: "center", minWidth: 260}}>
                <input
                  type="text"
                  placeholder="🔍 ค้นหาชื่อชุดข้อสอบ..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "6px 12px",
                    border: "1.5px solid var(--gray-200)",
                    borderRadius: "var(--radius)",
                    fontSize: 12.5,
                    background: "white",
                    outline: "none"
                  }}
                />
                {searchTerm && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setSearchTerm("")} style={{fontSize: 11}}>
                    ล้าง
                  </button>
                )}
              </div>
            </div>

            {/* Exam Selector Dropdown Bar */}
            <div style={{
              marginTop: 14,
              padding: "12px 16px",
              background: "linear-gradient(135deg, #FEF2F2 0%, #FFFBEB 100%)",
              border: "1.5px solid #FECACA",
              borderRadius: "var(--radius)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12
            }}>
              <div style={{display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 300}}>
                <span style={{fontSize: 13, fontWeight: 700, color: "var(--crimson)", whiteSpace: "nowrap"}}>
                  🎯 เลือกชุดข้อสอบที่วิเคราะห์:
                </span>
                <select
                  value={selectedExamId}
                  onChange={e => setSelectedExamId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px 14px",
                    borderRadius: "var(--radius)",
                    border: "1.5px solid var(--crimson)",
                    fontSize: 13.5,
                    background: "white",
                    color: "var(--gray-900)",
                    fontWeight: 600,
                    outline: "none",
                    cursor: "pointer"
                  }}>
                  {filteredExams.map((h) => {
                    const sg = getExamSubjectGroup(h);
                    return (
                      <option key={h.id} value={h.id}>
                        {sg.icon} [{sg.shortName}] {h.form_title} ({h.question_count || 0} ข้อ)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div style={{display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap"}}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAnalyticsMode("schoolwide")}
                  style={{fontSize: 12, fontWeight: 700}}>
                  ← กลับไปดูภาพรวมทั้งโรงเรียน
                </button>
                {currentExam && (
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={async () => {
                      if (!confirm(`คุณครูต้องการลบแบบทดสอบ "${currentExam.form_title}" ออกจากระบบใช่หรือไม่?\n(สำหรับลบฟอร์มทดสอบ)`)) return;
                      await supabase.from("form_history").delete().eq("id", currentExam.id);
                      if (currentExam.sheet_url) {
                        const sid = currentExam.sheet_url.match(/[-\w]{25,}/)?.[0] || currentExam.sheet_url.trim();
                        examScoreCache.delete(sid);
                        try { localStorage.removeItem(`exam_score_${sid}`); } catch(e){}
                        try { sessionStorage.removeItem(`exam_score_${sid}`); } catch(e){}
                      }
                      setHistory(prev => prev.filter(h => h.id !== currentExam.id));
                      setAnalyticsMode("schoolwide");
                    }}
                    style={{fontSize: 12}}>
                    <TrashIcon /> ลบฟอร์มทดสอบนี้
                  </button>
                )}
                <div style={{fontSize: 12, color: "var(--gray-600)", fontWeight: 600}}>
                  แสดง {filteredExams.length} ชุด
                </div>
              </div>
            </div>
          </div>

          {!currentExam ? (
            <div className="card" style={{textAlign: "center", padding: "48px 20px"}}>
              <div style={{fontSize: 40, marginBottom: 12}}>🔍</div>
              <div style={{fontSize: 16, fontWeight: 700, color: "var(--gray-800)"}}>
                ไม่พบชุดข้อสอบตามเงื่อนไขที่เลือก
              </div>
              <p style={{fontSize: 13, color: "var(--gray-500)", marginTop: 4, marginBottom: 16}}>
                กรุณาคลิกเลือก "ทุกกลุ่มสาระ" หรือล้างคำค้นหาเพื่อเลือกดูข้อสอบชุดอื่น
              </p>
              <button className="btn btn-secondary btn-sm" onClick={() => { setCurrentSubject("all"); setCurrentGrade("all"); setSearchTerm(""); }}>
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          ) : (
            <ExamScoreDashboard exam={currentExam} onBack={() => setAnalyticsMode("schoolwide")} user={user} />
          )}
        </div>
      )}
    </div>
  );
}

// ============ SHEETS & RESULTS TAB ============
function SheetsTab({
  user,
  selectedGrade,
  setSelectedGrade,
  selectedRoom,
  setSelectedRoom,
  selectedSubject = "all",
  setSelectedSubject
}: any) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [viewingExam, setViewingExam] = useState<any>(null);
  const [localSubject, setLocalSubject] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "analytics">("cards");

  const currentSubject = setSelectedSubject ? selectedSubject : localSubject;
  const setCurrentSubject = setSelectedSubject || setLocalSubject;

  const fetchHistory = async () => {
    setLoading(true);
    let query = supabase.from("form_history").select("*").order("created_at", { ascending: false });
    if (user.role !== "admin") query = query.eq("license_key", user.key);
    const { data } = await query;
    setHistory(data || []);
    setLoading(false);
  };

  const handleDeleteForm = async (item: any) => {
    if (!window.confirm(`คุณครูต้องการลบแบบทดสอบ "${item.form_title}" ออกจากระบบใช่หรือไม่?\n\n⚠️ คำเตือน: ฟอร์มนี้จะถูกลบออกจากฐานข้อมูลระบบ และจะไม่แสดงในแดชบอร์ดสรุปผลคะแนนอีกต่อไป (เหมาะสำหรับลบฟอร์มทดสอบ)`)) {
      return;
    }
    try {
      const { error } = await supabase.from("form_history").delete().eq("id", item.id);
      if (error) throw error;
      if (item.sheet_url) {
        const sheetId = item.sheet_url.match(/[-\w]{25,}/)?.[0] || item.sheet_url.trim();
        examScoreCache.delete(sheetId);
        try { localStorage.removeItem(`exam_score_${sheetId}`); } catch(e){}
        try { sessionStorage.removeItem(`exam_score_${sheetId}`); } catch(e){}
      }
      setHistory(prev => prev.filter(h => h.id !== item.id));
      alert(`ลบแบบทดสอบ "${item.form_title}" เรียบร้อยแล้ว`);
    } catch (err: any) {
      alert(`เกิดข้อผิดพลาดในการลบ: ${err.message}`);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const subjectCounts = useMemo(() => {
    const map: Record<string, number> = {};
    history.forEach(h => {
      const sg = getExamSubjectGroup(h);
      map[sg.id] = (map[sg.id] || 0) + 1;
    });
    return map;
  }, [history]);

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
    const sg = getExamSubjectGroup(h);
    const matchSub = currentSubject === "all" || sg.id === currentSubject;
    return matchSearch && matchR && matchSub;
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
          <p style={{fontSize:14, opacity:.9, margin:0, maxWidth:680}}>
            ชีตคะแนนและคำตอบของนักเรียนจะซิงค์อัตโนมัติแบบเรียลไทม์ คุณครูสามารถเลือกกรองตาม <strong>กลุ่มสาระการเรียนรู้ (8 กลุ่มสาระ)</strong>, ระดับชั้น และห้องเรียนได้ทันที
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

      {/* View Mode Switcher */}
      <div style={{display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap"}}>
        <button
          type="button"
          onClick={() => setViewMode("cards")}
          style={{
            padding: "9px 20px",
            borderRadius: 20,
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            background: viewMode === "cards" ? "var(--crimson)" : "white",
            color: viewMode === "cards" ? "white" : "var(--gray-700)",
            border: viewMode === "cards" ? "none" : "1.5px solid var(--gray-300)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: viewMode === "cards" ? "0 2px 8px rgba(153,27,27,.25)" : "none",
            transition: "all .15s"
          }}>
          <span>📋 รายการชีตข้อสอบ</span>
          <span style={{
            background: viewMode === "cards" ? "rgba(255,255,255,0.25)" : "var(--gray-100)",
            color: viewMode === "cards" ? "white" : "var(--gray-700)",
            padding: "1px 8px",
            borderRadius: 10,
            fontSize: 11.5
          }}>
            {filtered.length} ชุด
          </span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode("analytics")}
          style={{
            padding: "9px 20px",
            borderRadius: 20,
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            background: viewMode === "analytics" ? "var(--crimson)" : "white",
            color: viewMode === "analytics" ? "white" : "var(--gray-700)",
            border: viewMode === "analytics" ? "none" : "1.5px solid var(--gray-300)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: viewMode === "analytics" ? "0 2px 8px rgba(153,27,27,.25)" : "none",
            transition: "all .15s"
          }}>
          <span>📈 แดชบอร์ดวิเคราะห์ 8 กลุ่มสาระฯ (สพฐ.)</span>
        </button>
      </div>

      {viewMode === "analytics" ? (
        <div>
          {/* Institutional KPI Cards */}
          <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20}}>
            <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid var(--crimson)", background: "linear-gradient(135deg, #FFFFFF 0%, #FEF2F2 100%)"}}>
              <div style={{fontSize: 12.5, fontWeight: 600, color: "var(--gray-600)", marginBottom: 4}}>
                📚 ข้อสอบทั้งหมดในระบบ
              </div>
              <div style={{fontSize: 26, fontWeight: 800, color: "var(--crimson)"}}>
                {history.length} ชุด
              </div>
              <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                ครอบคลุม 8 กลุ่มสาระการเรียนรู้
              </div>
            </div>

            <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #2563EB", background: "linear-gradient(135deg, #FFFFFF 0%, #EFF6FF 100%)"}}>
              <div style={{fontSize: 12.5, fontWeight: 600, color: "var(--gray-600)", marginBottom: 4}}>
                ❓ คำถามที่สร้างแล้วทั้งหมด
              </div>
              <div style={{fontSize: 26, fontWeight: 800, color: "#1D4ED8"}}>
                {history.reduce((acc: number, h: any) => acc + (h.question_count || 0), 0)} ข้อ
              </div>
              <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                พร้อมเฉลยและเกณฑ์การให้คะแนน
              </div>
            </div>

            <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #059669", background: "linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)"}}>
              <div style={{fontSize: 12.5, fontWeight: 600, color: "var(--gray-600)", marginBottom: 4}}>
                🏫 กลุ่มสาระฯ ที่มีความเคลื่อนไหว
              </div>
              <div style={{fontSize: 26, fontWeight: 800, color: "#047857"}}>
                {SUBJECT_GROUPS.filter(sg => sg.id !== "all" && (subjectCounts[sg.id] || 0) > 0).length} / 8 กลุ่ม
              </div>
              <div style={{fontSize: 12, color: "var(--gray-500)", marginTop: 4}}>
                กลุ่มสาระการเรียนรู้ สพฐ.
              </div>
            </div>

            <div className="card" style={{margin:0, padding: 18, borderLeft: "5px solid #D97706", background: "linear-gradient(135deg, #FFFFFF 0%, #FFFBEB 100%)"}}>
              <div style={{fontSize: 12.5, fontWeight: 600, color: "var(--gray-600)", marginBottom: 4}}>
                🏆 กลุ่มสาระฯ ที่จัดสอบมากที่สุด
              </div>
              {(() => {
                const active = SUBJECT_GROUPS.filter(sg => sg.id !== "all").sort((a, b) => (subjectCounts[b.id] || 0) - (subjectCounts[a.id] || 0));
                const top = active[0];
                return (
                  <div>
                    <div style={{fontSize: 20, fontWeight: 800, color: "#B45309"}}>
                      {top?.icon} {top?.shortName}
                    </div>
                    <div style={{fontSize: 12, color: "var(--gray-600)", marginTop: 4}}>
                      จัดทำแล้ว {subjectCounts[top?.id] || 0} ชุดข้อสอบ
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Learning Areas Distribution Bar Chart */}
          <div className="card" style={{marginBottom: 20}}>
            <div className="card-title" style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 4}}>
              <span>📊 แผนภูมิเปรียบเทียบสัดส่วนข้อสอบ 8 กลุ่มสาระการเรียนรู้ (สพฐ.)</span>
            </div>
            <div className="card-sub" style={{marginBottom: 20}}>
              แสดงสัดส่วนการจัดสร้างแบบทดสอบออนไลน์ของโรงเรียนวังหลวงพิทยาสรรพ์
            </div>

            <div style={{display: "grid", gap: 12}}>
              {SUBJECT_GROUPS.filter(sg => sg.id !== "all").map(sg => {
                const count = subjectCounts[sg.id] || 0;
                const pct = history.length > 0 ? (count / history.length) * 100 : 0;
                return (
                  <div key={sg.id} style={{display: "flex", alignItems: "center", gap: 12, fontSize: 13}}>
                    <div style={{width: 160, flexShrink: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: 8}}>
                      <span style={{fontSize: 20}}>{sg.icon}</span>
                      <span style={{color: sg.color}}>{sg.shortName}</span>
                    </div>
                    <div style={{flex: 1, background: "var(--gray-100)", borderRadius: 8, height: 24, overflow: "hidden", position: "relative"}}>
                      <div style={{
                        background: sg.color,
                        height: "100%",
                        width: `${pct}%`,
                        borderRadius: 8,
                        transition: "width .5s ease"
                      }}/>
                    </div>
                    <div style={{width: 110, textAlign: "right", flexShrink: 0, fontWeight: 700, color: count > 0 ? sg.color : "var(--gray-400)"}}>
                      {count} ชุด ({pct.toFixed(1)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Learning Areas Table */}
          <div className="card">
            <div className="card-title" style={{marginBottom: 4}}>
              📋 ตารางแจกแจงข้อมูล 8 กลุ่มสาระการเรียนรู้
            </div>
            <div className="card-sub" style={{marginBottom: 16}}>
              คลิกปุ่ม "ดูข้อสอบกลุ่มนี้" เพื่อเปิดดูและวิเคราะห์คะแนนข้อสอบในกลุ่มสาระฯ นั้น
            </div>

            <div style={{overflowX: "auto"}}>
              <table style={{width: "100%", borderCollapse: "collapse", fontSize: 13}}>
                <thead>
                  <tr style={{background: "var(--gray-50)", borderBottom: "2px solid var(--gray-200)"}}>
                    <th style={{padding: "10px 12px", textAlign: "left"}}>กลุ่มสาระการเรียนรู้</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>รหัสวิชาขึ้นต้น</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>ชุดข้อสอบ (ชุด)</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>สัดส่วน (%)</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>สถานะการประเมิน</th>
                    <th style={{padding: "10px 12px", textAlign: "center"}}>ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBJECT_GROUPS.filter(sg => sg.id !== "all").map(sg => {
                    const count = subjectCounts[sg.id] || 0;
                    const pct = history.length > 0 ? (count / history.length) * 100 : 0;
                    return (
                      <tr key={sg.id} style={{borderBottom: "1px solid var(--gray-100)"}}>
                        <td style={{padding: "12px 12px"}}>
                          <div style={{display: "flex", alignItems: "center", gap: 10}}>
                            <span style={{fontSize: 24}}>{sg.icon}</span>
                            <div>
                              <div style={{fontWeight: 700, color: "var(--gray-900)"}}>{sg.name}</div>
                              <div style={{fontSize: 11.5, color: "var(--gray-500)"}}>หมวด {sg.shortName}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{padding: "12px 12px", textAlign: "center"}}>
                          <span style={{background: sg.bgColor, color: sg.color, fontWeight: 700, padding: "2px 8px", borderRadius: 8, fontSize: 12}}>
                            {sg.codePrefix ? `${sg.codePrefix}*` : "-"}
                          </span>
                        </td>
                        <td style={{padding: "12px 12px", textAlign: "center", fontWeight: 700, fontSize: 14, color: sg.color}}>
                          {count} ชุด
                        </td>
                        <td style={{padding: "12px 12px", textAlign: "center", fontWeight: 600}}>
                          {pct.toFixed(1)}%
                        </td>
                        <td style={{padding: "12px 12px", textAlign: "center"}}>
                          <span style={{
                            padding: "3px 10px",
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: count > 0 ? "#ECFDF5" : "var(--gray-100)",
                            color: count > 0 ? "#047857" : "var(--gray-500)"
                          }}>
                            {count > 0 ? "✅ มีข้อสอบในระบบ" : "⏳ ยังไม่มีข้อสอบ"}
                          </span>
                        </td>
                        <td style={{padding: "12px 12px", textAlign: "center"}}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setCurrentSubject(sg.id);
                              setViewMode("cards");
                            }}
                            style={{fontSize: 12, padding: "4px 12px", fontWeight: 700}}>
                            🔍 ดูข้อสอบกลุ่มนี้
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* 8 Learning Areas Dashboard Cards */}
      <div className="card" style={{padding: "16px 20px", marginBottom: 16}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8}}>
          <div style={{fontSize: 14, fontWeight: 700, color: "var(--gray-800)", display: "flex", alignItems: "center", gap: 8}}>
            <span>📚 จำแนกตาม 8 กลุ่มสาระการเรียนรู้</span>
            <span style={{fontSize: 11.5, fontWeight: 500, color: "var(--gray-500)"}}>
              (คลิกเพื่อเลือกดูเฉพาะกลุ่มสาระที่ต้องการ)
            </span>
          </div>
          {currentSubject !== "all" && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              style={{fontSize: 11.5, color: "var(--crimson)", fontWeight: 600}}
              onClick={() => setCurrentSubject("all")}>
              ✕ แสดงทุกกลุ่มสาระ ({history.length})
            </button>
          )}
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 8
        }}>
          {SUBJECT_GROUPS.map(sg => {
            const count = sg.id === "all" ? history.length : (subjectCounts[sg.id] || 0);
            const isSelected = currentSubject === sg.id;
            return (
              <div
                key={sg.id}
                onClick={() => setCurrentSubject(sg.id)}
                style={{
                  background: isSelected ? (sg.id === "all" ? "var(--crimson-light)" : sg.bgColor) : "#F8FAFC",
                  border: isSelected ? `2px solid ${sg.id === "all" ? "var(--crimson)" : sg.color}` : "1.5px solid var(--gray-200)",
                  borderRadius: "10px",
                  padding: "10px 10px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all .15s",
                  boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.08)" : "none"
                }}>
                <div style={{fontSize: 20, marginBottom: 2}}>{sg.icon}</div>
                <div style={{
                  fontSize: 12,
                  fontWeight: isSelected ? 800 : 600,
                  color: isSelected ? (sg.id === "all" ? "var(--crimson)" : sg.color) : "var(--gray-700)",
                  lineHeight: 1.2
                }}>
                  {sg.shortName}
                </div>
                <div style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: isSelected ? (sg.id === "all" ? "var(--crimson)" : sg.color) : "var(--gray-500)",
                  marginTop: 4
                }}>
                  {count} <span style={{fontSize: 10, fontWeight: 500}}>ชุด</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grade & Room Filter Bar */}
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
              ✕ ดูทุกระดับชั้น
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
            ไม่พบข้อสอบตามเงื่อนไขที่เลือก
          </div>
          <div style={{fontSize:13, color:"var(--gray-500)", maxWidth:420, margin:"0 auto 16px"}}>
            {currentSubject !== "all"
              ? `ไม่พบข้อสอบในกลุ่มสาระฯ ${SUBJECT_GROUPS.find(g => g.id === currentSubject)?.name}`
              : selectedGrade !== "all" || selectedRoom !== "all"
              ? `ไม่พบชีตข้อสอบที่ตรงกับ ${selectedRoom !== "all" ? selectedRoom : GRADE_LABELS[selectedGrade] || selectedGrade}`
              : "เมื่อคุณครูสร้าง Google Form ข้อสอบใหม่ ระบบจะสร้าง Google Sheet บันทึกคะแนนและคำตอบให้อัตโนมัติ"}
          </div>
          {(currentSubject !== "all" || selectedGrade !== "all" || selectedRoom !== "all" || search) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setCurrentSubject("all"); setSelectedGrade("all"); setSelectedRoom("all"); setSearch(""); }}>
              ดูชีตข้อสอบทั้งหมด ({history.length} ชุด)
            </button>
          )}
        </div>
      ) : (
        <div style={{display:"grid", gap:16}}>
          {filtered.map((item, idx) => {
            const sg = getExamSubjectGroup(item);
            return (
            <div key={item.id} className="card" style={{margin:0, borderLeft:`5px solid ${sg.color}`}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12}}>
                <div style={{flex:1, minWidth:260}}>
                  <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap"}}>
                    <span style={{fontSize:12, fontWeight:700, color:"var(--crimson)", background:"var(--crimson-light)", padding:"2px 8px", borderRadius:20}}>
                      #{filtered.length - idx}
                    </span>
                    <span style={{
                      background: sg.bgColor,
                      color: sg.color,
                      border: `1px solid ${sg.borderColor}`,
                      padding: "2px 9px",
                      borderRadius: 14,
                      fontSize: 11.5,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4
                    }}>
                      <span>{sg.icon}</span>
                      <span>{sg.shortName}</span>
                    </span>
                    <span style={{fontSize:16, fontWeight:700, color:"var(--gray-900)"}}>
                      {item.form_title}
                    </span>
                  </div>
                  {cleanDesc(item.form_desc) && (
                    <div style={{fontSize:13, color:"var(--gray-600)", marginBottom:8}}>
                      {cleanDesc(item.form_desc)}
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
                    <button
                      className="btn-delete"
                      onClick={() => handleDeleteForm(item)}
                      title="ลบฟอร์มนี้ออกจากระบบ (สำหรับลบฟอร์มทดสอบ)">
                      <TrashIcon /> ลบฟอร์ม
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
          );
        })}
        </div>
      )}
        </>
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
    </div>
  );
}

// ============ MAIN APP ============
export default function App() {
  // Check URL parameters for direct student exam access
  const urlParams = new URLSearchParams(window.location.search);
  const examIdFromUrl = urlParams.get("exam_id") || urlParams.get("exam") || urlParams.get("id");
  const isExamRoute = window.location.pathname.includes("/exam") || window.location.hash.includes("/exam");

  if (examIdFromUrl || isExamRoute) {
    return (
      <ExamPlayer
        examIdProp={examIdFromUrl || undefined}
        onExit={() => {
          window.history.replaceState({}, "", window.location.pathname);
          window.location.reload();
        }}
      />
    );
  }

  // Default executive user - NO LOGIN REQUIRED! Everyone can immediately view data and dashboards
  const GUEST_EXECUTIVE = {
    role: "guest_executive",
    is_guest: true,
    is_google: false,
    key: "guest_executive",
    email: "executive@wangluangpitt.ac.th",
    name: "ผู้บริหารสถานศึกษา (ผู้เยี่ยมชม)",
    daily_limit: 0
  };

  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("fromauto_user");
      if (saved) return JSON.parse(saved);
    } catch {}
    return GUEST_EXECUTIVE;
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRedirectTab, setLoginRedirectTab] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);

  const isTeacherLoggedIn = Boolean(user && !user.is_guest);

  const handleLogin = (u: any) => {
    localStorage.setItem("fromauto_user", JSON.stringify(u));
    setUser(u);
    setShowLoginModal(false);
    if (loginRedirectTab) {
      setTab(loginRedirectTab);
      setLoginRedirectTab(null);
    } else {
      setTab("create");
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("fromauto_user");
    setUser(GUEST_EXECUTIVE);
    setTab("executive");
    await supabase.auth.signOut().catch(() => {});
  };

  const requireTeacherAccess = (targetTab: string) => {
    if (isTeacherLoggedIn) {
      if (targetTab === "create") handleReset();
      setTab(targetTab);
    } else {
      setLoginRedirectTab(targetTab);
      setShowLoginModal(true);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email && session.user.email.endsWith("@wangluangpitt.ac.th")) {
        const isAdmin = session.user.email.toLowerCase() === "pongsarkon@wangluangpitt.ac.th";
        const teacher = {
          key: session.user.email,
          role: isAdmin ? "admin" : "user",
          note: session.user.user_metadata?.full_name || session.user.email,
          daily_limit: 999999,
          is_google: true,
          is_guest: false
        };
        setUser(teacher);
        localStorage.setItem("fromauto_user", JSON.stringify(teacher));
      }
    });
  }, []);

  const [tab, setTab] = useState("executive");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [targetGrade, setTargetGrade] = useState("");
  const [targetRooms, setTargetRooms] = useState<string[]>([]);
  const [targetSubject, setTargetSubject] = useState("");
  const [realHistory, setRealHistory] = useState<any[]>([]);

  const fetchGlobalHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("form_history").select("*").order("created_at", { ascending:false });
      if (error) throw error;
      setRealHistory(data || []);
    } catch {
      try {
        const local = JSON.parse(localStorage.getItem("fromauto_history") || "[]");
        setRealHistory(local);
      } catch {
        setRealHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    fetchGlobalHistory();
  }, [fetchGlobalHistory]);

  const handleUseTemplate = (templateData?: { title: string; desc: string; questions: any[] }) => {
    if (templateData) {
      setFormTitle(templateData.title);
      setFormDesc(templateData.desc);
      if (templateData.questions && templateData.questions.length > 0) {
        setQuestions(templateData.questions);
        setStep(2);
      } else {
        setStep(0);
      }
    } else {
      setStep(0);
    }
    if (!isTeacherLoggedIn) {
      setLoginRedirectTab("create");
      setShowLoginModal(true);
    } else {
      setTab("create");
    }
  };
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
  const [targetTotalScore, setTargetTotalScore] = useState<number>(0);
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

      const subjectGroupObj = SUBJECT_GROUPS.find(g => g.id === targetSubject);
      const subjectTag = subjectGroupObj && subjectGroupObj.id !== "all"
        ? `[กลุ่มสาระ: ${subjectGroupObj.name}]`
        : "";
      const roomsTag = targetRooms.length > 0
        ? `[ห้อง: ${targetRooms.join(", ")}]`
        : targetGrade
        ? `[ระดับชั้น: ${targetGrade}]`
        : "";
      const combinedTags = [subjectTag, roomsTag].filter(Boolean).join(" ");
      const finalDesc = combinedTags
        ? `${formDesc ? formDesc + " " : ""}${combinedTags}`
        : formDesc;

      const calculatedTotal = targetTotalScore > 0 ? targetTotalScore : cleanedQuestions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
      const pointsTag = `[คะแนนเต็ม: ${calculatedTotal}]`;
      const enrichedDesc = finalDesc ? `${finalDesc} ${pointsTag}` : pointsTag;

      const res = await fetch(SCRIPT_URL, {
        method:"POST",
        body: JSON.stringify({
          title: formTitle,
          description: formDesc.trim(),
          headers,
          questions: cleanedQuestions,
          targetTotalPoints: calculatedTotal,
          teacherEmail: user.is_google ? user.key : undefined
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setLoadingStepIndex(4);
      await new Promise(r => setTimeout(r, 600));
      clearInterval(iv);
      setLoading(false);

      const newHistoryItem = {
        id: Date.now().toString(),
        license_key: user.key,
        form_title: formTitle,
        form_desc: enrichedDesc || null,
        edit_url: data.editUrl?.trim(),
        view_url: data.viewUrl?.trim(),
        sheet_url: data.sheetUrl?.trim() || null,
        question_count: questions.length,
        header_count: headers.length,
        created_at: new Date().toISOString(),
      };
      try {
        await supabase.from("form_history").insert(newHistoryItem);
      } catch (e) {
        console.warn("Supabase insert skipped:", e);
      }
      try {
        const local = JSON.parse(localStorage.getItem("fromauto_history") || "[]");
        localStorage.setItem("fromauto_history", JSON.stringify([newHistoryItem, ...local]));
      } catch {}

      fetchGlobalHistory();

      setResult({
        title: formTitle,
        questionCount: questions.length,
        headerCount: headers.length,
        links: {
          edit: data.editUrl?.trim(),
          view: data.viewUrl?.trim(),
          sheet: data.sheetUrl?.trim()
        }
      });
      setStep(4);
    } catch(err: any) {
      clearInterval(iv);
      setLoading(false);
      setSubmitError(err.message);
    }
  };

  const handleReset = () => {
    setStep(0);
    setResult(null);
    setQuestions([]);
    setFormTitle("");
    setFormDesc("");
    setTargetGrade("");
    setTargetRooms([]);
    setTargetSubject("");
    setSubmitError("");
  };
  useEffect(() => {
    if (!user || user.role === "admin" || user.is_google) return;
    supabase.rpc("get_my_usage", { p_key: user.key })
      .then(({ data }) => setUsageCount(data ?? 0));
  }, [user]);

  const isSchoolUser = true; // Always enable school identity and full features without login barrier
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
                โรงเรียนวังหลวงพิทยาสรรพ์
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
              </div>
              <div style={{fontSize: 11.5, color: "rgba(255, 255, 255, 0.85)", fontWeight: 400}}>
                ระบบคลังข้อสอบ & ศูนย์ข้อมูลผู้บริหาร (Executive Intelligence)
              </div>
            </div>
          </div>

          <div className="topbar-user">
            <button
              className="btn btn-sm"
              style={{
                background: tab === "executive" ? "white" : "rgba(255,255,255,0.18)",
                color: tab === "executive" ? "#6D28D9" : "white",
                fontWeight: 700,
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.3)"
              }}
              onClick={() => setTab("executive")}
            >
              <ExecutiveIcon /> แดชบอร์ดผู้บริหาร
            </button>
            <button
              className="btn btn-sm"
              style={{
                background: tab === "bank" ? "white" : "rgba(255,255,255,0.18)",
                color: tab === "bank" ? "#6D28D9" : "white",
                fontWeight: 700,
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.3)"
              }}
              onClick={() => setTab("bank")}
            >
              <ExamBankIcon /> คลังข้อสอบ
            </button>
            <button
              className="btn btn-sm"
              style={{
                background: tab === "question_bank" ? "white" : "rgba(255,255,255,0.18)",
                color: tab === "question_bank" ? "#0F172A" : "white",
                fontWeight: 700,
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.3)"
              }}
              onClick={() => setTab("question_bank")}
            >
              📚 ข้อสอบกลาง 2,176 ข้อ
            </button>
            <button
              className="btn btn-sm"
              style={{
                background: "#FBBF24",
                color: "#78350F",
                fontWeight: 700,
                borderRadius: "20px"
              }}
              onClick={() => requireTeacherAccess("create")}
            >
              + ออกแบบข้อสอบ AI
            </button>

            {isTeacherLoggedIn ? (
              <>
                <span className="role-badge role-admin">
                  {user.role === "admin" ? "👑 Admin" : "🏫 คุณครู ว.พ."} ({user.note || user.name || user.email})
                </span>
                <button
                  className="btn btn-sm"
                  style={{
                    background: "rgba(255,255,255,0.18)",
                    color: "white",
                    borderRadius: "16px",
                    padding: "4px 10px",
                    border: "1px solid rgba(255,255,255,0.25)"
                  }}
                  onClick={handleLogout}
                  title="ออกจากระบบคุณครู"
                >
                  <LogoutIcon /> ออกจากระบบ
                </button>
              </>
            ) : (
              <>
                <span className="role-badge" style={{
                  background: "rgba(255,255,255,0.18)",
                  color: "#FEF3C7",
                  border: "1px solid rgba(255,255,255,0.25)",
                  padding: "4px 10px"
                }}>
                  🏛️ ผู้บริหาร (ผู้เยี่ยมชม)
                </span>
                <button
                  className="btn btn-sm"
                  style={{
                    background: "white",
                    color: "var(--crimson)",
                    fontWeight: 700,
                    borderRadius: "20px",
                    padding: "5px 14px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    border: "none"
                  }}
                  onClick={() => { setLoginRedirectTab("create"); setShowLoginModal(true); }}
                >
                  🔐 เข้าสู่ระบบคุณครู
                </button>
              </>
            )}
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

            <div className="sidebar-section">แดชบอร์ด & คลังข้อสอบ</div>
            <button className={`sidebar-item ${tab==="executive"?"active":""}`} onClick={() => setTab("executive")}>
              <ExecutiveIcon /> แดชบอร์ดผู้บริหาร
            </button>
            <button className={`sidebar-item ${tab==="bank"?"active":""}`} onClick={() => setTab("bank")}>
              <ExamBankIcon /> ระบบคลังข้อสอบ
            </button>

            <button
              className={`sidebar-item ${tab==="question_bank"?"active":""}`}
              onClick={() => setTab("question_bank")}
              style={tab==="question_bank" ? {
                background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                color: "white",
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(15,23,42,.25)"
              } : {}}
            >
              📚 คลังข้อสอบกลาง
              <span style={{
                marginLeft: "auto",
                background: tab==="question_bank" ? "rgba(255,255,255,0.25)" : "var(--gray-200)",
                color: tab==="question_bank" ? "white" : "var(--gray-800)",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 10
              }}>
                2,176 ข้อ
              </span>
            </button>

            <button
              className={`sidebar-item ${tab==="exam_player"?"active":""}`}
              onClick={() => setTab("exam_player")}
              style={tab==="exam_player" ? {
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                color: "white",
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(5,150,105,.25)"
              } : {}}
            >
              📝 ระบบทำข้อสอบออนไลน์
              <span style={{
                marginLeft: "auto",
                background: tab==="exam_player" ? "rgba(255,255,255,0.25)" : "#ECFDF5",
                color: tab==="exam_player" ? "white" : "#047857",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 10,
                border: "1px solid #A7F3D0"
              }}>
                Secure Player
              </span>
            </button>

            <button
              className={`sidebar-item ${tab==="dashboard"?"active":""}`}
              onClick={() => { setTab("dashboard"); setSelectedGrade("all"); setSelectedRoom("all"); }}
              style={tab==="dashboard" ? {
                background: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)",
                color: "white",
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(153,27,27,.25)"
              } : {
                color: "var(--crimson)",
                fontWeight: 600
              }}
            >
              <ChartIcon /> 📊 แดชบอร์ดวิเคราะห์คะแนน
              <span style={{
                marginLeft: "auto",
                background: tab==="dashboard" ? "rgba(255,255,255,0.25)" : "#F59E0B",
                color: tab==="dashboard" ? "white" : "#78350F",
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 7px",
                borderRadius: 10
              }}>
                พร้อมดู
              </span>
            </button>

            <div className="sidebar-section">เครื่องมือคุณครู (ต้องล็อกอิน)</div>
            <button
              className={`sidebar-item ${tab==="create"?"active":""}`}
              onClick={() => requireTeacherAccess("create")}
            >
              <FormIcon /> สร้างข้อสอบใหม่ (AI)
            </button>

            <div style={{marginTop: 2, marginBottom: 4}}>
              <button
                className={`sidebar-item ${tab==="sheets"?"active":""}`}
                onClick={() => {
                  requireTeacherAccess("sheets");
                  setSelectedGrade("all");
                  setSelectedRoom("all");
                }}
                style={tab==="sheets"?{
                  background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                  color: "#FDE047",
                  fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(15,23,42,.3)"
                }:{}}>
                <SheetIcon /> 📋 ตรวจคำตอบ & ชีตคะแนน
                <span style={{
                  marginLeft: "auto",
                  background: tab==="sheets" ? "rgba(253,224,71,0.2)" : "#FEF3C7",
                  color: tab==="sheets" ? "#FEF08A" : "#92400E",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 7px",
                  borderRadius: 10,
                  border: "1px solid #FCD34D"
                }}>
                  ✍️ ตรวจรายคน
                </span>
              </button>

              <button
                className={`sidebar-item ${tab==="sgs"?"active":""}`}
                onClick={() => {
                  setTab("sgs");
                }}
                style={tab==="sgs"?{
                  background: "linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 100%)",
                  color: "white",
                  fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(29,78,216,.35)"
                }:{
                  color: "#1D4ED8",
                  fontWeight: 600
                }}>
                <span>⚡</span> <span>ระบบคะแนน SGS & Auto-Fill</span>
                <span style={{
                  marginLeft: "auto",
                  background: tab==="sgs" ? "rgba(255,255,255,0.25)" : "#DBEAFE",
                  color: tab==="sgs" ? "white" : "#1E40AF",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "2px 7px",
                  borderRadius: 10,
                  border: "1px solid #BFDBFE"
                }}>
                  SGS Direct
                </span>
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

            <button className={`sidebar-item ${tab==="history"?"active":""}`} onClick={() => requireTeacherAccess("history")}>
              <FormIcon /> ประวัติฟอร์ม
            </button>
            {isTeacherLoggedIn ? (
              <>
                {user.role==="admin" && (
                  <>
                    <div className="sidebar-section">Admin</div>
                    <button className={`sidebar-item ${tab==="admin"?"admin-active":""}`} onClick={() => setTab("admin")}>
                      <KeyIcon /> จัดการ License Keys
                    </button>
                  </>
                )}
                <div className="sidebar-section">คุณครูผู้ใช้งาน</div>
                <div style={{ padding: "8px 12px", background: "var(--gray-100)", borderRadius: 8, fontSize: 12, marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, color: "var(--gray-900)" }}>{user.note || user.name || user.email}</div>
                  <div style={{ color: "var(--gray-500)", fontSize: 11 }}>{user.role === "admin" ? "👑 ผู้ดูแลระบบ (Admin)" : "🏫 คุณครู ว.พ."}</div>
                </div>
                <button className="sidebar-item" onClick={handleLogout} title="ออกจากระบบคุณครู">
                  <LogoutIcon /> ออกจากระบบ (กลับสู่โหมดผู้บริหาร)
                </button>
              </>
            ) : (
              <>
                <div className="sidebar-section">สำหรับคุณครู</div>
                <button
                  className="sidebar-item"
                  style={{
                    background: "var(--crimson-light)",
                    color: "var(--crimson)",
                    fontWeight: 700,
                    borderRadius: 8
                  }}
                  onClick={() => { setLoginRedirectTab("create"); setShowLoginModal(true); }}
                >
                  🔐 เข้าสู่ระบบคุณครู (@wangluangpitt)
                </button>
              </>
            )}
            <div style={{ marginTop: "16px", marginBottom: "16px" }}>
              <div style={{
                background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
                border: "1px solid #DDD6FE",
                borderRadius: "10px",
                padding: "12px",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#6D28D9", marginBottom: "4px" }}>
                  🏛️ โหมดนำเสนอผู้บริหาร
                </div>
                <div style={{ fontSize: "11px", color: "var(--gray-600)", lineHeight: "1.4", marginBottom: "8px" }}>
                  ข้อมูลคลังข้อสอบและสถิติวัดผลพร้อมนำเสนอวันนี้
                </div>
                <button
                  className="btn btn-sm"
                  style={{ background: "#7C3AED", color: "white", width: "100%", fontSize: "11px", padding: "6px" }}
                  onClick={() => window.print()}
                >
                  🖨️ พิมพ์รายงานสรุป
                </button>
              </div>
            </div>

            <div className="sidebar-footer">
              develop by พงศกร ดรโคตร์กอก
            </div>
          </div>

          <div className="content">
            {tab === "executive" ? (
              <ExecutiveDashboard
                realHistory={realHistory}
                initialBank={INITIAL_EXAM_BANK}
                onNavigateToCreate={handleUseTemplate}
                onRefresh={fetchGlobalHistory}
                defaultSection="all"
              />
            ) : tab === "bank" ? (
              <ExecutiveDashboard
                realHistory={realHistory}
                initialBank={INITIAL_EXAM_BANK}
                onNavigateToCreate={handleUseTemplate}
                onRefresh={fetchGlobalHistory}
                defaultSection="bank"
              />
            ) : tab === "question_bank" ? (
              <QuestionBank />
            ) : tab === "exam_player" ? (
              <ExamPlayer onExit={() => setTab("question_bank")} />
            ) : tab === "dashboard" ? (
              <ScoreAnalyticsView
                user={user}
                selectedGrade={selectedGrade}
                setSelectedGrade={setSelectedGrade}
                selectedRoom={selectedRoom}
                setSelectedRoom={setSelectedRoom}
                selectedSubject={selectedSubject}
                setSelectedSubject={setSelectedSubject}
              />
            ) : tab === "sheets" ? (
              !isTeacherLoggedIn ? (
                <div className="card" style={{ maxWidth: 620, margin: "40px auto", textAlign: "center", padding: "44px 28px", borderRadius: 16 }}>
                  <div style={{ fontSize: 52, marginBottom: 16 }}>📊</div>
                  <div style={{ display: "inline-block", background: "var(--crimson-light)", color: "var(--crimson)", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, marginBottom: 12 }}>
                    ระบบเฉพาะสำหรับคุณครู
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--gray-900)", marginBottom: 8 }}>
                    ระบบตรวจคำตอบ & ชีตคะแนน
                  </h2>
                  <p style={{ color: "var(--gray-600)", fontSize: 14.5, lineHeight: 1.6, marginBottom: 26 }}>
                    ระบบตรวจคำตอบและบันทึกคะแนนเป็นพื้นที่สำหรับคุณครูผู้สอนในการจัดการคะแนนนักเรียน<br />
                    กรุณาเข้าสู่ระบบด้วยอีเมลโรงเรียน <strong>@wangluangpitt.ac.th</strong> เพื่อเข้าถึงข้อมูล
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: "12px 24px", fontSize: 14.5, fontWeight: 600, borderRadius: 10 }}
                      onClick={() => { setLoginRedirectTab("sheets"); setShowLoginModal(true); }}
                    >
                      🔐 เข้าสู่ระบบคุณครู (@wangluangpitt)
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "12px 24px", fontSize: 14.5, borderRadius: 10 }}
                      onClick={() => setTab("executive")}
                    >
                      🏛️ กลับสู่หน้าแดชบอร์ดผู้บริหาร
                    </button>
                  </div>
                </div>
              ) : (
                <SheetsTab
                  user={user}
                  selectedGrade={selectedGrade}
                  setSelectedGrade={setSelectedGrade}
                  selectedRoom={selectedRoom}
                  setSelectedRoom={setSelectedRoom}
                  selectedSubject={selectedSubject}
                  setSelectedSubject={setSelectedSubject}
                />
              )
            ) : tab === "sgs" ? (
              <SgsGradebook realHistory={realHistory} user={user} />
            ) : tab === "admin" && user.role === "admin" ? (
              <AdminPanel adminKey={user.key} />
            ) : tab === "history" ? (
              !isTeacherLoggedIn ? (
                <div className="card" style={{ maxWidth: 620, margin: "40px auto", textAlign: "center", padding: "44px 28px", borderRadius: 16 }}>
                  <div style={{ fontSize: 52, marginBottom: 16 }}>📁</div>
                  <div style={{ display: "inline-block", background: "var(--crimson-light)", color: "var(--crimson)", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, marginBottom: 12 }}>
                    ระบบเฉพาะสำหรับคุณครู
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--gray-900)", marginBottom: 8 }}>
                    ประวัติฟอร์มข้อสอบของคุณครู
                  </h2>
                  <p style={{ color: "var(--gray-600)", fontSize: 14.5, lineHeight: 1.6, marginBottom: 26 }}>
                    คุณครูสามารถเข้าสู่ระบบเพื่อดูประวัติและจัดการแบบทดสอบ Google Forms ส่วนบุคคล<br />
                    (สำหรับผู้บริหาร สามารถเข้าชมคลังข้อสอบมาตรฐานได้ที่เมนู <strong>คลังข้อสอบกลาง</strong>)
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: "12px 24px", fontSize: 14.5, fontWeight: 600, borderRadius: 10 }}
                      onClick={() => { setLoginRedirectTab("history"); setShowLoginModal(true); }}
                    >
                      🔐 เข้าสู่ระบบคุณครู (@wangluangpitt)
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "12px 24px", fontSize: 14.5, borderRadius: 10 }}
                      onClick={() => setTab("executive")}
                    >
                      🏛️ กลับสู่หน้าแดชบอร์ดผู้บริหาร
                    </button>
                  </div>
                </div>
              ) : (
                <HistoryTab user={user} history={realHistory} onRefresh={fetchGlobalHistory} />
              )
            ) : !isTeacherLoggedIn ? (
              <div className="card" style={{ maxWidth: 620, margin: "40px auto", textAlign: "center", padding: "44px 28px", borderRadius: 16 }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>✨</div>
                <div style={{ display: "inline-block", background: "var(--crimson-light)", color: "var(--crimson)", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, marginBottom: 12 }}>
                  ระบบเฉพาะสำหรับคุณครู
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--gray-900)", marginBottom: 8 }}>
                  ระบบออกแบบข้อสอบ AI สำหรับคุณครู
                </h2>
                <p style={{ color: "var(--gray-600)", fontSize: 14.5, lineHeight: 1.6, marginBottom: 26 }}>
                  การสร้างข้อสอบและส่งออก Google Forms จำเป็นต้องใช้สิทธิ์บัญชีคุณครูโรงเรียนวังหลวงพิทยาสรรพ์<br />
                  เข้าสู่ระบบด้วยอีเมล <strong>@wangluangpitt.ac.th</strong> หรือใส่ License Key เพื่อเริ่มสร้างข้อสอบ
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary"
                    style={{ padding: "12px 24px", fontSize: 14.5, fontWeight: 600, borderRadius: 10 }}
                    onClick={() => { setLoginRedirectTab("create"); setShowLoginModal(true); }}
                  >
                    🔐 เข้าสู่ระบบคุณครู (@wangluangpitt)
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "12px 24px", fontSize: 14.5, borderRadius: 10 }}
                    onClick={() => setTab("executive")}
                  >
                    🏛️ ดูแดชบอร์ดผู้บริหาร (โหมดผู้เยี่ยมชม)
                  </button>
                </div>
              </div>
            ) : (
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
                    targetSubject={targetSubject}
                    setTargetSubject={setTargetSubject}
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
                    <StepQuestions questions={questions} setQuestions={setQuestions} licenseKey={user.key} targetTotalScore={targetTotalScore} setTargetTotalScore={setTargetTotalScore} onParsed={async () => {
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

                      {/* Subject Group Preview Card */}
                      <div style={{padding:"14px 18px",background:"var(--gray-50)",borderRadius:"var(--radius-lg)",border:"1px solid var(--gray-200)"}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--gray-600)",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                          <span>📚</span> กลุ่มสาระการเรียนรู้
                        </div>
                        <div style={{fontSize:14,fontWeight:700}}>
                          {targetSubject ? (() => {
                            const sg = SUBJECT_GROUPS.find(g => g.id === targetSubject);
                            if (!sg) return "ทั่วไป";
                            return (
                              <span style={{
                                background: sg.bgColor,
                                color: sg.color,
                                border: `1px solid ${sg.borderColor}`,
                                padding: "2px 10px",
                                borderRadius: 16,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5
                              }}>
                                <span>{sg.icon}</span>
                                <span>{sg.name}</span>
                              </span>
                            );
                          })() : (
                            <span style={{color: "var(--gray-500)"}}>ทั่วไป (ไม่ได้ระบุกลุ่มสาระ)</span>
                          )}
                        </div>
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
                {step===4 && result && <ResultView result={result} onReset={handleReset} />}

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
      {showLoginModal && (
        <div
          className="loading-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <LoginPage
            onLogin={handleLogin}
            onClose={() => setShowLoginModal(false)}
          />
        </div>
      )}
    </>
  );
}