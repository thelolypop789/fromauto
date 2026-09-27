import { useState, useEffect, useMemo } from "react";
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
  created_at: string;
  question_choices: Choice[];
}

interface Exam {
  id: string;
  title: string;
  description: string;
  time_limit_minutes: number;
  is_secure_mode: boolean;
  created_at: string;
  exam_questions?: { points: number; question_id: string }[];
}

export default function QuestionBank() {
  const [activeTab, setActiveTab] = useState<"bank" | "builder" | "exams">("bank");
  
  // Data states
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("all");
  
  // Selection states for Exam Builder
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [randomCount, setRandomCount] = useState<number>(20);
  
  // Exam Builder form
  const [examTitle, setExamTitle] = useState("");
  const [examDesc, setExamDesc] = useState("ให้นักเรียนเลือกคำตอบที่ถูกต้องที่สุด ตรวจสอบความถูกต้องก่อนกดส่ง");
  const [timeLimit, setTimeLimit] = useState(40);
  const [isSecureMode, setIsSecureMode] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(true);
  const [savingExam, setSavingExam] = useState(false);
  const [createdExamId, setCreatedExamId] = useState<string | null>(null);

  // Existing exams list
  const [existingExams, setExistingExams] = useState<Exam[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);

  const [selectedGrade, setSelectedGrade] = useState("all");

  useEffect(() => {
    fetchQuestions();
    fetchExams();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const all: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("question_bank")
          .select(`
            *,
            question_choices (*)
          `)
          .range(from, from + step - 1)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching questions:", error);
          break;
        }

        if (data && data.length > 0) {
          all.push(...data);
          if (data.length < step) {
            hasMore = false;
          } else {
            from += step;
          }
        } else {
          hasMore = false;
        }
      }
      setQuestions(all);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExams = async () => {
    setLoadingExams(true);
    const { data, error } = await supabase
      .from("exams")
      .select(`
        *,
        exam_questions (
          points,
          question_id
        )
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setExistingExams(data);
    }
    setLoadingExams(false);
  };

  // Helper to extract grade from topic or course code
  const getGrade = (text?: string): string => {
    if (!text) return "";
    const str = text.toLowerCase();
    if (str.includes("ม.1") || str.includes("มัธยมศึกษาปีที่ 1") || str.includes("ม. 1") || /[ก-ฮa-z]21\d{3}/i.test(str)) return "ม.1";
    if (str.includes("ม.2") || str.includes("มัธยมศึกษาปีที่ 2") || str.includes("ม. 2") || /[ก-ฮa-z]22\d{3}/i.test(str)) return "ม.2";
    if (str.includes("ม.3") || str.includes("มัธยมศึกษาปีที่ 3") || str.includes("ม. 3") || /[ก-ฮa-z]23\d{3}/i.test(str)) return "ม.3";
    if (str.includes("ม.4") || str.includes("มัธยมศึกษาปีที่ 4") || str.includes("ม. 4") || /[ก-ฮa-z]31\d{3}/i.test(str)) return "ม.4";
    if (str.includes("ม.5") || str.includes("มัธยมศึกษาปีที่ 5") || str.includes("ม. 5") || /[ก-ฮa-z]32\d{3}/i.test(str)) return "ม.5";
    if (str.includes("ม.6") || str.includes("มัธยมศึกษาปีที่ 6") || str.includes("ม. 6") || /[ก-ฮa-z]33\d{3}/i.test(str)) return "ม.6";
    return "";
  };

  // Distinct topics / subjects
  const availableTopics = useMemo(() => {
    const topics = new Set<string>();
    questions.forEach((q) => {
      if (q.topic && q.topic.trim()) topics.add(q.topic.trim());
    });
    return Array.from(topics).sort();
  }, [questions]);

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchSearch =
        !searchTerm ||
        (q.topic && q.topic.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (q.content && q.content.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchTopic =
        selectedTopic === "all" ||
        (selectedTopic === "unspecified" ? (!q.topic || !q.topic.trim()) : q.topic === selectedTopic);

      const qGrade = getGrade(q.topic);
      const matchGrade = selectedGrade === "all" || qGrade === selectedGrade;

      return matchSearch && matchTopic && matchGrade;
    });
  }, [questions, searchTerm, selectedTopic, selectedGrade]);

  // Toggle selection
  const toggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      filteredQuestions.forEach((q) => next.add(q.id));
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedQuestionIds(new Set());
  };

  const handleRandomSelect = () => {
    const pool = filteredQuestions.length > 0 ? filteredQuestions : questions;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(randomCount, pool.length));
    setSelectedQuestionIds(new Set(picked.map((q) => q.id)));
  };

  // Create Exam in Supabase
  const handleSaveExam = async () => {
    if (!examTitle.trim()) {
      alert("กรุณากรอกชื่อชุดข้อสอบ");
      return;
    }
    if (selectedQuestionIds.size === 0) {
      alert("กรุณาเลือกข้อสอบอย่างน้อย 1 ข้อ");
      return;
    }

    setSavingExam(true);
    try {
      // 1. Insert exam
      const { data: examData, error: examError } = await supabase
        .from("exams")
        .insert([
          {
            title: examTitle.trim(),
            description: examDesc.trim(),
            time_limit_minutes: timeLimit,
            is_secure_mode: isSecureMode,
          },
        ])
        .select()
        .single();

      if (examError || !examData) {
        throw new Error(examError?.message || "ไม่สามารถสร้างชุดข้อสอบได้");
      }

      const examId = examData.id;

      // 2. Insert exam questions
      const examQuestionsPayload = Array.from(selectedQuestionIds).map((qId, idx) => ({
        exam_id: examId,
        question_id: qId,
        points: 1.0,
        order_num: idx + 1,
      }));

      const { error: relError } = await supabase
        .from("exam_questions")
        .insert(examQuestionsPayload);

      if (relError) {
        throw new Error(relError.message);
      }

      setCreatedExamId(examId);
      fetchExams();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + err.message);
    } finally {
      setSavingExam(false);
    }
  };

  const selectedQuestionsList = useMemo(() => {
    return questions.filter((q) => selectedQuestionIds.has(q.id));
  }, [questions, selectedQuestionIds]);

  const examShareUrl = createdExamId
    ? `${window.location.origin}/?exam=${createdExamId}`
    : "";

  return (
    <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "16px 20px" }}>
      {/* Top Header Card */}
      <div
        style={{
          background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
          borderRadius: "16px",
          padding: "24px 28px",
          color: "white",
          boxShadow: "0 8px 24px -4px rgba(15,23,42,0.18)",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span style={{ fontSize: "28px" }}>📚</span>
            <h1 style={{ fontFamily: "Prompt, sans-serif", fontSize: "22px", fontWeight: 700 }}>
              ระบบบริหารจัดการข้อสอบ & คลังกลาง
            </h1>
          </div>
          <p style={{ fontSize: "14px", color: "#94A3B8" }}>
            คลังข้อสอบทั้งหมด {questions.length.toLocaleString()} ข้อ • จัดชุดข้อสอบออนไลน์ คุมสอบไร้ทุจริต
          </p>
        </div>

        {/* Sub-tabs switch */}
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.08)",
            padding: "4px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <button
            onClick={() => setActiveTab("bank")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "13px",
              background: activeTab === "bank" ? "var(--crimson)" : "transparent",
              color: "white",
              transition: "all 0.2s",
            }}
          >
            🔍 คลังข้อสอบ ({questions.length})
          </button>
          <button
            onClick={() => setActiveTab("builder")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "13px",
              background: activeTab === "builder" ? "var(--gold)" : "transparent",
              color: activeTab === "builder" ? "#78350F" : "white",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ✏️ จัดชุดข้อสอบ
            {selectedQuestionIds.size > 0 && (
              <span
                style={{
                  background: activeTab === "builder" ? "#78350F" : "var(--crimson)",
                  color: "white",
                  padding: "1px 7px",
                  borderRadius: "10px",
                  fontSize: "11px",
                }}
              >
                {selectedQuestionIds.size}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("exams")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "13px",
              background: activeTab === "exams" ? "var(--green)" : "transparent",
              color: "white",
              transition: "all 0.2s",
            }}
          >
            📋 ชุดข้อสอบที่สร้าง ({existingExams.length})
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: QUESTION BANK ==================== */}
      {activeTab === "bank" && (
        <div>
          {/* Action Toolbar */}
          <div
            style={{
              background: "white",
              padding: "18px 20px",
              borderRadius: "14px",
              border: "1px solid var(--gray-200)",
              boxShadow: "var(--shadow-sm)",
              marginBottom: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 300px" }}>
                <input
                  type="text"
                  placeholder="🔍 ค้นหาคำถาม, เนื้อหาโจทย์ หรือวิชา..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid var(--gray-300)",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ minWidth: "260px", flex: "1 1 260px" }}>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid var(--gray-300)",
                    fontSize: "14px",
                    background: "white",
                  }}
                >
                  <option value="all">📂 ทุกกลุ่มสาระ/วิชา ({availableTopics.length} วิชาที่มีชื่อ)</option>
                  <option value="unspecified">
                    📌 ข้อสอบรอระบุชื่อวิชา ({questions.filter((q) => !q.topic || !q.topic.trim()).length} ข้อ)
                  </option>
                  {availableTopics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grade Level Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-700)" }}>
                🎓 เลือกระดับชั้น:
              </span>
              {["all", "ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGrade(g)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: selectedGrade === g ? "none" : "1px solid var(--gray-300)",
                    background: selectedGrade === g ? "var(--crimson)" : "var(--gray-50)",
                    color: selectedGrade === g ? "white" : "var(--gray-700)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {g === "all" ? "ทุกระดับชั้น" : g}
                </button>
              ))}
            </div>

            {/* Quick Actions Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                paddingTop: "12px",
                borderTop: "1px solid var(--gray-100)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", color: "var(--gray-600)" }}>
                  พบ <strong>{filteredQuestions.length}</strong> ข้อ
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSelectAllFiltered}
                  style={{ fontSize: "12px", padding: "6px 12px" }}
                >
                  ☑️ เลือกทั้งหมดในหน้านี้
                </button>
                {selectedQuestionIds.size > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleDeselectAll}
                    style={{ fontSize: "12px", padding: "6px 12px", color: "var(--red)" }}
                  >
                    ✕ ยกเลิกที่เลือก ({selectedQuestionIds.size})
                  </button>
                )}
              </div>

              {/* Random Picker */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", color: "var(--gray-600)" }}>สุ่มเลือก:</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={randomCount}
                  onChange={(e) => setRandomCount(Number(e.target.value))}
                  style={{
                    width: "60px",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid var(--gray-300)",
                    textAlign: "center",
                    fontSize: "13px",
                  }}
                />
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={handleRandomSelect}
                  style={{ fontSize: "12px", padding: "6px 14px", fontWeight: 700 }}
                >
                  🎲 สุ่ม {randomCount} ข้อ
                </button>
              </div>
            </div>
          </div>

          {/* Question List */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px", color: "var(--gray-500)" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
              <div>กำลังโหลดข้อมูลคลังข้อสอบ...</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
              {filteredQuestions.map((q) => {
                const isSelected = selectedQuestionIds.has(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => toggleSelectQuestion(q.id)}
                    style={{
                      background: isSelected ? "#FFFBEB" : "white",
                      borderRadius: "14px",
                      padding: "18px 20px",
                      border: isSelected ? "2px solid var(--gold)" : "1px solid var(--gray-200)",
                      boxShadow: isSelected ? "0 4px 14px rgba(245,158,11,0.2)" : "var(--shadow-sm)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "var(--crimson)",
                          background: "var(--crimson-light)",
                          padding: "3px 8px",
                          borderRadius: "6px",
                        }}
                      >
                        {q.topic || "แบบทดสอบทั่วไป"}
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent div
                        style={{ width: "18px", height: "18px", accentColor: "var(--crimson)", cursor: "pointer" }}
                      />
                    </div>

                    <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--gray-900)", marginBottom: "14px", lineHeight: "1.4" }}>
                      {q.content}
                    </div>

                    {/* Choices */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "auto" }}>
                      {q.question_choices &&
                        q.question_choices
                          .sort((a, b) => a.order_num - b.order_num)
                          .map((c, cIdx) => {
                            const letters = ["ก", "ข", "ค", "ง", "จ"];
                            return (
                              <div
                                key={c.id}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  background: c.is_correct ? "var(--green-light)" : "var(--gray-50)",
                                  border: c.is_correct ? "1px solid var(--green)" : "1px solid var(--gray-200)",
                                  fontSize: "13px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontSize: "12px",
                                    color: c.is_correct ? "var(--green-dark)" : "var(--gray-600)",
                                    width: "18px",
                                  }}
                                >
                                  {letters[cIdx] ? `${letters[cIdx]}.` : "-"}
                                </span>
                                <span style={{ color: c.is_correct ? "var(--green-dark)" : "var(--gray-800)", flex: 1 }}>
                                  {c.content}
                                </span>
                                {c.is_correct && <span style={{ fontSize: "12px" }}>✅</span>}
                              </div>
                            );
                          })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating Bottom Bar for Selected Questions */}
          {selectedQuestionIds.size > 0 && (
            <div
              style={{
                position: "sticky",
                bottom: "20px",
                marginTop: "24px",
                background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                borderRadius: "16px",
                padding: "16px 24px",
                color: "white",
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                zIndex: 100,
              }}
            >
              <div>
                <span style={{ fontSize: "16px", fontWeight: 700 }}>
                  🎯 เลือกข้อสอบไว้แล้ว {selectedQuestionIds.size} ข้อ
                </span>
                <span style={{ fontSize: "13px", color: "#94A3B8", marginLeft: "12px" }}>
                  (คิดเป็นคะแนนเต็ม {selectedQuestionIds.size} คะแนน)
                </span>
              </div>
              <button
                className="btn btn-gold"
                onClick={() => {
                  if (!examTitle) {
                    setExamTitle(`แบบทดสอบ (${selectedQuestionIds.size} ข้อ) - วันที่ ${new Date().toLocaleDateString("th-TH")}`);
                  }
                  setActiveTab("builder");
                }}
                style={{ padding: "10px 24px", fontSize: "15px", fontWeight: 700 }}
              >
                ✏️ ดำเนินการจัดชุดข้อสอบ →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: EXAM BUILDER ==================== */}
      {activeTab === "builder" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px" }}>
          {/* Settings Left Column */}
          <div
            style={{
              background: "white",
              padding: "24px 28px",
              borderRadius: "16px",
              border: "1px solid var(--gray-200)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <h2
              style={{
                fontFamily: "Prompt, sans-serif",
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--gray-900)",
                marginBottom: "18px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>⚙️</span> ข้อมูลและเงื่อนไขการจัดชุดข้อสอบ
            </h2>

            <div className="field">
              <label>📝 ชื่อชุดข้อสอบ *</label>
              <input
                type="text"
                placeholder="เช่น แบบทดสอบกลางภาค วิทยาศาสตร์ ม.1 ภาคเรียนที่ 1"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
              />
            </div>

            <div className="field">
              <label>คำชี้แจง / คำแนะนำสำหรับนักเรียน</label>
              <textarea
                rows={3}
                value={examDesc}
                onChange={(e) => setExamDesc(e.target.value)}
                placeholder="คำอธิบายเพิ่มเติม..."
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="field">
                <label>⏱️ เวลาในการทำข้อสอบ (นาที)</label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                />
              </div>

              <div className="field">
                <label>🎯 คะแนนเต็มรวม</label>
                <input
                  type="text"
                  readOnly
                  value={`${selectedQuestionIds.size} คะแนน (ข้อละ 1 คะแนน)`}
                  style={{ background: "var(--gray-50)", color: "var(--gray-600)" }}
                />
              </div>
            </div>

            {/* Anti-Cheating & Proctoring Options */}
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                background: "var(--gray-50)",
                borderRadius: "12px",
                border: "1px solid var(--gray-200)",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--crimson)", marginBottom: "12px" }}>
                🛡️ ระบบป้องกันการทุจริต & การควบคุมการสอบ (Anti-Cheating)
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isSecureMode}
                    onChange={(e) => setIsSecureMode(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--crimson)" }}
                  />
                  <span>
                    <strong>เปิดโหมดคุมสอบเข้มงวด:</strong> บังคับเต็มจอ (Fullscreen Lock) และตรวจจับการสลับแท็บ/สลับหน้าจอ
                  </span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--crimson)" }}
                  />
                  <span>
                    <strong>สุ่มสลับลำดับข้อสอบ (Shuffle Questions):</strong> นักเรียนแต่ละคนจะได้โจทย์ข้อสอบเรียงไม่เหมือนกัน
                  </span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={shuffleChoices}
                    onChange={(e) => setShuffleChoices(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--crimson)" }}
                  />
                  <span>
                    <strong>สุ่มสลับลำดับช้อยส์ (Shuffle Choices):</strong> ก, ข, ค, ง สลับตำแหน่งกันอัตโนมัติ
                  </span>
                </label>
              </div>
            </div>

            {/* Save Button */}
            <div style={{ marginTop: "24px" }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingExam || selectedQuestionIds.size === 0}
                onClick={handleSaveExam}
                style={{ width: "100%", padding: "14px", fontSize: "16px", fontWeight: 700 }}
              >
                {savingExam ? "กำลังบันทึกและจัดชุดข้อสอบ..." : `🚀 บันทึกและสร้างชุดข้อสอบ (${selectedQuestionIds.size} ข้อ)`}
              </button>
            </div>
          </div>

          {/* Selected Questions Preview Right Column */}
          <div
            style={{
              background: "white",
              padding: "24px",
              borderRadius: "16px",
              border: "1px solid var(--gray-200)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "800px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontFamily: "Prompt, sans-serif", fontSize: "16px", fontWeight: 700 }}>
                📋 ข้อสอบที่เลือก ({selectedQuestionsList.length} ข้อ)
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveTab("bank")}
                style={{ fontSize: "12px", padding: "4px 10px" }}
              >
                + เพิ่ม/เปลี่ยนข้อ
              </button>
            </div>

            {selectedQuestionsList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--gray-400)", margin: "auto" }}>
                ยังไม่ได้เลือกข้อสอบ กรุณากลับไปที่แท็บ "คลังข้อสอบ" เพื่อเลือกข้อ
              </div>
            ) : (
              <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "6px" }}>
                {selectedQuestionsList.map((q, idx) => (
                  <div
                    key={q.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "10px",
                      background: "var(--gray-50)",
                      border: "1px solid var(--gray-200)",
                      fontSize: "13px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, color: "var(--crimson)" }}>ข้อที่ {idx + 1}</span>
                      <button
                        onClick={() => toggleSelectQuestion(q.id)}
                        style={{ border: "none", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: "12px" }}
                      >
                        นำออก
                      </button>
                    </div>
                    <div style={{ color: "var(--gray-800)", fontWeight: 500 }}>{q.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Success Dialog Modal */}
          {createdExamId && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 999,
                padding: "16px",
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: "20px",
                  padding: "32px",
                  maxWidth: "520px",
                  width: "100%",
                  textAlign: "center",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                  animation: "slideUp .3s ease",
                }}
              >
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎉</div>
                <h3 style={{ fontFamily: "Prompt, sans-serif", fontSize: "20px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "8px" }}>
                  สร้างชุดข้อสอบสำเร็จแล้ว!
                </h3>
                <p style={{ fontSize: "14px", color: "var(--gray-600)", marginBottom: "20px" }}>
                  ชุดข้อสอบ <strong>"{examTitle}"</strong> พร้อมเปิดให้นักเรียนเข้าทำข้อสอบแล้ว
                </p>

                {/* QR Code */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(examShareUrl)}`}
                    alt="QR Code"
                    style={{ borderRadius: "10px", border: "1px solid var(--gray-200)", padding: "8px", background: "white" }}
                  />
                </div>

                {/* Copy Link Input */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
                  <input
                    type="text"
                    readOnly
                    value={examShareUrl}
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid var(--gray-300)", fontSize: "13px" }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(examShareUrl);
                      alert("คัดลอกลิงก์เรียบร้อยแล้ว!");
                    }}
                    style={{ padding: "10px 16px", whiteSpace: "nowrap" }}
                  >
                    คัดลอกลิงก์
                  </button>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setCreatedExamId(null);
                      setActiveTab("exams");
                    }}
                    style={{ flex: 1 }}
                  >
                    ดูรายการชุดข้อสอบทั้งหมด
                  </button>
                  <button
                    className="btn btn-gold"
                    onClick={() => {
                      setCreatedExamId(null);
                      setSelectedQuestionIds(new Set());
                      setExamTitle("");
                      setActiveTab("bank");
                    }}
                    style={{ flex: 1 }}
                  >
                    สร้างชุดใหม่อีกชุด
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: EXISTING EXAMS ==================== */}
      {activeTab === "exams" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontFamily: "Prompt, sans-serif", fontSize: "18px", fontWeight: 700 }}>
              📋 รายการชุดข้อสอบออนไลน์ ({existingExams.length} ชุด)
            </h2>
            <button
              className="btn btn-primary"
              onClick={() => setActiveTab("bank")}
              style={{ fontSize: "13px", padding: "8px 16px" }}
            >
              + จัดชุดข้อสอบใหม่จากคลัง
            </button>
          </div>

          {loadingExams ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--gray-500)" }}>
              กำลังโหลดชุดข้อสอบ...
            </div>
          ) : existingExams.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: "white",
                borderRadius: "16px",
                border: "1px dashed var(--gray-300)",
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📝</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--gray-800)", marginBottom: "6px" }}>
                ยังไม่มีชุดข้อสอบออนไลน์
              </div>
              <div style={{ fontSize: "13px", color: "var(--gray-500)", marginBottom: "18px" }}>
                คุณครูสามารถเลือกข้อสอบจากคลัง 2,176 ข้อเพื่อสร้างชุดข้อสอบออนไลน์ได้ทันที
              </div>
              <button className="btn btn-primary" onClick={() => setActiveTab("bank")}>
                ไปยังคลังข้อสอบเพื่อเริ่มสร้าง
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
              {existingExams.map((ex) => {
                const count = ex.exam_questions ? ex.exam_questions.length : 0;
                const link = `${window.location.origin}/?exam=${ex.id}`;
                return (
                  <div
                    key={ex.id}
                    style={{
                      background: "white",
                      borderRadius: "14px",
                      padding: "20px",
                      border: "1px solid var(--gray-200)",
                      boxShadow: "var(--shadow-sm)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <span className="badge badge-green" style={{ fontSize: "11px", padding: "3px 8px" }}>
                        🟢 เปิดสอบอยู่
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                        {new Date(ex.created_at).toLocaleDateString("th-TH")}
                      </span>
                    </div>

                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "6px" }}>
                      {ex.title}
                    </div>

                    <div style={{ fontSize: "13px", color: "var(--gray-600)", marginBottom: "14px", flexGrow: 1 }}>
                      {ex.description || "ไม่มีคำอธิบายเพิ่มเติม"}
                    </div>

                    <div
                      style={{
                        padding: "10px 12px",
                        background: "var(--gray-50)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "var(--gray-700)",
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "16px",
                      }}
                    >
                      <span>
                        📊 จำนวน: <strong>{count} ข้อ</strong>
                      </span>
                      <span>
                        ⏱️ เวลา: <strong>{ex.time_limit_minutes || 40} นาที</strong>
                      </span>
                      <span>
                        🛡️ โหมด: <strong>{ex.is_secure_mode ? "คุมเข้ม" : "ปกติ"}</strong>
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(link);
                          alert("คัดลอกลิงก์เข้าสอบสำหรับนักเรียนแล้ว!");
                        }}
                        style={{ flex: 1, fontSize: "12px", padding: "8px" }}
                      >
                        🔗 คัดลอกลิงก์สอบ
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          window.open(link, "_blank");
                        }}
                        style={{ flex: 1, fontSize: "12px", padding: "8px" }}
                      >
                        👁️ ทดลองสอบ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
