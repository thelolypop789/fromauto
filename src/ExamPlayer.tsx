import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface Choice {
  id: string;
  content: string;
  is_correct: boolean;
  order_num: number;
}

interface Question {
  id: string;
  topic?: string;
  content: string;
  type: string;
  difficulty?: string;
  points: number;
  question_choices: Choice[];
}

interface ExamInfo {
  id: string;
  title: string;
  description: string;
  time_limit_minutes: number;
  is_secure_mode: boolean;
  created_by?: string;
}

interface ExamPlayerProps {
  examIdProp?: string;
  onExit?: () => void;
}

export default function ExamPlayer({ examIdProp, onExit }: ExamPlayerProps) {
  // Routing / ID state
  const [examId, setExamId] = useState<string>(() => {
    if (examIdProp) return examIdProp;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("exam_id") || urlParams.get("exam") || urlParams.get("id") || "";
  });
  const [pinInput, setPinInput] = useState("");

  // Exam Data
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Student Info
  const [studentGrade, setStudentGrade] = useState("ม.1");
  const [studentRoom, setStudentRoom] = useState("ม.1/1");
  const [studentNumber, setStudentNumber] = useState<number>(1);
  const [studentName, setStudentName] = useState("");
  const [studentCode, setStudentCode] = useState("");

  // Exam Session & Progress
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stage, setStage] = useState<"pin" | "register" | "briefing" | "taking" | "submitted">(
    examId ? "register" : "pin"
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // question_id -> choice_id
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  // Timer & Security
  const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // References for event listeners
  const sessionRef = useRef<string | null>(null);
  sessionRef.current = sessionId;
  const isTakingRef = useRef(false);
  isTakingRef.current = stage === "taking";

  // Load Exam when examId is ready
  useEffect(() => {
    if (examId) {
      loadExam(examId);
    }
  }, [examId]);

  const loadExam = async (id: string) => {
    setLoading(true);
    setErrorMsg("");
    try {
      // 1. Fetch exam details
      const { data: exData, error: exErr } = await supabase
        .from("exams")
        .select("*")
        .eq("id", id)
        .single();

      if (exErr || !exData) {
        setErrorMsg("ไม่พบชุดข้อสอบนี้ หรือรหัสข้อสอบไม่ถูกต้อง");
        setLoading(false);
        return;
      }
      setExam(exData);
      setTimeLeft((exData.time_limit_minutes || 40) * 60);

      // 2. Fetch exam questions
      const { data: eqData, error: eqErr } = await supabase
        .from("exam_questions")
        .select(`
          points,
          order_num,
          question_bank (
            id,
            topic,
            content,
            type,
            difficulty,
            question_choices (*)
          )
        `)
        .eq("exam_id", id)
        .order("order_num", { ascending: true });

      if (eqErr || !eqData || eqData.length === 0) {
        setErrorMsg("ชุดข้อสอบนี้ยังไม่มีข้อคำถามในระบบ");
        setLoading(false);
        return;
      }

      // Format questions list
      const qList: Question[] = eqData.map((item: any) => ({
        id: item.question_bank.id,
        topic: item.question_bank.topic,
        content: item.question_bank.content,
        type: item.question_bank.type,
        difficulty: item.question_bank.difficulty,
        points: item.points || 1,
        question_choices: (item.question_bank.question_choices || []).sort(
          (a: any, b: any) => a.order_num - b.order_num
        ),
      }));

      setQuestions(qList);
      setStage("register");
    } catch (err: any) {
      setErrorMsg("เกิดข้อผิดพลาดในการโหลดข้อสอบ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (stage !== "taking") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit("หมดเวลาการทำข้อสอบ ระบบได้ส่งคำตอบของคุณโดยอัตโนมัติแล้ว");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [stage]);

  // Anti-Cheat: Visibility Change & Window Blur Detection
  useEffect(() => {
    if (!exam?.is_secure_mode || stage !== "taking") return;

    const handleVisibility = () => {
      if (document.hidden) {
        handleTabViolation();
      }
    };

    const handleBlur = () => {
      handleTabViolation();
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12, Ctrl+Shift+I, Ctrl+C, Ctrl+V, PrintScreen
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "C" || e.key === "c")) ||
        (e.ctrlKey && (e.key === "c" || e.key === "C" || e.key === "u" || e.key === "U"))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [stage, exam?.is_secure_mode]);

  const handleTabViolation = async () => {
    if (!isTakingRef.current) return;
    setTabSwitchCount((prev) => {
      const next = prev + 1;
      // Record to Supabase
      if (sessionRef.current) {
        supabase
          .from("exam_sessions")
          .update({ tab_switch_count: next })
          .eq("id", sessionRef.current)
          .then();
      }
      return next;
    });
    setShowCheatWarning(true);
  };

  // Start exam from briefing
  const handleStartExam = async () => {
    if (!studentName.trim()) {
      alert("กรุณาระบุชื่อ-นามสกุลของนักเรียนก่อนเริ่มทำข้อสอบ");
      return;
    }

    try {
      // 1. Request Fullscreen
      if (exam?.is_secure_mode && document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
          setIsFullscreen(true);
        } catch {
          // browser restriction fallback
        }
      }

      // 2. Upsert student record
      const studentIdNum = studentCode.trim() || `${studentRoom.replace(/[\.\/]/g, "")}_${String(studentNumber).padStart(2, "0")}`;
      const nameParts = studentName.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "-";

      const { data: stData, error: stErr } = await supabase
        .from("students")
        .upsert(
          {
            student_id: studentIdNum,
            first_name: firstName,
            last_name: lastName,
            room: studentRoom,
            number: Number(studentNumber),
          },
          { onConflict: "student_id" }
        )
        .select()
        .single();

      if (stErr && !stData) {
        console.error("Student upsert err:", stErr);
      }

      const stId = stData?.id;

      // 3. Create exam session
      const { data: sessData, error: sessErr } = await supabase
        .from("exam_sessions")
        .insert({
          exam_id: examId,
          student_id: stId,
          status: "IN_PROGRESS",
          started_at: new Date().toISOString(),
          tab_switch_count: 0,
        })
        .select()
        .single();

      if (sessErr) {
        console.error("Session err:", sessErr);
      }

      if (sessData) {
        setSessionId(sessData.id);
      }

      setStage("taking");
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการเริ่มทำข้อสอบ: " + err.message);
    }
  };

  // Choose an option
  const handleSelectChoice = (questionId: string, choiceId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: choiceId,
    }));

    // Auto-save answer to database in background
    if (sessionId) {
      const q = questions.find((item) => item.id === questionId);
      const chosen = q?.question_choices.find((c) => c.id === choiceId);
      const isCorrect = chosen?.is_correct ?? false;
      const points = isCorrect ? q?.points || 1 : 0;

      supabase
        .from("student_answers")
        .upsert(
          {
            session_id: sessionId,
            question_id: questionId,
            selected_choice_id: choiceId,
            is_correct: isCorrect,
            earned_points: points,
          },
          { onConflict: "session_id,question_id" }
        )
        .then();
    }
  };

  // Handle subjective text answer
  const handleTextAnswer = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: text,
    }));

    if (sessionId) {
      supabase
        .from("student_answers")
        .upsert(
          {
            session_id: sessionId,
            question_id: questionId,
            selected_choice_id: null,
            text_answer: text,
            is_correct: null,
            earned_points: 0,
          },
          { onConflict: "session_id,question_id" }
        )
        .then();
    }
  };

  // Toggle Flag
  const toggleFlag = (qId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  // Calculate & Submit
  const handleFinalSubmit = async () => {
    setShowConfirmSubmit(false);
    setSubmitting(true);

    try {
      let totalEarned = 0;
      let totalMaxPoints = 0;

      // Compute score
      questions.forEach((q) => {
        totalMaxPoints += q.points;
        const selectedId = answers[q.id];
        const choice = q.question_choices.find((c) => c.id === selectedId);
        if (choice && choice.is_correct) {
          totalEarned += q.points;
        }
      });

      // Update session status & final score
      if (sessionId) {
        await supabase
          .from("exam_sessions")
          .update({
            status: "SUBMITTED",
            ended_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
      }

      setFinalScore(totalEarned);
      setStage("submitted");

      // Exit fullscreen
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการส่งข้อสอบ: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoSubmit = (reason: string) => {
    alert(reason);
    handleFinalSubmit();
  };

  // Format time remaining
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Progress computation
  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[currentIdx];

  // ==================== RENDER: STAGE PIN INPUT ====================
  if (stage === "pin") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #7F1D1D 0%, #450A0A 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "'Sarabun', 'Prompt', sans-serif",
        }}
      >
        <div
          style={{
            background: "white",
            maxWidth: "460px",
            width: "100%",
            borderRadius: "20px",
            padding: "36px 30px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🏫</div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#7F1D1D", marginBottom: "4px" }}>
            โรงเรียนวังหลวงพิทยาสรรพ์
          </h2>
          <p style={{ fontSize: "14px", color: "var(--gray-600)", marginBottom: "24px" }}>
            ระบบเข้าทำแบบทดสอบออนไลน์ (Secure Exam Player)
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pinInput.trim()) {
                setExamId(pinInput.trim());
              }
            }}
          >
            <div style={{ textAlign: "left", marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-700)", display: "block", marginBottom: "6px" }}>
                🔑 กรอกรหัสห้องสอบ (Exam PIN หรือ Exam ID):
              </label>
              <input
                type="text"
                placeholder="วางรหัสข้อสอบที่ได้รับจากคุณครู..."
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "2px solid #E5E7EB",
                  fontSize: "15px",
                  textAlign: "center",
                  fontWeight: 700,
                  outline: "none",
                }}
              />
            </div>

            {errorMsg && (
              <div
                style={{
                  background: "#FEF2F2",
                  color: "#B91C1C",
                  padding: "10px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                background: "linear-gradient(135deg, #B91C1C, #991B1B)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(185,28,28,0.3)",
              }}
            >
              {loading ? "กำลังค้นหาชุดข้อสอบ..." : "เข้าสู่ห้องสอบ ➡️"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== RENDER: STAGE REGISTER ====================
  if (stage === "register") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #7F1D1D 0%, #450A0A 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "'Sarabun', 'Prompt', sans-serif",
        }}
      >
        <div
          style={{
            background: "white",
            maxWidth: "520px",
            width: "100%",
            borderRadius: "20px",
            padding: "36px 32px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
          }}
        >
          {/* Header Banner */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <span
              style={{
                background: "#FEF2F2",
                color: "#B91C1C",
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 700,
                border: "1px solid #FECACA",
              }}
            >
              🛡️ แบบทดสอบมาตรฐานโรงเรียนวังหลวงพิทยาสรรพ์
            </span>
            <h2 style={{ fontSize: "19px", fontWeight: 800, color: "#111827", marginTop: "12px", marginBottom: "6px" }}>
              {exam?.title || "ชุดแบบทดสอบออนไลน์"}
            </h2>
            <div style={{ display: "flex", justifyContent: "center", gap: "14px", fontSize: "13px", color: "var(--gray-600)" }}>
              <span>📝 {questions.length} ข้อคำถาม</span>
              <span>⏱️ {exam?.time_limit_minutes || 40} นาที</span>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #F3F4F6", margin: "16px 0 20px" }} />

          <h3 style={{ fontSize: "15px", fontWeight: 800, color: "var(--gray-900)", marginBottom: "14px" }}>
            👤 ข้อมูลผู้เข้าสอบ (กรุณากรอกให้ถูกต้อง)
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--gray-700)", display: "block", marginBottom: "4px" }}>
                ระดับชั้น:
              </label>
              <select
                value={studentGrade}
                onChange={(e) => {
                  setStudentGrade(e.target.value);
                  setStudentRoom(`${e.target.value}/1`);
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1.5px solid #E5E7EB",
                  fontSize: "14px",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                {["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--gray-700)", display: "block", marginBottom: "4px" }}>
                ห้อง:
              </label>
              <select
                value={studentRoom}
                onChange={(e) => setStudentRoom(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1.5px solid #E5E7EB",
                  fontSize: "14px",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                {[1, 2, 3, 4, 5, 6].map((r) => (
                  <option key={r} value={`${studentGrade}/${r}`}>{`${studentGrade}/${r}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--gray-700)", display: "block", marginBottom: "4px" }}>
                เลขที่:
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={studentNumber}
                onChange={(e) => setStudentNumber(Number(e.target.value))}
                required
                style={{
                  width: "100%",
                  padding: "10px 8px",
                  borderRadius: "8px",
                  border: "1.5px solid #E5E7EB",
                  fontSize: "14px",
                  fontWeight: 700,
                  textAlign: "center",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--gray-700)", display: "block", marginBottom: "4px" }}>
                ชื่อ - นามสกุล:
              </label>
              <input
                type="text"
                placeholder="เช่น ด.ช.สมชาย ใจดี หรือ นายสมศักดิ์ รักเรียน"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1.5px solid #E5E7EB",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--gray-700)", display: "block", marginBottom: "4px" }}>
              รหัสประจำตัวนักเรียน (ถ้ามี):
            </label>
            <input
              type="text"
              placeholder="เช่น 12345 (เว้นว่างได้)"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1.5px solid #E5E7EB",
                fontSize: "14px",
                outline: "none",
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (!studentName.trim()) {
                alert("กรุณาระบุชื่อ-นามสกุล");
                return;
              }
              setStage("briefing");
            }}
            style={{
              width: "100%",
              padding: "14px",
              background: "linear-gradient(135deg, #B91C1C, #991B1B)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(185,28,28,0.3)",
            }}
          >
            ถัดไป: อ่านข้อตกลงและคำชี้แจง ➡️
          </button>
        </div>
      </div>
    );
  }

  // ==================== RENDER: STAGE BRIEFING ====================
  if (stage === "briefing") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #7F1D1D 0%, #450A0A 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "'Sarabun', 'Prompt', sans-serif",
        }}
      >
        <div
          style={{
            background: "white",
            maxWidth: "560px",
            width: "100%",
            borderRadius: "20px",
            padding: "36px 32px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <span style={{ fontSize: "40px" }}>🛡️</span>
            <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#111827", marginTop: "8px" }}>
              กฎและข้อปฏิบัติการสอบในโหมดปลอดภัย
            </h2>
            <p style={{ fontSize: "13.5px", color: "var(--gray-600)" }}>
              ห้องสอบนี้เปิดใช้งานระบบ Secure Exam Monitoring
            </p>
          </div>

          <div
            style={{
              background: "#FFFBEB",
              border: "1.5px solid #FDE68A",
              borderRadius: "12px",
              padding: "16px 18px",
              marginBottom: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              fontSize: "13.5px",
              color: "#92400E",
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span>🖥️</span>
              <div>
                <strong>บังคับเต็มจอ (Fullscreen Lock):</strong> ระบบจะล็อกหน้าจอให้อยู่ในโหมดเต็มจอเพื่อป้องกันการเปิดโปรแกรมอื่น
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span>⚠️</span>
              <div>
                <strong>ห้ามสลับแท็บหรือออกจากหน้าจอ:</strong> หากสลับแท็บไปค้นหา Google หรือเปิดแอปอื่น ระบบจะส่งสัญญาณแจ้งเตือนคุณครูผู้คุมสอบทันที
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span>⏱️</span>
              <div>
                <strong>ตัวจับเวลานับถอยหลัง:</strong> เมื่อหมดเวลา ({exam?.time_limit_minutes || 40} นาที) ระบบจะส่งข้อสอบและคำตอบที่คุณทำไว้โดยอัตโนมัติ
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span>🚫</span>
              <div>
                <strong>ห้ามคลิกขวา คัดลอก หรือกดปุ่มลัด:</strong> ระบบปิดการใช้งานปุ่มลัดเพื่อความโปร่งใสสูงสุด
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#F9FAFB",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              marginBottom: "20px",
              fontSize: "13px",
              color: "var(--gray-700)",
            }}
          >
            <div>ผู้เข้าสอบ: <strong>{studentName}</strong> (ห้อง {studentRoom} เลขที่ {studentNumber})</div>
            <div>จำนวนข้อสอบ: <strong>{questions.length} ข้อ</strong></div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setStage("register")}
              style={{
                flex: "1",
                padding: "12px",
                background: "#F3F4F6",
                color: "var(--gray-700)",
                border: "none",
                borderRadius: "10px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ⬅️ แก้ไขข้อมูล
            </button>
            <button
              type="button"
              onClick={handleStartExam}
              style={{
                flex: "2",
                padding: "12px",
                background: "linear-gradient(135deg, #059669, #047857)",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: "15px",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(5,150,105,0.3)",
              }}
            >
              🚀 เริ่มทำข้อสอบทันที
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER: STAGE TAKING (THE EXAM PLAYER) ====================
  if (stage === "taking") {
    const isFlagged = currentQuestion ? flagged.has(currentQuestion.id) : false;
    const isAnswered = currentQuestion ? !!answers[currentQuestion.id] : false;
    const selectedChoiceId = currentQuestion ? answers[currentQuestion.id] : null;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F8FAFC",
          fontFamily: "'Sarabun', 'Prompt', sans-serif",
          display: "flex",
          flexDirection: "column",
          userSelect: "none",
        }}
      >
        {/* Anti-Cheat Tab Switch Warning Modal */}
        {showCheatWarning && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(185,28,28,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px",
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              style={{
                background: "white",
                maxWidth: "480px",
                width: "100%",
                borderRadius: "18px",
                padding: "32px 28px",
                textAlign: "center",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              }}
            >
              <div style={{ fontSize: "54px", marginBottom: "12px" }}>⚠️</div>
              <h2 style={{ fontSize: "21px", fontWeight: 800, color: "#B91C1C", marginBottom: "8px" }}>
                แจ้งเตือนการสลับหน้าจอ!
              </h2>
              <div
                style={{
                  background: "#FEF2F2",
                  color: "#991B1B",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  marginBottom: "16px",
                  lineHeight: 1.6,
                }}
              >
                ระบบตรวจพบว่าท่านออกจากหน้าจอข้อสอบ <strong>(ครั้งที่ {tabSwitchCount})</strong>
                <br />
                เวลาและประวัติการสลับหน้าจอถูกบันทึกส่งไปยัง <strong>คุณครูผู้คุมสอบ</strong> ทันที
              </div>
              <p style={{ fontSize: "13.5px", color: "var(--gray-600)", marginBottom: "22px" }}>
                กรุณาทำข้อสอบในหน้าต่างนี้เท่านั้น การสลับหน้าจอซ้ำอาจส่งผลต่อการตัดสิทธิ์การสอบ
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowCheatWarning(false);
                  if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                }}
                style={{
                  width: "100%",
                  padding: "13px",
                  background: "#B91C1C",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: 800,
                  fontSize: "15px",
                  cursor: "pointer",
                }}
              >
                รับทราบและทำข้อสอบต่อ ✍️
              </button>
            </div>
          </div>
        )}

        {/* TOP STATUS BAR */}
        <header
          style={{
            background: "white",
            borderBottom: "1px solid #E2E8F0",
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            zIndex: 100,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          {/* Exam Title & Student Info */}
          <div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#1E293B" }}>
              {exam?.title}
            </div>
            <div style={{ fontSize: "12px", color: "var(--gray-500)", display: "flex", gap: "10px" }}>
              <span>👤 {studentName} ({studentRoom} เลขที่ {studentNumber})</span>
              <span>•</span>
              <span style={{ color: "#059669", fontWeight: 700 }}>
                ตอบแล้ว {answeredCount} จาก {questions.length} ข้อ
              </span>
            </div>
          </div>

          {/* Countdown Timer & Security */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "5px 10px",
                borderRadius: "8px",
                background: isFullscreen ? "#ECFDF5" : "#FEF2F2",
                color: isFullscreen ? "#059669" : "#DC2626",
                border: isFullscreen ? "1px solid #A7F3D0" : "1px solid #FECACA",
              }}
            >
              {isFullscreen ? "🖥️ เต็มจอ" : "⚠️ จอปกติ"}
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: timeLeft < 300 ? "#FEF2F2" : "#F1F5F9",
                border: timeLeft < 300 ? "1.5px solid #FCA5A5" : "1px solid #CBD5E1",
                color: timeLeft < 300 ? "#DC2626" : "#1E293B",
                padding: "8px 14px",
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: "16px",
                transition: "all 0.3s",
              }}
            >
              <span>⏱️</span>
              <span>{formatTime(timeLeft)}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmSubmit(true)}
              style={{
                background: "linear-gradient(135deg, #059669, #047857)",
                color: "white",
                border: "none",
                padding: "9px 18px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(5,150,105,0.25)",
              }}
            >
              📤 ส่งข้อสอบ
            </button>
          </div>
        </header>

        {/* MAIN BODY: Question Card + Navigator Palette */}
        <div
          style={{
            flex: 1,
            maxWidth: "1100px",
            width: "100%",
            margin: "0 auto",
            padding: "24px 20px",
            display: "grid",
            gridTemplateColumns: "1fr 280px",
            gap: "24px",
          }}
        >
          {/* LEFT: Current Question Content */}
          <div>
            {currentQuestion ? (
              <div
                style={{
                  background: "white",
                  borderRadius: "18px",
                  padding: "28px 32px",
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                }}
              >
                {/* Question Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        background: isAnswered ? "#ECFDF5" : "#FEF2F2",
                        color: isAnswered ? "#059669" : "#B91C1C",
                        fontWeight: 800,
                        fontSize: "14px",
                        padding: "4px 12px",
                        borderRadius: "8px",
                        border: isAnswered ? "1px solid #A7F3D0" : "1px solid #FECACA",
                      }}
                    >
                      ข้อที่ {currentIdx + 1} / {questions.length} {isAnswered && "✓"}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                      ({currentQuestion.points} คะแนน)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFlag(currentQuestion.id)}
                    style={{
                      border: "none",
                      background: isFlagged ? "#FEF3C7" : "#F3F4F6",
                      color: isFlagged ? "#B45309" : "var(--gray-600)",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>{isFlagged ? "🚩" : "🏳️"}</span>
                    <span>{isFlagged ? "ปักหมุดทบทวนแล้ว" : "ปักหมุดข้อนี้"}</span>
                  </button>
                </div>

                {/* Question Text */}
                <div
                  style={{
                    fontSize: "16.5px",
                    fontWeight: 600,
                    color: "#0F172A",
                    lineHeight: 1.7,
                    marginBottom: "24px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {currentQuestion.content}
                </div>

                {/* Choices or Subjective Text Area */}
                {(() => {
                  const isSubjective =
                    currentQuestion.type === "PARAGRAPH" ||
                    currentQuestion.type === "SHORT_ANSWER" ||
                    currentQuestion.type === "ESSAY" ||
                    !currentQuestion.question_choices ||
                    currentQuestion.question_choices.length === 0;

                  if (isSubjective) {
                    const textVal = answers[currentQuestion.id] || "";
                    return (
                      <div style={{ marginBottom: "28px" }}>
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "8px"
                        }}>
                          <label style={{ fontSize: "14px", fontWeight: 700, color: "#1E293B" }}>
                            ✍️ พิมพ์คำตอบของนักเรียน (ข้อสอบอัตนัย / บรรยาย):
                          </label>
                          <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                            {textVal.length} ตัวอักษร
                          </span>
                        </div>
                        <textarea
                          rows={6}
                          placeholder="พิมพ์คำตอบ / คำอธิบายของคุณที่นี่ (ระบบจะบันทึกคำตอบอัตโนมัติ)..."
                          value={textVal}
                          onChange={(e) => handleTextAnswer(currentQuestion.id, e.target.value)}
                          style={{
                            width: "100%",
                            padding: "14px 16px",
                            borderRadius: "12px",
                            border: textVal ? "2px solid #059669" : "2px solid #CBD5E1",
                            fontSize: "15px",
                            lineHeight: 1.6,
                            fontFamily: "'Sarabun', sans-serif",
                            outline: "none",
                            transition: "border-color 0.2s",
                            resize: "vertical",
                            background: "white",
                          }}
                        />
                        <div style={{ fontSize: "12px", color: textVal ? "#059669" : "#64748B", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span>{textVal ? "✅" : "ℹ️"}</span>
                          <span>{textVal ? "บันทึกคำตอบอัตโนมัติแล้ว" : "กรุณาพิมพ์คำตอบลงในช่องด้านบน"}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" }}>
                      {currentQuestion.question_choices.map((choice, cIdx) => {
                        const isSelected = selectedChoiceId === choice.id;
                        const letter = ["ก", "ข", "ค", "ง", "จ"][cIdx] || `${cIdx + 1}`;

                        return (
                          <div
                            key={choice.id}
                            onClick={() => handleSelectChoice(currentQuestion.id, choice.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              padding: "14px 18px",
                              borderRadius: "12px",
                              border: isSelected ? "2px solid #B91C1C" : "1.5px solid #E2E8F0",
                              background: isSelected ? "#FEF2F2" : "white",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                border: isSelected ? "2px solid #B91C1C" : "1.5px solid #CBD5E1",
                                background: isSelected ? "#B91C1C" : "white",
                                color: isSelected ? "white" : "var(--gray-700)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "13px",
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {letter}
                            </div>
                            <div
                              style={{
                                fontSize: "15px",
                                color: isSelected ? "#991B1B" : "#1E293B",
                                fontWeight: isSelected ? 700 : 500,
                                lineHeight: 1.5,
                              }}
                            >
                              {choice.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Prev / Next Navigation Buttons */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #F1F5F9", paddingTop: "20px" }}>
                  <button
                    type="button"
                    disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                    style={{
                      padding: "10px 20px",
                      borderRadius: "10px",
                      border: "1.5px solid #E2E8F0",
                      background: currentIdx === 0 ? "#F8FAFC" : "white",
                      color: currentIdx === 0 ? "var(--gray-400)" : "var(--gray-700)",
                      fontWeight: 700,
                      fontSize: "14px",
                      cursor: currentIdx === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    ⬅️ ข้อก่อนหน้า
                  </button>

                  <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>
                    ข้อ {currentIdx + 1} จาก {questions.length}
                  </div>

                  {currentIdx < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#B91C1C",
                        color: "white",
                        fontWeight: 800,
                        fontSize: "14px",
                        cursor: "pointer",
                      }}
                    >
                      ข้อถัดไป ➡️
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfirmSubmit(true)}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "10px",
                        border: "none",
                        background: "linear-gradient(135deg, #059669, #047857)",
                        color: "white",
                        fontWeight: 800,
                        fontSize: "14px",
                        cursor: "pointer",
                      }}
                    >
                      เสร็จสิ้นการสอบ 📤
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* RIGHT: Navigator Palette */}
          <div>
            <div
              style={{
                background: "white",
                borderRadius: "18px",
                padding: "20px",
                border: "1px solid #E2E8F0",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                position: "sticky",
                top: "84px",
              }}
            >
              <h4 style={{ fontSize: "14px", fontWeight: 800, color: "#1E293B", marginBottom: "12px" }}>
                🧭 แผนผังข้อสอบ
              </h4>

              {/* Status Legend */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11.5px", color: "var(--gray-600)", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#059669" }} />
                  <span>ตอบแล้ว ({answeredCount})</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#E2E8F0" }} />
                  <span>ยังไม่ตอบ ({questions.length - answeredCount})</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#F59E0B" }} />
                  <span>ปักหมุด ({flagged.size})</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: "2px solid #B91C1C" }} />
                  <span>ข้อปัจจุบัน</span>
                </div>
              </div>

              {/* Grid of numbers */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "8px",
                  maxHeight: "360px",
                  overflowY: "auto",
                  padding: "4px 2px",
                }}
              >
                {questions.map((q, idx) => {
                  const answered = !!answers[q.id];
                  const hasFlag = flagged.has(q.id);
                  const isCurrent = idx === currentIdx;

                  let bg = "#F8FAFC";
                  let color = "var(--gray-700)";
                  let border = "1px solid #E2E8F0";

                  if (answered) {
                    bg = "#ECFDF5";
                    color = "#047857";
                    border = "1.5px solid #A7F3D0";
                  }
                  if (hasFlag) {
                    bg = "#FEF3C7";
                    color = "#B45309";
                    border = "1.5px solid #FCD34D";
                  }
                  if (isCurrent) {
                    border = "2.5px solid #B91C1C";
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      style={{
                        height: "38px",
                        borderRadius: "8px",
                        border,
                        background: bg,
                        color,
                        fontWeight: isCurrent ? 800 : 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        transition: "all 0.15s",
                      }}
                    >
                      {idx + 1}
                      {hasFlag && (
                        <span style={{ position: "absolute", top: "1px", right: "2px", fontSize: "9px" }}>🚩</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* CONFIRM SUBMIT MODAL */}
        {showConfirmSubmit && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "20px",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                background: "white",
                maxWidth: "460px",
                width: "100%",
                borderRadius: "18px",
                padding: "32px 28px",
                textAlign: "center",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
              }}
            >
              <div style={{ fontSize: "44px", marginBottom: "12px" }}>📬</div>
              <h3 style={{ fontSize: "19px", fontWeight: 800, color: "#1E293B", marginBottom: "8px" }}>
                ยืนยันการส่งข้อสอบ?
              </h3>
              <p style={{ fontSize: "14px", color: "var(--gray-600)", marginBottom: "16px" }}>
                ท่านได้ตอบคำถามไปแล้ว <strong>{answeredCount}</strong> จากทั้งหมด <strong>{questions.length}</strong> ข้อ
                {answeredCount < questions.length && (
                  <span style={{ display: "block", color: "#DC2626", fontWeight: 700, marginTop: "6px" }}>
                    ⚠️ ยังมีข้อที่ยังไม่ได้ตอบอีก {questions.length - answeredCount} ข้อ!
                  </span>
                )}
              </p>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmSubmit(false)}
                  style={{
                    flex: "1",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1.5px solid #E2E8F0",
                    background: "white",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ย้อนกลับไปทำต่อ
                </button>
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  style={{
                    flex: "1.5",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #059669, #047857)",
                    color: "white",
                    fontWeight: 800,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  {submitting ? "กำลังส่งคำตอบ..." : "ยืนยันส่งข้อสอบ"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== RENDER: STAGE SUBMITTED (RESULT SCREEN) ====================
  if (stage === "submitted") {
    const totalMax = questions.reduce((acc, q) => acc + q.points, 0);
    const scorePct = totalMax > 0 ? Math.round(((finalScore || 0) / totalMax) * 100) : 0;
    const isPassed = scorePct >= 50;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "'Sarabun', 'Prompt', sans-serif",
        }}
      >
        <div
          style={{
            background: "white",
            maxWidth: "480px",
            width: "100%",
            borderRadius: "24px",
            padding: "40px 32px",
            textAlign: "center",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ fontSize: "56px", marginBottom: "12px" }}>🎉</div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#1E293B", marginBottom: "4px" }}>
            ส่งข้อสอบเรียบร้อยแล้ว!
          </h2>
          <p style={{ fontSize: "14px", color: "var(--gray-600)", marginBottom: "24px" }}>
            ระบบได้บันทึกคำตอบของท่านเข้าสู่ฐานข้อมูลโรงเรียนวังหลวงพิทยาสรรพ์แล้ว
          </p>

          {/* Student Info Summary */}
          <div
            style={{
              background: "#F8FAFC",
              padding: "14px 18px",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              marginBottom: "24px",
              fontSize: "13.5px",
              color: "var(--gray-800)",
              textAlign: "left",
              lineHeight: 1.8,
            }}
          >
            <div>ผู้เข้าสอบ: <strong>{studentName}</strong></div>
            <div>ระดับชั้น: <strong>{studentRoom}</strong> เลขที่: <strong>{studentNumber}</strong></div>
            <div>วิชา: <strong>{exam?.title}</strong></div>
            {tabSwitchCount > 0 && (
              <div style={{ color: "#DC2626", fontWeight: 700 }}>
                ⚠️ บันทึกการออกจากหน้าจอ: {tabSwitchCount} ครั้ง
              </div>
            )}
          </div>

          {/* Score Display Card */}
          <div
            style={{
              background: isPassed ? "#ECFDF5" : "#FEF2F2",
              border: `2px solid ${isPassed ? "#A7F3D0" : "#FECACA"}`,
              borderRadius: "16px",
              padding: "22px",
              marginBottom: "26px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 700, color: isPassed ? "#047857" : "#B91C1C", marginBottom: "4px" }}>
              คะแนนที่สอบได้ (Score)
            </div>
            <div style={{ fontSize: "44px", fontWeight: 900, color: isPassed ? "#065F46" : "#991B1B", lineHeight: 1.1 }}>
              {finalScore ?? "-"} <span style={{ fontSize: "20px", fontWeight: 600, color: "var(--gray-500)" }}>/ {totalMax}</span>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: isPassed ? "#059669" : "#DC2626", marginTop: "6px" }}>
              {isPassed ? "✅ ผ่านเกณฑ์การประเมิน" : "❌ ยังไม่ผ่านเกณฑ์ (ควรทบทวนเนื้อหา)"} ({scorePct}%)
            </div>
          </div>

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              style={{
                width: "100%",
                padding: "13px",
                background: "#1E293B",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              กลับสู่หน้าหลัก 🏠
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
