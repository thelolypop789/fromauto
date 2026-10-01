import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  room: string;
  number: number;
}

interface StudentAnswer {
  id: string;
  question_id: string;
  selected_choice_id: string;
  text_answer?: string;
  is_correct: boolean;
  earned_points: number;
}

interface ExamSession {
  id: string;
  exam_id: string;
  student_id: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "DISCONNECTED";
  tab_switch_count: number;
  started_at: string;
  ended_at: string;
  students?: Student;
  student_answers?: StudentAnswer[];
}

interface ExamQuestion {
  question_id: string;
  points: number;
  order_num: number;
  question_bank?: {
    id: string;
    content: string;
    type?: string;
    question_choices: {
      id: string;
      content: string;
      is_correct: boolean;
      order_num: number;
    }[];
  };
}

interface LiveProctorModalProps {
  exam: {
    id: string;
    title: string;
    description?: string;
    time_limit_minutes?: number;
    is_secure_mode?: boolean;
    created_at?: string;
  };
  onClose: () => void;
}

export default function LiveProctorModal({ exam, onClose }: LiveProctorModalProps) {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedSessionForDetail, setSelectedSessionForDetail] = useState<ExamSession | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Subjective grading state
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const examLink = `${window.location.origin}/?exam_id=${exam.id}`;

  // Initialize manualScores when student detail modal opens
  useEffect(() => {
    if (selectedSessionForDetail) {
      const initial: Record<string, number> = {};
      (selectedSessionForDetail.student_answers || []).forEach((ans) => {
        initial[ans.question_id] = ans.earned_points ?? 0;
      });
      setManualScores(initial);
      setSaveSuccessMsg(null);
    }
  }, [selectedSessionForDetail?.id]);

  // Fetch session data & questions
  useEffect(() => {
    fetchExamData();
    fetchSessions();

    let interval: any = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchSessions(false);
      }, 3500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [exam.id, autoRefresh]);

  const fetchExamData = async () => {
    const { data } = await supabase
      .from("exam_questions")
      .select(`
        question_id,
        points,
        order_num,
        question_bank (
          id,
          content,
          type,
          question_choices (*)
        )
      `)
      .eq("exam_id", exam.id)
      .order("order_num", { ascending: true });

    if (data) {
      setExamQuestions(data as any);
    }
  };

  const handleSaveManualScore = async (
    session: ExamSession,
    qId: string,
    maxPoints: number,
    points: number
  ) => {
    setSavingQuestionId(qId);
    try {
      const isCorrect = points >= maxPoints;
      const ansRecord = (session.student_answers || []).find((a) => a.question_id === qId);

      if (ansRecord?.id) {
        const { error } = await supabase
          .from("student_answers")
          .update({
            earned_points: points,
            is_correct: isCorrect,
          })
          .eq("id", ansRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("student_answers")
          .insert({
            session_id: session.id,
            question_id: qId,
            earned_points: points,
            is_correct: isCorrect,
            text_answer: "",
          });
        if (error) throw error;
      }

      // Update in memory session detail immediately
      setSelectedSessionForDetail((prev) => {
        if (!prev) return null;
        const currentAns = [...(prev.student_answers || [])];
        const idx = currentAns.findIndex((a) => a.question_id === qId);
        if (idx >= 0) {
          currentAns[idx] = {
            ...currentAns[idx],
            earned_points: points,
            is_correct: isCorrect,
          };
        } else {
          currentAns.push({
            id: `temp-${Date.now()}`,
            question_id: qId,
            selected_choice_id: "",
            text_answer: "",
            is_correct: isCorrect,
            earned_points: points,
          });
        }
        return { ...prev, student_answers: currentAns };
      });

      // Also refresh background sessions
      await fetchSessions(false);

      setSaveSuccessMsg(`บันทึกคะแนนข้อนี้สำเร็จ: ${points} / ${maxPoints} คะแนน`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการบันทึกคะแนน: " + err.message);
    } finally {
      setSavingQuestionId(null);
    }
  };

  const fetchSessions = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("exam_sessions")
        .select(`
          *,
          students (*),
          student_answers (*)
        `)
        .eq("exam_id", exam.id)
        .order("started_at", { ascending: false });

      if (!error && data) {
        setSessions(data as ExamSession[]);
      }
    } catch (err) {
      console.error("Error fetching proctor sessions:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Copy link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(examLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Stats calculation
  const totalStudents = sessions.length;
  const inProgressCount = sessions.filter((s) => s.status === "IN_PROGRESS").length;
  const submittedCount = sessions.filter((s) => s.status === "SUBMITTED").length;
  const cheatAlertCount = sessions.filter((s) => s.tab_switch_count > 0).length;

  const totalMaxScore = examQuestions.reduce((acc, q) => acc + (q.points || 1), 0);

  // Scores list of submitted
  const scores = sessions
    .filter((s) => s.status === "SUBMITTED")
    .map((s) => {
      return (s.student_answers || []).reduce((acc, a) => acc + (a.earned_points || 0), 0);
    });

  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "-";
  const maxScore = scores.length > 0 ? Math.max(...scores) : "-";
  const minScore = scores.length > 0 ? Math.min(...scores) : "-";

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "ลำดับ",
      "ระดับชั้น/ห้อง",
      "เลขที่",
      "รหัสนักเรียน",
      "ชื่อ-นามสกุล",
      "สถานะ",
      "เวลาเริ่ม",
      "เวลาส่ง",
      "คะแนนที่ได้",
      "คะแนนเต็ม",
      "ร้อยละ",
      "จำนวนครั้งที่สลับหน้าจอ (Anti-cheat)",
    ];

    const rows = sessions.map((s, idx) => {
      const student = s.students;
      const score = (s.student_answers || []).reduce((acc, a) => acc + (a.earned_points || 0), 0);
      const pct = totalMaxScore > 0 ? ((score / totalMaxScore) * 100).toFixed(1) : "0";
      const statusText = s.status === "SUBMITTED" ? "ส่งแล้ว" : "กำลังสอบ";

      return [
        idx + 1,
        `"${student?.room || "-"}"`,
        student?.number || "-",
        `"${student?.student_id || "-"}"`,
        `"${student?.first_name || ""} ${student?.last_name || ""}"`.trim(),
        `"${statusText}"`,
        `"${s.started_at ? new Date(s.started_at).toLocaleTimeString("th-TH") : "-"}"`,
        `"${s.ended_at ? new Date(s.ended_at).toLocaleTimeString("th-TH") : "-"}"`,
        score,
        totalMaxScore,
        `${pct}%`,
        s.tab_switch_count || 0,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ผลสอบ_${exam.title}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
        backdropFilter: "blur(4px)",
        fontFamily: "'Sarabun', 'Prompt', sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          maxWidth: "1150px",
          width: "100%",
          maxHeight: "92vh",
          borderRadius: "20px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            background: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)",
            color: "white",
            padding: "20px 26px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "24px" }}>📡</span>
              <h2 style={{ fontSize: "19px", fontWeight: 800, margin: 0 }}>
                ห้องคุมสอบสด & ติดตามผลคะแนนเรียลไทม์
              </h2>
              <span
                style={{
                  background: autoRefresh ? "#059669" : "rgba(255,255,255,0.2)",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "white" }} />
                {autoRefresh ? "Realtime Active" : "Paused"}
              </span>
            </div>
            <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px" }}>
              ชุดข้อสอบ: <strong>{exam.title}</strong> ({examQuestions.length} ข้อ • {exam.time_limit_minutes || 40} นาที)
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "white",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {autoRefresh ? "⏸️ หยุดอัปเดตอัตโนมัติ" : "▶️ เปิดอัปเดตสด"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "white",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* SHARE & PIN ACTION BAR */}
        <div
          style={{
            background: "#FFFBEB",
            borderBottom: "1px solid #FDE68A",
            padding: "14px 26px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#92400E" }}>
              🔗 ลิงก์ห้องสอบสำหรับนักเรียน:
            </span>
            <input
              type="text"
              readOnly
              value={examLink}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                fontSize: "12.5px",
                width: "320px",
                background: "white",
                color: "var(--gray-800)",
              }}
            />
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                background: copiedLink ? "#059669" : "#B91C1C",
                color: "white",
                border: "none",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {copiedLink ? "✓ คัดลอกสำเร็จ!" : "📋 คัดลอกลิงก์"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={sessions.length === 0}
              style={{
                background: "white",
                border: "1.5px solid #059669",
                color: "#059669",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 700,
                cursor: sessions.length === 0 ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>📥</span> ดาวน์โหลด Excel / CSV ({sessions.length})
            </button>
          </div>
        </div>

        {/* STATS OVERVIEW CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            padding: "18px 26px",
            background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
          }}
        >
          <div style={{ background: "white", padding: "14px 16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "12px", color: "var(--gray-500)", fontWeight: 600 }}>เข้าสอบทั้งหมด</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#1E293B" }}>{totalStudents} คน</div>
          </div>
          <div style={{ background: "white", padding: "14px 16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "12px", color: "#059669", fontWeight: 600 }}>🟢 กำลังสอบอยู่</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#059669" }}>{inProgressCount} คน</div>
          </div>
          <div style={{ background: "white", padding: "14px 16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "12px", color: "#2563EB", fontWeight: 600 }}>🔵 ส่งข้อสอบแล้ว</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#2563EB" }}>{submittedCount} คน</div>
          </div>
          <div style={{ background: "white", padding: "14px 16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "12px", color: "#DC2626", fontWeight: 600 }}>⚠️ เตือนสลับหน้าจอ</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#DC2626" }}>{cheatAlertCount} คน</div>
          </div>
          <div style={{ background: "white", padding: "14px 16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: "12px", color: "var(--gray-500)", fontWeight: 600 }}>คะแนนเฉลี่ย (สูงสุด/ต่ำสุด)</div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "#7F1D1D" }}>
              {avgScore} <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>(สูงสุด {maxScore} / ต่ำสุด {minScore})</span>
            </div>
          </div>
        </div>

        {/* STUDENTS TABLE */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px" }}>
          {loading && sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px", color: "var(--gray-500)" }}>
              ⏳ กำลังโหลดรายชื่อผู้เข้าสอบ...
            </div>
          ) : sessions.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "#F8FAFC",
                borderRadius: "14px",
                border: "2px dashed #CBD5E1",
              }}
            >
              <div style={{ fontSize: "38px", marginBottom: "10px" }}>⏳</div>
              <h3 style={{ fontSize: "17px", fontWeight: 700, color: "var(--gray-800)", marginBottom: "4px" }}>
                ยังไม่มีนักเรียนเข้าสู่ห้องสอบ
              </h3>
              <p style={{ fontSize: "13.5px", color: "var(--gray-500)", maxWidth: "420px", margin: "0 auto" }}>
                คุณครูสามารถกดปุ่ม <strong>"คัดลอกลิงก์"</strong> ด้านบน แล้วส่งให้นักเรียนเข้าทำข้อสอบผ่านเบราว์เซอร์ได้ทันทีครับ
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13.5px" }}>
              <thead>
                <tr style={{ background: "#F1F5F9", borderBottom: "2px solid #CBD5E1", color: "var(--gray-700)" }}>
                  <th style={{ padding: "10px 12px" }}>เลขที่</th>
                  <th style={{ padding: "10px 12px" }}>ห้อง</th>
                  <th style={{ padding: "10px 12px" }}>ชื่อ - นามสกุล</th>
                  <th style={{ padding: "10px 12px" }}>สถานะ</th>
                  <th style={{ padding: "10px 12px" }}>เวลาที่ใช้</th>
                  <th style={{ padding: "10px 12px" }}>สลับหน้าจอ (Anti-cheat)</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>คะแนน</th>
                  <th style={{ padding: "10px 12px", textAlign: "center" }}>ตรวจคำตอบ</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, idx) => {
                  const student = s.students;
                  const isSubmitted = s.status === "SUBMITTED";
                  const score = (s.student_answers || []).reduce((acc, a) => acc + (a.earned_points || 0), 0);
                  const pct = totalMaxScore > 0 ? Math.round((score / totalMaxScore) * 100) : 0;

                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: "1px solid #E2E8F0",
                        background: idx % 2 === 0 ? "white" : "#F8FAFC",
                        transition: "background 0.15s",
                      }}
                    >
                      <td style={{ padding: "12px", fontWeight: 700 }}>{student?.number || "-"}</td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            background: "#EFF6FF",
                            color: "#1D4ED8",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontWeight: 700,
                            fontSize: "12px",
                          }}
                        >
                          {student?.room || "-"}
                        </span>
                      </td>
                      <td style={{ padding: "12px", fontWeight: 600, color: "#0F172A" }}>
                        {student?.first_name} {student?.last_name}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {isSubmitted ? (
                          <span
                            style={{
                              background: "#ECFDF5",
                              color: "#059669",
                              padding: "3px 10px",
                              borderRadius: "12px",
                              fontWeight: 700,
                              fontSize: "12px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            🔵 ส่งแล้ว
                          </span>
                        ) : (
                          <span
                            style={{
                              background: "#FEF3C7",
                              color: "#B45309",
                              padding: "3px 10px",
                              borderRadius: "12px",
                              fontWeight: 700,
                              fontSize: "12px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            🟢 กำลังสอบ
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px", color: "var(--gray-600)", fontSize: "12.5px" }}>
                        {s.started_at ? new Date(s.started_at).toLocaleTimeString("th-TH") : "-"}
                        {s.ended_at && ` - ${new Date(s.ended_at).toLocaleTimeString("th-TH")}`}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {s.tab_switch_count > 0 ? (
                          <span
                            style={{
                              background: "#FEF2F2",
                              color: "#DC2626",
                              padding: "3px 10px",
                              borderRadius: "8px",
                              fontWeight: 700,
                              fontSize: "12px",
                              border: "1px solid #FECACA",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            ⚠️ {s.tab_switch_count} ครั้ง
                          </span>
                        ) : (
                          <span style={{ color: "var(--gray-400)", fontSize: "12px" }}>ปกติ (0 ครั้ง)</span>
                        )}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        {isSubmitted ? (
                          <div>
                            <strong style={{ fontSize: "15px", color: pct >= 50 ? "#047857" : "#DC2626" }}>
                              {score}
                            </strong>
                            <span style={{ fontSize: "11px", color: "var(--gray-500)" }}> / {totalMaxScore} ({pct}%)</span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--gray-400)" }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedSessionForDetail(s)}
                          style={{
                            background: "#EFF6FF",
                            border: "1px solid #BFDBFE",
                            color: "#1D4ED8",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          ✏️ ตรวจ/ดูคำตอบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            background: "#F8FAFC",
            borderTop: "1px solid #E2E8F0",
            padding: "14px 26px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "12.5px", color: "var(--gray-500)" }}>
            * ข้อมูลจะรีเฟรชอัปเดตสถานะแบบเรียลไทม์ทุก 3.5 วินาที
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#475569",
              color: "white",
              border: "none",
              padding: "8px 20px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ปิดหน้าจอคุมสอบ
          </button>
        </div>
      </div>

      {/* STUDENT DETAIL MODAL */}
      {selectedSessionForDetail && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "white",
              maxWidth: "780px",
              width: "100%",
              maxHeight: "88vh",
              borderRadius: "16px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div
              style={{
                background: "#1E293B",
                color: "white",
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                  รายละเอียดคำตอบ: {selectedSessionForDetail.students?.first_name} {selectedSessionForDetail.students?.last_name}
                </h3>
                <div style={{ fontSize: "12.5px", opacity: 0.85, marginTop: "3px" }}>
                  ห้อง {selectedSessionForDetail.students?.room} เลขที่ {selectedSessionForDetail.students?.number} • คะแนนรวม:{" "}
                  <strong style={{ color: "#FDE047" }}>
                    {(selectedSessionForDetail.student_answers || []).reduce((acc, a) => acc + (a.earned_points || 0), 0)}
                  </strong>{" "}
                  / {totalMaxScore} คะแนน
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionForDetail(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
              {saveSuccessMsg && (
                <div
                  style={{
                    background: "#ECFDF5",
                    color: "#065F46",
                    border: "1px solid #A7F3D0",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    fontWeight: 700,
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  ✅ {saveSuccessMsg}
                </div>
              )}

              {examQuestions.map((eq, qIdx) => {
                const q = eq.question_bank;
                if (!q) return null;

                const ansRecord = (selectedSessionForDetail.student_answers || []).find(
                  (a) => a.question_id === q.id
                );
                const maxPoints = eq.points || 1;
                const earnedPoints = ansRecord?.earned_points ?? 0;
                const isSubjective =
                  q.type === "PARAGRAPH" ||
                  q.type === "SHORT_ANSWER" ||
                  q.type === "ESSAY" ||
                  !q.question_choices ||
                  q.question_choices.length === 0 ||
                  Boolean(ansRecord?.text_answer);

                const currentScoreInput = manualScores[q.id] ?? earnedPoints;
                const isCorrect = isSubjective ? earnedPoints >= maxPoints : (ansRecord?.is_correct ?? false);
                const chosenChoiceId = ansRecord?.selected_choice_id;

                return (
                  <div
                    key={q.id}
                    style={{
                      background: isSubjective ? "#F8FAFC" : (isCorrect ? "#F0FDF4" : "#FEF2F2"),
                      border: `1.5px solid ${isSubjective ? "#CBD5E1" : (isCorrect ? "#BBF7D0" : "#FECACA")}`,
                      borderRadius: "12px",
                      padding: "16px",
                      marginBottom: "16px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "15px", color: isSubjective ? "#0F172A" : (isCorrect ? "#166534" : "#991B1B") }}>
                          ข้อ {qIdx + 1}
                        </strong>
                        {isSubjective ? (
                          <span
                            style={{
                              background: "#FEF3C7",
                              color: "#B45309",
                              border: "1px solid #FDE68A",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            ✍️ ข้อสอบอัตนัย / บรรยาย
                          </span>
                        ) : (
                          <span
                            style={{
                              background: isCorrect ? "#DCFCE7" : "#FEE2E2",
                              color: isCorrect ? "#15803D" : "#B91C1C",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {isCorrect ? `✅ ถูกต้อง (+${maxPoints})` : "❌ ผิด (0 คะแนน)"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#475569" }}>
                        คะแนนที่ได้:{" "}
                        <span style={{ color: earnedPoints > 0 ? "#16A34A" : "#64748B", fontSize: "15px" }}>
                          {earnedPoints}
                        </span>{" "}
                        / {maxPoints} คะแนน
                      </div>
                    </div>

                    <div style={{ fontSize: "14.5px", color: "#1E293B", marginBottom: "14px", lineHeight: 1.5 }}>
                      {q.content}
                    </div>

                    {isSubjective ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div
                          style={{
                            background: "#F1F5F9",
                            border: "1px solid #E2E8F0",
                            borderRadius: "8px",
                            padding: "12px",
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                            💬 คำตอบที่นักเรียนพิมพ์ส่งมา:
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: ansRecord?.text_answer ? "#0F172A" : "#94A3B8",
                              fontStyle: ansRecord?.text_answer ? "normal" : "italic",
                              background: "white",
                              padding: "10px 12px",
                              borderRadius: "6px",
                              border: "1px solid #CBD5E1",
                              minHeight: "44px",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {ansRecord?.text_answer ? ansRecord.text_answer : "(นักเรียนไม่ได้พิมพ์คำตอบ หรือยังไม่ได้ส่ง)"}
                          </div>
                        </div>

                        {/* Grading Controls */}
                        <div
                          style={{
                            background: "#FEFCE8",
                            border: "1.5px solid #FEF08A",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#854D0E" }}>
                              ✏️ ให้คะแนน (เต็ม {maxPoints}):
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={maxPoints}
                              step={0.5}
                              value={currentScoreInput}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setManualScores((prev) => ({ ...prev, [q.id]: Math.min(maxPoints, Math.max(0, val)) }));
                              }}
                              style={{
                                width: "70px",
                                padding: "6px 8px",
                                borderRadius: "6px",
                                border: "1.5px solid #CA8A04",
                                fontWeight: 800,
                                fontSize: "15px",
                                textAlign: "center",
                                color: "#854D0E",
                                background: "white",
                              }}
                            />
                            <div style={{ display: "flex", gap: "4px" }}>
                              <button
                                type="button"
                                onClick={() => setManualScores((prev) => ({ ...prev, [q.id]: 0 }))}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "11px",
                                  background: "#F1F5F9",
                                  border: "1px solid #CBD5E1",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                0
                              </button>
                              <button
                                type="button"
                                onClick={() => setManualScores((prev) => ({ ...prev, [q.id]: maxPoints / 2 }))}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "11px",
                                  background: "#FEF3C7",
                                  border: "1px solid #FDE68A",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                ครึ่งหนึ่ง ({maxPoints / 2})
                              </button>
                              <button
                                type="button"
                                onClick={() => setManualScores((prev) => ({ ...prev, [q.id]: maxPoints }))}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "11px",
                                  background: "#DCFCE7",
                                  border: "1px solid #86EFAC",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                เต็ม ({maxPoints})
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={savingQuestionId === q.id}
                            onClick={() => handleSaveManualScore(selectedSessionForDetail, q.id, maxPoints, currentScoreInput)}
                            style={{
                              background: "#0284C7",
                              color: "white",
                              border: "none",
                              padding: "7px 16px",
                              borderRadius: "6px",
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: savingQuestionId === q.id ? "not-allowed" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                            }}
                          >
                            {savingQuestionId === q.id ? "กำลังบันทึก..." : "💾 บันทึกคะแนนข้อนี้"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {q.question_choices.map((c) => {
                          const isChosen = c.id === chosenChoiceId;
                          const isAnswerKey = c.is_correct;

                          let choiceBg = "white";
                          let choiceBorder = "1px solid #E2E8F0";
                          let badge = null;

                          if (isAnswerKey) {
                            choiceBg = "#DCFCE7";
                            choiceBorder = "1.5px solid #22C55E";
                            badge = <span style={{ color: "#16A34A", fontWeight: 700 }}>[เฉลยที่ถูกต้อง]</span>;
                          }
                          if (isChosen && !isAnswerKey) {
                            choiceBg = "#FEE2E2";
                            choiceBorder = "1.5px solid #EF4444";
                            badge = <span style={{ color: "#DC2626", fontWeight: 700 }}>[คำตอบที่นักเรียนเลือก]</span>;
                          } else if (isChosen && isAnswerKey) {
                            badge = <span style={{ color: "#16A34A", fontWeight: 700 }}>[นักเรียนตอบถูก ✓]</span>;
                          }

                          return (
                            <div
                              key={c.id}
                              style={{
                                padding: "8px 12px",
                                borderRadius: "6px",
                                background: choiceBg,
                                border: choiceBorder,
                                fontSize: "13px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span>{c.content}</span>
                              {badge}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0", textAlign: "right", background: "#F8FAFC" }}>
              <button
                type="button"
                onClick={() => setSelectedSessionForDetail(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#1E293B",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
