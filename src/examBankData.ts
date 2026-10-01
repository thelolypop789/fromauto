export interface ExamQuestion {
  q: string;
  choices: string[];
  answer: number;
  bloom?: "remembering" | "understanding" | "applying" | "analyzing";
  explanation?: string;
}

export interface ExamItem {
  id: string;
  code: string;
  title: string;
  desc?: string;
  subject: string;
  grade: string;
  term: string;
  examType: "ข้อสอบกลางภาค" | "ข้อสอบปลายภาค" | "แบบทดสอบเก็บคะแนน" | "ข้อสอบมาตรฐาน O-NET";
  teacher: string;
  questionCount: number;
  headerCount?: number;
  hasAnswer: boolean;
  editUrl?: string;
  viewUrl?: string;
  createdAt: string;
  isCustom?: boolean;
  bloomCounts: {
    remembering: number;
    understanding: number;
    applying: number;
    analyzing: number;
  };
  sampleQuestions: ExamQuestion[];
}

export const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string; bar: string; icon: string }> = {
  "วิทยาศาสตร์และเทคโนโลยี": { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", bar: "#3B82F6", icon: "🔬" },
  "คณิตศาสตร์": { bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE", bar: "#6366F1", icon: "📐" },
  "ภาษาไทย": { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A", bar: "#F59E0B", icon: "📖" },
  "ภาษาต่างประเทศ": { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", bar: "#10B981", icon: "🌐" },
  "สังคมศึกษา ศาสนาและวัฒนธรรม": { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3", bar: "#F43F5E", icon: "🌍" },
  "สุขศึกษาและพลศึกษา": { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0", bar: "#22C55E", icon: "⚽" },
  "ศิลปะ": { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF", bar: "#A855F7", icon: "🎨" },
  "การงานอาชีพ": { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", bar: "#D97706", icon: "🛠️" },
  "ทั่วไป": { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB", bar: "#6B7280", icon: "📋" },
};

export const INITIAL_EXAM_BANK: ExamItem[] = [
  {
    id: "bank-sci-301",
    code: "ว23101",
    title: "แบบทดสอบกลางภาค วิทยาศาสตร์กายภาพและพันธุศาสตร์",
    desc: "ครอบคลุมหน่วยการเรียนรู้: พันธุศาสตร์เบื้องต้น กฎของเมนเดล คลื่นแม่เหล็กไฟฟ้า และแรงโน้มถ่วง",
    subject: "วิทยาศาสตร์และเทคโนโลยี",
    grade: "ม.3",
    term: "ภาคเรียนที่ 1/2567",
    examType: "ข้อสอบกลางภาค",
    teacher: "ครูดวงพร วารีสมบูรณ์",
    questionCount: 30,
    headerCount: 4,
    hasAnswer: true,
    viewUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc-sample-view-sci/viewform",
    editUrl: "https://docs.google.com/forms/d/1sample-edit-sci/edit",
    createdAt: "2026-09-18T08:30:00.000Z",
    bloomCounts: { remembering: 8, understanding: 12, applying: 6, analyzing: 4 },
    sampleQuestions: [
      {
        q: "ลักษณะทางพันธุกรรมข้อใดของมนุษย์ที่ควบคุมโดยยีนเด่นบนออโตโซม?",
        choices: ["มีลักยิ้ม", "ตาบอดสี", "ฮีโมฟิเลีย", "ผิวเผือก"],
        answer: 0,
        bloom: "understanding",
        explanation: "การมีลักยิ้มเป็นลักษณะเด่นบนออโตโซม ส่วนตาบอดสีและฮีโมฟิเลียเป็นยีนด้อยบนโครโมโซม X",
      },
      {
        q: "หากนำพืชดอกสีแดงพันธุ์แท้ (TT) ผสมกับพืชดอกสีขาว (tt) รุ่น F1 จะมีฟีโนไทป์อย่างไร?",
        choices: ["ดอกสีแดงทั้งหมด", "ดอกสีขาวทั้งหมด", "ดอกสีชมพูทั้งหมด", "ดอกสีแดง 3 : สีขาว 1"],
        answer: 0,
        bloom: "applying",
        explanation: "รุ่น F1 จะมีจีโนไทป์ Tt ทั้งหมด แสดงฟีโนไทป์เป็นดอกสีแดง 100%",
      },
      {
        q: "คลื่นแม่เหล็กไฟฟ้าชนิดใดมีความยาวคลื่นสั้นที่สุดและมีพลังงานสูงที่สุด?",
        choices: ["รังสีแกมมา", "รังสีเอกซ์", "รังสีอัลตราไวโอเลต", "คลื่นไมโครเวฟ"],
        answer: 0,
        bloom: "remembering",
      },
    ],
  },
  {
    id: "bank-math-401",
    code: "ค31101",
    title: "แบบทดสอบท้ายบท เซตและตรรกศาสตร์เบื้องต้น",
    desc: "ประเมินความเข้าใจการดำเนินการของเซต แผนภาพเวนน์-ออยเลอร์ และค่าความจริงของประพจน์",
    subject: "คณิตศาสตร์",
    grade: "ม.4",
    term: "ภาคเรียนที่ 1/2567",
    examType: "แบบทดสอบเก็บคะแนน",
    teacher: "ครูธีรภัทร ชาญวิทย์",
    questionCount: 25,
    headerCount: 4,
    hasAnswer: true,
    viewUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc-sample-view-math/viewform",
    editUrl: "https://docs.google.com/forms/d/1sample-edit-math/edit",
    createdAt: "2026-09-22T09:15:00.000Z",
    bloomCounts: { remembering: 5, understanding: 10, applying: 7, analyzing: 3 },
    sampleQuestions: [
      {
        q: "กำหนด A = {1, 2, {3, 4}} ข้อใดต่อไปนี้ถูกต้อง?",
        choices: ["{3, 4} ∈ A", "3 ∈ A", "{1, 2} ⊂ A", "∅ ∉ P(A)"],
        answer: 0,
        bloom: "understanding",
      },
      {
        q: "ประพจน์ p → q สมมูลกับประพจน์ในข้อใด?",
        choices: ["~p ∨ q", "~q → ~p", "~(p ∧ ~q)", "ถูกต้องทุกข้อ"],
        answer: 3,
        bloom: "analyzing",
      },
      {
        q: "ถ้าเซต A มีสมาชิก 5 ตัว จำนวนสับเซตทั้งหมดของ A เท่ากับเท่าใด?",
        choices: ["32 สับเซต", "16 สับเซต", "64 สับเซต", "25 สับเซต"],
        answer: 0,
        bloom: "remembering",
      },
    ],
  },
  {
    id: "bank-thai-201",
    code: "ท22101",
    title: "แบบทดสอบปลายภาค วรรณคดีวิจักษ์และหลักภาษาไทย",
    desc: "วิเคราะห์คุณค่ากาพย์ห่อโคลงประพาสธารทองแดง คำสมาส คำสนธิ และการใช้ระดับภาษา",
    subject: "ภาษาไทย",
    grade: "ม.2",
    term: "ภาคเรียนที่ 1/2567",
    examType: "ข้อสอบปลายภาค",
    teacher: "ครูกานดา บุญรักษา",
    questionCount: 40,
    headerCount: 4,
    hasAnswer: true,
    viewUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc-sample-view-thai/viewform",
    editUrl: "https://docs.google.com/forms/d/1sample-edit-thai/edit",
    createdAt: "2026-09-20T10:00:00.000Z",
    bloomCounts: { remembering: 10, understanding: 16, applying: 8, analyzing: 6 },
    sampleQuestions: [
      {
        q: "คำในข้อใดเป็น 'คำสมาสที่มีการสนธิ' ทุกคำ?",
        choices: ["มเหสี, ธันวาคม, จินตนาการ", "ประวัติศาสตร์, ภูมิศาสตร์, ราชการ", "วิทยาศาสตร์, พลศึกษา, วาตภัย", "ศิลปกรรม, วัฒนธรรม, เกษตรกร"],
        answer: 0,
        bloom: "analyzing",
      },
      {
        q: "บทประพันธ์ 'กระจายสยายเกศา ดั่งอัปสราจำแลง' ใช้โวหารภาพพจน์ชนิดใด?",
        choices: ["อุปมาโวหาร", "อุปลักษณ์", "บุคคลวัต", "อติพจน์"],
        answer: 0,
        bloom: "understanding",
      },
    ],
  },
  {
    id: "bank-eng-301",
    code: "อ33101",
    title: "O-NET Readiness Reading & Vocabulary Examination",
    desc: "Contextual vocabulary, reading comprehension for inference, error identification, and communicative competence",
    subject: "ภาษาต่างประเทศ",
    grade: "ม.6",
    term: "ภาคเรียนที่ 1/2567",
    examType: "ข้อสอบมาตรฐาน O-NET",
    teacher: "ครูศิริพร แมคโดนัลด์",
    questionCount: 35,
    headerCount: 4,
    hasAnswer: true,
    viewUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc-sample-view-eng/viewform",
    editUrl: "https://docs.google.com/forms/d/1sample-edit-eng/edit",
    createdAt: "2026-09-24T13:40:00.000Z",
    bloomCounts: { remembering: 7, understanding: 13, applying: 9, analyzing: 6 },
    sampleQuestions: [
      {
        q: "Choose the word that best completes the sentence: 'The committee decided to ______ the meeting until next Tuesday.'",
        choices: ["postpone", "cancel", "resume", "accelerate"],
        answer: 0,
        bloom: "applying",
      },
      {
        q: "If she ______ harder during the semester, she would have passed the scholarship interview.",
        choices: ["had studied", "studies", "studied", "would study"],
        answer: 0,
        bloom: "applying",
      },
    ],
  },
  {
    id: "bank-soc-201",
    code: "ส21101",
    title: "แบบทดสอบกลางภาค หน้าที่พลเมืองและภูมิศาสตร์ทวีปเอเชีย",
    desc: "ประเมินระบอบการปกครอง สิทธิมนุษยชน และภูมิศาสตร์กายภาพและสิ่งแวดล้อม",
    subject: "สังคมศึกษา ศาสนาและวัฒนธรรม",
    grade: "ม.1",
    term: "ภาคเรียนที่ 1/2567",
    examType: "ข้อสอบกลางภาค",
    teacher: "ครูวิชัย เจริญสุข",
    questionCount: 30,
    headerCount: 4,
    hasAnswer: true,
    viewUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc-sample-view-soc/viewform",
    editUrl: "https://docs.google.com/forms/d/1sample-edit-soc/edit",
    createdAt: "2026-09-15T11:20:00.000Z",
    bloomCounts: { remembering: 10, understanding: 11, applying: 5, analyzing: 4 },
    sampleQuestions: [
      {
        q: "หลักการสำคัญที่สุดของระบอบประชาธิปไตยอันมีพระมหากษัตริย์ทรงเป็นประมุขคือข้อใด?",
        choices: ["อำนาจอธิปไตยเป็นของปวงชนชาวไทย", "การแบ่งแยกอำนาจเด็ดขาด", "การมีพรรคการเมืองพรรคเดียว", "การรวมศูนย์อำนาจไว้ที่ส่วนกลาง"],
        answer: 0,
        bloom: "understanding",
      },
      {
        q: "แนวเทือกเขาหิมาลัยเกิดจากการเคลื่อนที่ชนกันของแผ่นเปลือกโลกใด?",
        choices: ["แผ่นอินเดีย และ แผ่นยูเรเชีย", "แผ่นแปซิฟิก และ แผ่นอเมริกาเหนือ", "แผ่นแอฟริกา และ แผ่นยูเรเชีย", "แผ่นออสเตรเลีย และ แผ่นแอนตาร์กติก"],
        answer: 0,
        bloom: "remembering",
      },
    ],
  },
  {
    id: "bank-health-101",
    code: "พ32101",
    title: "แบบทดสอบวัดผลสัมฤทธิ์ การสร้างเสริมสุขภาพและการปฐมพยาบาล",
    desc: "โภชนาการสำหรับวัยรุ่น การป้องกันพฤติกรรมเสี่ยง และหลักการปฐมพยาบาลเบื้องต้น (CPR)",
    subject: "สุขศึกษาและพลศึกษา",
    grade: "ม.5",
    term: "ภาคเรียนที่ 1/2567",
    examType: "แบบทดสอบเก็บคะแนน",
    teacher: "ครูอนุชา เกียรติกล้า",
    questionCount: 20,
    headerCount: 3,
    hasAnswer: true,
    viewUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc-sample-view-health/viewform",
    editUrl: "https://docs.google.com/forms/d/1sample-edit-health/edit",
    createdAt: "2026-09-25T14:10:00.000Z",
    bloomCounts: { remembering: 6, understanding: 8, applying: 4, analyzing: 2 },
    sampleQuestions: [
      {
        q: "อัตราส่วนการกดหน้าอกต่อการช่วยหายใจในการทำ CPR สำหรับผู้ใหญ่ตามมาตรฐานสากลคือข้อใด?",
        choices: ["กด 30 ครั้ง ช่วยหายใจ 2 ครั้ง", "กด 15 ครั้ง ช่วยหายใจ 2 ครั้ง", "กด 50 ครั้ง ช่วยหายใจ 1 ครั้ง", "กดอย่างต่อเนื่องโดยไม่ต้องช่วยหายใจ"],
        answer: 0,
        bloom: "applying",
      },
      {
        q: "ดัชนีมวลกาย (BMI) ที่อยู่ในเกณฑ์มาตรฐานสมส่วนคือช่วงใด?",
        choices: ["18.5 - 22.9 กก./ตร.ม.", "15.0 - 18.4 กก./ตร.ม.", "23.0 - 24.9 กก./ตร.ม.", "25.0 - 29.9 กก./ตร.ม."],
        answer: 0,
        bloom: "remembering",
      },
    ],
  },
  {
    id: "bank-art-201",
    code: "ศ23101",
    title: "แบบทดสอบทัศนศิลป์และดนตรี-นาฏศิลป์ไทย",
    desc: "ทัศนธาตุ หลักการจัดองค์ประกอบศิลป์ วงดนตรีไทย และนาฏยศัพท์",
    subject: "ศิลปะ",
    grade: "ม.3",
    term: "ภาคเรียนที่ 1/2567",
    examType: "แบบทดสอบเก็บคะแนน",
    teacher: "ครูประภาส สุนทรศิลป์",
    questionCount: 20,
    headerCount: 3,
    hasAnswer: true,
    viewUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc-sample-view-art/viewform",
    editUrl: "https://docs.google.com/forms/d/1sample-edit-art/edit",
    createdAt: "2026-09-19T15:30:00.000Z",
    bloomCounts: { remembering: 7, understanding: 8, applying: 3, analyzing: 2 },
    sampleQuestions: [
      {
        q: "วงดนตรีไทยประเภทใดที่ใช้บรรเลงในงานอวมงคลเป็นหลัก?",
        choices: ["วงปี่พาทย์นางหงส์", "วงมโหรีเครื่องใหญ่", "วงเครื่องสายผสมเปียโน", "วงปี่พาทย์ดึกดำบรรพ์"],
        answer: 0,
        bloom: "understanding",
      },
      {
        q: "วรรณะสีตรงข้าม (Complementary Color) ของสีเหลืองในวงล้อสีคือสีใด?",
        choices: ["สีม่วง", "สีน้ำเงิน", "สีเขียว", "สีส้ม"],
        answer: 0,
        bloom: "remembering",
      },
    ],
  },
  {
    id: "bank-tech-601",
    code: "ง16101",
    title: "แบบทดสอบการงานอาชีพและทักษะการดำรงชีวิต",
    desc: "การจัดเก็บเอกสารสำคัญ การดูแลรักษาเสื้อผ้า และงานช่างพื้นฐานในบ้าน",
    subject: "การงานอาชีพ",
    grade: "ม.1",
    term: "ภาคเรียนที่ 1/2567",
    examType: "แบบทดสอบเก็บคะแนน",
    teacher: "ครูมาลี เจริญผล",
    questionCount: 20,
    headerCount: 3,
    hasAnswer: true,
    viewUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc-sample-view-work/viewform",
    editUrl: "https://docs.google.com/forms/d/1sample-edit-work/edit",
    createdAt: "2026-09-12T09:00:00.000Z",
    bloomCounts: { remembering: 8, understanding: 7, applying: 3, analyzing: 2 },
    sampleQuestions: [
      {
        q: "เอกสารประเภทใดที่ควรจัดเก็บไว้ในกระเป๋าสตางค์หรือพกติดตัวตลอดเวลา?",
        choices: ["บัตรประจำตัวประชาชน", "ทะเบียนบ้าน", "โฉนดที่ดิน", "สูติบัตร"],
        answer: 0,
        bloom: "remembering",
      },
    ],
  },
];

// Helper to deduce subject from form title
export function detectSubjectFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("วิทย์") || t.includes("เคมี") || t.includes("ฟิสิกส์") || t.includes("ชีว") || t.includes("sci") || t.includes("คอม") || t.includes("เทคโน")) {
    return "วิทยาศาสตร์และเทคโนโลยี";
  }
  if (t.includes("คณิต") || t.includes("เลข") || t.includes("math") || t.includes("พีชคณิต") || t.includes("เรขา")) {
    return "คณิตศาสตร์";
  }
  if (t.includes("ไทย") || t.includes("วรรณคดี") || t.includes("กาพย์") || t.includes("กลอน")) {
    return "ภาษาไทย";
  }
  if (t.includes("eng") || t.includes("อังกฤษ") || t.includes("ภาษาต่างประเทศ") || t.includes("chinese") || t.includes("จีน")) {
    return "ภาษาต่างประเทศ";
  }
  if (t.includes("สังคม") || t.includes("ประวัติศาสตร์") || t.includes("ภูมิศาสตร์") || t.includes("ธรรมะ") || t.includes("หน้าที่พลเมือง")) {
    return "สังคมศึกษา ศาสนาและวัฒนธรรม";
  }
  if (t.includes("สุขศึกษา") || t.includes("พลศึกษา") || t.includes("กีฬา") || t.includes("สุขภาพ") || t.includes("cpr")) {
    return "สุขศึกษาและพลศึกษา";
  }
  if (t.includes("ศิลปะ") || t.includes("ดนตรี") || t.includes("นาฏศิลป์") || t.includes("ทัศนศิลป์")) {
    return "ศิลปะ";
  }
  if (t.includes("การงาน") || t.includes("เกษตร") || t.includes("งานช่าง") || t.includes("ธุรกิจ")) {
    return "การงานอาชีพ";
  }
  return "วิทยาศาสตร์และเทคโนโลยี";
}

// Helper to deduce grade level
export function detectGradeFromTitle(title: string): string {
  const match = title.match(/ม\.([1-6])|ป\.([1-6])|grade\s*([0-9]+)/i);
  if (match) {
    if (match[1]) return `ม.${match[1]}`;
    if (match[2]) return `ป.${match[2]}`;
    if (match[3]) return `G.${match[3]}`;
  }
  return "ม.3";
}
