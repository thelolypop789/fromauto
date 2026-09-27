import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function QuestionBank() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('question_bank')
      .select(`
        *,
        question_choices (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching questions:", error);
    } else {
      setQuestions(data || []);
    }
    setLoading(false);
  };

  const filteredQuestions = questions.filter(q => 
    (q.topic && q.topic.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (q.content && q.content.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="question-bank-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Prompt, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--gray-900)' }}>
          📚 คลังข้อสอบทั้งหมด ({questions.length} ข้อ)
        </h2>
        <button 
          className="btn btn-primary"
          style={{ padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}
          onClick={() => alert("ระบบจัดชุดข้อสอบกำลังพัฒนา")}
        >
          + จัดชุดข้อสอบใหม่
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="🔍 ค้นหาโจทย์ หรือ ชื่อวิชา..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '12px 16px', 
            borderRadius: '10px', 
            border: '1px solid var(--gray-300)',
            fontSize: '15px'
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
          กำลังโหลดคลังข้อสอบ...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {filteredQuestions.map((q, idx) => (
            <div key={q.id} style={{ 
              background: 'white', 
              borderRadius: '12px', 
              padding: '20px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              border: '1px solid var(--gray-200)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--crimson)', fontWeight: 600, marginBottom: '8px' }}>
                {q.topic || "ไม่ระบุชื่อวิชา"}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--gray-800)', marginBottom: '16px', flexGrow: 1 }}>
                {idx + 1}. {q.content}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {q.question_choices && q.question_choices
                  .sort((a: any, b: any) => a.order_num - b.order_num)
                  .map((c: any, cIdx: number) => {
                    const letters = ['ก', 'ข', 'ค', 'ง', 'จ'];
                    return (
                      <div key={c.id} style={{ 
                        padding: '8px 12px', 
                        borderRadius: '6px', 
                        background: c.is_correct ? 'var(--green-light)' : 'var(--gray-50)',
                        border: c.is_correct ? '1px solid var(--green)' : '1px solid var(--gray-200)',
                        fontSize: '14px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontWeight: 'bold', color: c.is_correct ? 'var(--green-dark)' : 'var(--gray-600)' }}>
                          {letters[cIdx] ? letters[cIdx] + '.' : '-'}
                        </span> 
                        <span style={{ color: c.is_correct ? 'var(--green-dark)' : 'var(--gray-700)' }}>
                          {c.content}
                        </span>
                        {c.is_correct && <span style={{ marginLeft: 'auto' }}>✅</span>}
                      </div>
                    );
                })}
              </div>
            </div>
          ))}
          
          {filteredQuestions.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
              ไม่พบข้อสอบที่ค้นหา
            </div>
          )}
        </div>
      )}
    </div>
  );
}
