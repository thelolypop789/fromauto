import type { MindMap } from "./types";

// ภาค ก · ภาษาอังกฤษ: grammar, vocabulary (two maps), conversation and reading.
export const A2: MindMap[] = [
  {
    id: "a2-tense", group: "A2", topics: ["A2-GRAMMAR"], icon: "⏳",
    title: "Tense ที่ออกบ่อย", hub: "Tenses", hubSub: "ดูคำบอกเวลาก่อน",
    intro: "หาคำบอกเวลาในประโยคก่อน (yesterday, since, now ...) แล้วจะรู้ tense ทันที",
    branches: [
      {
        id: "simple", icon: "🔁", tone: "pink", title: "Present Simple", big: "V1 / V-s", must: true, ask: "ความจริง นิสัย กิจวัตร ใช้ tense อะไร",
        sub: "ความจริง นิสัย กิจวัตร",
        blocks: [
          { k: "list", items: [
            { icon: "🔑", t: "คำบอกเวลา: always, usually, often, every day, on Mondays" },
            { icon: "➕", t: "ประธานเอกพจน์ (he, she, it, ชื่อคนเดียว) เติม s/es", d: "She teaches English every day." },
          ] },
          { k: "oops", t: "ประโยคบอกความจริง เช่น The sun rises in the east. ใช้ Present Simple เสมอ" },
        ],
      },
      {
        id: "cont", icon: "🏃", tone: "mint", title: "Present Continuous", big: "is/am/are + Ving", ask: "กำลังทำอยู่ตอนนี้ ใช้รูปไหน",
        sub: "กำลังทำอยู่ตอนนี้",
        blocks: [
          { k: "list", items: [
            { icon: "🔑", t: "คำบอกเวลา: now, at the moment, Look!, Listen!" },
            { icon: "🚫", t: "กริยาบอกสภาพไม่ใช้ -ing", d: "know, like, love, want, believe, own: I know him. (ไม่ใช่ I am knowing)" },
          ] },
        ],
      },
      {
        id: "perfect", icon: "🔗", tone: "sky", title: "Present Perfect", big: "have/has + V3", hot: true, ask: "since / for / already / yet ใช้กับ tense อะไร",
        sub: "since · for · already · yet · just · ever",
        blocks: [
          { k: "pairs", items: [
            { a: "since + จุดเวลา", b: "since 2020, since Monday" },
            { a: "for + ช่วงเวลา", b: "for 3 years, for two weeks" },
          ] },
          { k: "example", q: "She ___ here since 2020.", steps: ["since + จุดเวลา → Present Perfect", "ประธาน She → has + V3"], a: "has worked" },
          { k: "oops", t: "มี yesterday, ago, last year อยู่ในประโยค ห้ามใช้ Present Perfect ต้องใช้ Past Simple" },
        ],
      },
      {
        id: "past", icon: "⏮️", tone: "lem", title: "Past Simple", big: "V2", must: true, ask: "yesterday / ago / last ... ใช้ tense อะไร",
        sub: "yesterday · ago · last week · in 2019",
        blocks: [
          { k: "example", q: "I ___ my old teacher two days ago.", steps: ["ago → เหตุการณ์จบแล้วในอดีต", "ใช้กริยาช่องที่ 2"], a: "met" },
        ],
      },
      {
        id: "pastcont", icon: "📞", tone: "lil", title: "Past Continuous + when", big: "was/were + Ving", ask: "เหตุการณ์ยาวในอดีตถูกขัดจังหวะ ใช้รูปไหน",
        sub: "เหตุการณ์ยาว ถูกเหตุการณ์สั้นขัดจังหวะ",
        blocks: [
          { k: "example", q: "I was cooking when the phone ___.", steps: ["เหตุการณ์ยาว (กำลังทำอาหาร) = was cooking", "เหตุการณ์สั้นที่แทรกเข้ามา = Past Simple"], a: "rang" },
          { k: "memo", t: "\"while + ยาว (Ving) · when + สั้น (V2)\"" },
        ],
      },
      {
        id: "future", icon: "🔮", tone: "pea", title: "อนาคต & if / when", big: "if + V1", hot: true, ask: "ประโยคหลัง if / when ที่พูดถึงอนาคต ใช้ will ได้ไหม",
        sub: "หลัง if / when ที่พูดถึงอนาคต ใช้ Present ไม่ใช้ will",
        blocks: [
          { k: "pairs", items: [
            { a: "will + V1", b: "ตัดสินใจทันที คาดเดา: I'll help you." },
            { a: "be going to + V1", b: "วางแผนไว้แล้ว มีหลักฐาน: It's going to rain." },
          ] },
          { k: "example", q: "I will call you when I ___ home.", steps: ["หลัง when (พูดถึงอนาคต) ใช้ Present Simple"], a: "get (ไม่ใช่ will get)" },
        ],
      },
    ],
  },
  {
    id: "a2-grammar", group: "A2", topics: ["A2-GRAMMAR"], icon: "🧩",
    title: "ไวยากรณ์ที่ออกบ่อย", hub: "Grammar", hubSub: "6 เรื่องที่ออกบ่อย",
    branches: [
      {
        id: "agree", icon: "🤝", tone: "pink", title: "ประธาน-กริยาสอดคล้อง", big: "each → เอกพจน์", hot: true, ask: "each / every ตามด้วยกริยารูปไหน",
        sub: "each, every, everyone ใช้กริยาเอกพจน์",
        blocks: [
          { k: "table", head: ["รูปแบบ", "กริยา"], rows: [
            ["Each / Every / Everyone", "เอกพจน์ (is, has, V-s)"],
            ["The number of + นามพหูพจน์", "เอกพจน์"],
            ["A number of + นามพหูพจน์", "พหูพจน์"],
            ["Neither A nor B / Either A or B", "ตามตัวที่อยู่ใกล้กริยา (B)"],
          ] },
          { k: "example", q: "Each of the students ___ a book.", steps: ["Each → เอกพจน์ (อย่าดูที่ students)"], a: "has" },
        ],
      },
      {
        id: "if", icon: "❓", tone: "mint", title: "If-clause", big: "4", unit: "แบบ", must: true, ask: "If-clause มีกี่แบบ",
        blocks: [
          { k: "table", head: ["แบบ", "If ...", "ประโยคหลัก"], rows: [
            ["0 ความจริง", "Present", "Present"],
            ["1 เป็นไปได้", "Present", "will + V1"],
            ["2 ไม่จริงตอนนี้", "Past (were)", "would + V1"],
            ["3 ไม่จริงในอดีต", "had + V3", "would have + V3"],
          ] },
          { k: "example", q: "If I ___ you, I would study harder.", steps: ["would + V1 → แบบที่ 2", "สมมติไม่จริง ใช้ were กับทุกประธาน"], a: "were" },
        ],
      },
      {
        id: "passive", icon: "🔄", tone: "sky", title: "Passive Voice", big: "be + V3", ask: "ประธานถูกกระทำ ใช้รูปไหน",
        sub: "ประธานเป็นผู้ถูกกระทำ",
        blocks: [
          { k: "example", q: "The report ___ by the teacher yesterday.", steps: ["รายงานถูกเขียน (ถูกกระทำ) → be + V3", "yesterday → was"], a: "was written" },
          { k: "memo", t: "เจอ by + ผู้กระทำ ให้นึกถึง Passive ก่อน" },
        ],
      },
      {
        id: "relative", icon: "🔗", tone: "lem", title: "Relative Pronoun", big: "who · which · whose", ask: "ใช้ who กับ which ต่างกันอย่างไร",
        blocks: [
          { k: "table", head: ["คำ", "ใช้กับ"], rows: [
            ["who", "คน (เป็นประธาน)"], ["whom", "คน (เป็นกรรม)"], ["which", "สัตว์ สิ่งของ"],
            ["whose", "แสดงความเป็นเจ้าของ + นาม"], ["that", "ได้ทั้งคน สิ่งของ แต่ใช้หลังจุลภาค (,) ไม่ได้"],
          ] },
          { k: "example", q: "The teacher ___ car is red is my friend.", steps: ["ตามด้วยคำนาม car และแสดงความเป็นเจ้าของ"], a: "whose" },
        ],
      },
      {
        id: "gerund", icon: "🎬", tone: "lil", title: "Ving หรือ to V", big: "enjoy + Ving", hot: true, ask: "enjoy / avoid / finish / mind ตามด้วยอะไร",
        blocks: [
          { k: "pairs", items: [
            { a: "+ Ving", b: "enjoy, avoid, finish, mind, keep, suggest, practise" },
            { a: "+ to V", b: "want, decide, plan, hope, agree, promise, refuse" },
          ] },
          { k: "pairs", items: [
            { a: "stop smoking", b: "เลิกสูบบุหรี่" },
            { a: "stop to smoke", b: "หยุด (สิ่งที่ทำอยู่) เพื่อไปสูบบุหรี่" },
          ] },
          { k: "memo", t: "\"เอนจอย อะวอยด์ ฟินิช มายด์\" ตามด้วย -ing" },
        ],
      },
      {
        id: "compare", icon: "📏", tone: "pea", title: "เปรียบเทียบ", big: "as ... as", ask: "เท่ากัน ใช้โครงสร้างอะไร",
        blocks: [
          { k: "table", head: ["แบบ", "รูป"], rows: [
            ["เท่ากัน", "as + adj + as"], ["ขั้นกว่า (สั้น)", "adj-er + than"], ["ขั้นกว่า (ยาว)", "more + adj + than"],
            ["ขั้นสูงสุด", "the + adj-est / the most + adj"], ["รูปพิเศษ", "good → better → best · bad → worse → worst"],
          ] },
        ],
      },
    ],
  },
  {
    id: "a2-vocab1", group: "A2", topics: ["A2-VOCAB"], icon: "🧱", free: true,
    title: "Vocabulary 1: รากคำ คำคล้าย คำตรงข้าม", hub: "Vocabulary", hubSub: "เดาความหมายจากส่วนประกอบคำ",
    branches: [
      {
        id: "prefix", icon: "⬅️", tone: "pink", title: "Prefix หน้าคำ", big: "un · dis · mis", must: true, ask: "prefix ที่แปลว่า \"ไม่ / ตรงข้าม\" มีอะไรบ้าง",
        sub: "เติมหน้าคำ เปลี่ยนความหมาย",
        blocks: [
          { k: "table", head: ["Prefix", "ความหมาย", "ตัวอย่าง"], rows: [
            ["un- in- im- il- ir- dis-", "ไม่ / ตรงข้าม", "unhappy, impossible, illegal, irregular, dislike"],
            ["re-", "อีกครั้ง", "rewrite, review"],
            ["pre-", "ก่อน", "preview, prepare"],
            ["mis-", "ผิด", "misunderstand, mistake"],
            ["over- / under-", "มากเกิน / น้อยเกิน", "overwork, underpaid"],
          ] },
        ],
      },
      {
        id: "suffix", icon: "➡️", tone: "mint", title: "Suffix ท้ายคำ", big: "-tion = นาม", hot: true, ask: "คำลงท้าย -tion, -ment, -ness เป็นคำชนิดไหน",
        sub: "ท้ายคำบอกชนิดของคำ ช่วยเลือกคำเติมช่องว่าง",
        blocks: [
          { k: "table", head: ["ชนิดคำ", "ท้ายคำ"], rows: [
            ["คำนาม", "-tion, -ment, -ness, -ity, -ance, -er/-or"],
            ["คุณศัพท์", "-ful, -less, -ous, -able, -ive, -al"],
            ["กริยาวิเศษณ์", "-ly"],
            ["กริยา", "-ize, -en, -ify"],
          ] },
          { k: "example", q: "Her ___ to the school is admirable. (dedicate)", steps: ["หลัง Her ต้องเป็นคำนาม", "dedicate → dedication"], a: "dedication" },
        ],
      },
      {
        id: "confuse", icon: "🤯", tone: "sky", title: "คำที่หน้าตาคล้ายกัน", big: "affect / effect", hot: true, ask: "affect กับ effect ต่างกันอย่างไร",
        sub: "affect = กริยา · effect = คำนาม",
        blocks: [
          { k: "words", items: [
            { w: "affect (v.)", m: "ส่งผลต่อ", ex: "Stress affects learning." }, { w: "effect (n.)", m: "ผลกระทบ", ex: "a positive effect" },
            { w: "accept", m: "ยอมรับ" }, { w: "except", m: "ยกเว้น" },
            { w: "advice (n.)", m: "คำแนะนำ" }, { w: "advise (v.)", m: "แนะนำ" },
            { w: "borrow", m: "ยืม (จากคนอื่น)" }, { w: "lend", m: "ให้ยืม" },
            { w: "principal", m: "ครูใหญ่ / หลัก" }, { w: "principle", m: "หลักการ" },
            { w: "economic", m: "เกี่ยวกับเศรษฐกิจ" }, { w: "economical", m: "ประหยัด" },
            { w: "sensible", m: "มีเหตุผล" }, { w: "sensitive", m: "อ่อนไหว" },
          ] },
        ],
      },
      {
        id: "syn", icon: "🟰", tone: "lem", title: "คำความหมายเหมือน", big: "big = huge", ask: "\"huge\" ความหมายใกล้กับคำใด",
        blocks: [
          { k: "words", items: [
            { w: "huge", m: "= enormous, big" }, { w: "tiny", m: "= small, little" }, { w: "begin", m: "= start, commence" },
            { w: "finish", m: "= complete, end" }, { w: "help", m: "= assist, support" }, { w: "show", m: "= display, demonstrate" },
            { w: "important", m: "= significant, essential" }, { w: "difficult", m: "= hard, challenging" }, { w: "improve", m: "= enhance, develop" },
          ] },
        ],
      },
      {
        id: "ant", icon: "↔️", tone: "lil", title: "คำความหมายตรงข้าม", big: "increase ↔ decrease", ask: "คำตรงข้ามของ increase",
        blocks: [
          { k: "words", items: [
            { w: "increase", m: "↔ decrease, reduce" }, { w: "ancient", m: "↔ modern" }, { w: "accept", m: "↔ refuse, reject" },
            { w: "permanent", m: "↔ temporary" }, { w: "generous", m: "↔ selfish, mean" }, { w: "expensive", m: "↔ cheap" },
            { w: "polite", m: "↔ rude" }, { w: "strengthen", m: "↔ weaken" }, { w: "punctual", m: "↔ late" },
          ] },
        ],
      },
      {
        id: "family", icon: "👪", tone: "pea", title: "ตระกูลคำ", big: "เลือกชนิดคำ", ask: "เติมคำในช่องว่าง ดูอะไรก่อน",
        sub: "ดูตำแหน่งในประโยค แล้วเลือกรูปคำให้ตรงชนิด",
        blocks: [
          { k: "table", head: ["กริยา", "นาม", "คุณศัพท์", "วิเศษณ์"], rows: [
            ["succeed", "success", "successful", "successfully"],
            ["create", "creation / creativity", "creative", "creatively"],
            ["decide", "decision", "decisive", "decisively"],
            ["educate", "education", "educational", "educationally"],
          ] },
          { k: "memo", t: "หลัง a/an/the/his = นาม · หน้าคำนาม = คุณศัพท์ · ขยายกริยา = วิเศษณ์ (-ly)" },
        ],
      },
    ],
  },
  {
    id: "a2-vocab2", group: "A2", topics: ["A2-VOCAB"], icon: "🎒",
    title: "Vocabulary 2: คำศัพท์ครู งาน และวลี", hub: "Vocabulary 2", hubSub: "คำที่เจอในข้อสอบครู",
    branches: [
      {
        id: "school", icon: "🏫", tone: "pink", title: "คำศัพท์การศึกษา", big: "curriculum", unit: "= หลักสูตร", must: true, ask: "\"หลักสูตร\" ภาษาอังกฤษคือ",
        blocks: [
          { k: "words", items: [
            { w: "curriculum", m: "หลักสูตร" }, { w: "syllabus", m: "เค้าโครงรายวิชา" }, { w: "lesson plan", m: "แผนการสอน" },
            { w: "assessment", m: "การประเมิน" }, { w: "evaluation", m: "การประเมินผล" }, { w: "objective", m: "จุดประสงค์" },
            { w: "achievement", m: "ผลสัมฤทธิ์" }, { w: "attendance", m: "การเข้าเรียน" }, { w: "enrollment", m: "การลงทะเบียนเรียน" },
            { w: "scholarship", m: "ทุนการศึกษา" }, { w: "learner-centered", m: "ผู้เรียนเป็นสำคัญ" }, { w: "principal", m: "ผู้อำนวยการโรงเรียน" },
          ] },
        ],
      },
      {
        id: "work", icon: "💼", tone: "mint", title: "คำศัพท์งานราชการ", big: "applicant", unit: "= ผู้สมัคร", ask: "\"ผู้สมัคร\" ภาษาอังกฤษคือ",
        blocks: [
          { k: "words", items: [
            { w: "applicant", m: "ผู้สมัคร" }, { w: "application form", m: "ใบสมัคร" }, { w: "qualification", m: "คุณสมบัติ วุฒิ" },
            { w: "deadline", m: "กำหนดส่ง วันสุดท้าย" }, { w: "appointment", m: "การนัดหมาย การแต่งตั้ง" }, { w: "civil servant", m: "ข้าราชการ" },
            { w: "colleague", m: "เพื่อนร่วมงาน" }, { w: "responsibility", m: "ความรับผิดชอบ" }, { w: "regulation", m: "ระเบียบ ข้อบังคับ" },
          ] },
        ],
      },
      {
        id: "phrasal", icon: "🧷", tone: "sky", title: "Phrasal Verbs", big: "look after", unit: "= ดูแล", hot: true, ask: "\"look after\" แปลว่า",
        blocks: [
          { k: "words", items: [
            { w: "look after", m: "ดูแล" }, { w: "look for", m: "มองหา" }, { w: "look forward to + Ving", m: "ตั้งตารอ" },
            { w: "give up", m: "เลิก ยอมแพ้" }, { w: "put off", m: "เลื่อนออกไป" }, { w: "carry out", m: "ดำเนินการ" },
            { w: "turn down", m: "ปฏิเสธ / หรี่เสียง" }, { w: "find out", m: "ค้นพบ หาคำตอบ" }, { w: "take part in", m: "เข้าร่วม" },
            { w: "get along with", m: "เข้ากันได้ดี" }, { w: "come across", m: "พบโดยบังเอิญ" }, { w: "hand in", m: "ส่ง (งาน)" },
          ] },
          { k: "oops", t: "look forward to + Ving เช่น I look forward to hearing from you. (to ในวลีนี้ไม่ใช่ to V)" },
        ],
      },
      {
        id: "colloc", icon: "🧲", tone: "lem", title: "คำที่ใช้คู่กัน", big: "make a decision", ask: "\"ตัดสินใจ\" ใช้ make หรือ do",
        blocks: [
          { k: "pairs", items: [
            { a: "make", b: "a decision, a mistake, progress, an effort, a plan" },
            { a: "do", b: "homework, research, your best, a favour, exercise" },
            { a: "take", b: "an exam, a break, notes, part in, care of" },
            { a: "pay", b: "attention, a visit, a compliment" },
          ] },
        ],
      },
      {
        id: "linker", icon: "🔗", tone: "lil", title: "คำเชื่อม", big: "despite + นาม", hot: true, ask: "despite / although อันไหนตามด้วยประโยค",
        sub: "although + ประโยค · despite / in spite of + คำนาม",
        blocks: [
          { k: "table", head: ["ความหมาย", "คำเชื่อม"], rows: [
            ["แม้ว่า", "although + ประโยค · despite / in spite of + นาม/Ving"],
            ["แต่ อย่างไรก็ตาม", "but, however (ใช้ ; however, หรือขึ้นประโยคใหม่)"],
            ["ดังนั้น", "so, therefore, as a result"],
            ["นอกจากนี้", "moreover, furthermore, in addition"],
            ["เพราะ", "because + ประโยค · because of + นาม"],
          ] },
          { k: "example", q: "___ the heavy rain, the students came to school.", steps: ["ตามด้วยคำนาม (the heavy rain) ไม่ใช่ประโยค"], a: "Despite" },
        ],
      },
      {
        id: "idiom", icon: "🎈", tone: "pea", title: "สำนวนยอดฮิต", big: "piece of cake", unit: "= ง่ายมาก", ask: "\"a piece of cake\" แปลว่า",
        blocks: [
          { k: "words", items: [
            { w: "a piece of cake", m: "ง่ายมาก" }, { w: "break the ice", m: "ทำให้บรรยากาศหายเกร็ง" }, { w: "under the weather", m: "ไม่ค่อยสบาย" },
            { w: "once in a blue moon", m: "นาน ๆ ครั้ง" }, { w: "hit the books", m: "ตั้งใจอ่านหนังสือ" }, { w: "on cloud nine", m: "มีความสุขมาก" },
          ] },
        ],
      },
    ],
  },
  {
    id: "a2-conv", group: "A2", topics: ["A2-CONV"], icon: "💬",
    title: "บทสนทนา (Conversation)", hub: "Conversation", hubSub: "เลือกคำตอบให้เข้ากับสถานการณ์",
    branches: [
      {
        id: "greet", icon: "👋", tone: "pink", title: "ทักทาย", big: "How do you do?", unit: "→ How do you do?", must: true, ask: "ตอบ \"How do you do?\" อย่างไร",
        sub: "พบกันครั้งแรก ตอบด้วยประโยคเดิม",
        blocks: [
          { k: "table", head: ["พูดว่า", "ตอบว่า"], rows: [
            ["How do you do?", "How do you do."],
            ["How are you?", "Fine, thank you. And you?"],
            ["Nice to meet you.", "Nice to meet you, too."],
            ["What do you do?", "I'm a teacher. (ถามอาชีพ)"],
          ] },
          { k: "oops", t: "What do you do? ถามอาชีพ ไม่ได้ถามว่ากำลังทำอะไรอยู่" },
        ],
      },
      {
        id: "thanks", icon: "🙏", tone: "mint", title: "ขอบคุณ / ขอโทษ", big: "You're welcome.", ask: "ตอบ \"Thank you\" อย่างไร",
        blocks: [
          { k: "pairs", items: [
            { a: "Thank you.", b: "You're welcome. / My pleasure. / Not at all." },
            { a: "I'm sorry.", b: "That's all right. / Never mind. / No problem." },
          ] },
        ],
      },
      {
        id: "mind", icon: "🙋", tone: "sky", title: "Would you mind ...?", big: "No = ยินดี", hot: true, ask: "ตอบ \"Would you mind ...?\" ว่า No แปลว่าอะไร",
        sub: "ตอบ No, not at all. = ไม่รังเกียจ ยินดีช่วย",
        blocks: [
          { k: "pairs", items: [
            { a: "Would you mind opening the window?", b: "No, not at all. / Of course not. = ได้เลย" },
            { a: "Could you / Can I ...?", b: "Sure. / Go ahead. / Certainly." },
          ] },
          { k: "oops", t: "ตอบ Would you mind ...? ด้วย Yes แปลว่ารังเกียจ ไม่ยอมทำ ข้อสอบชอบหลอกตรงนี้" },
        ],
      },
      {
        id: "offer", icon: "🎁", tone: "lem", title: "เสนอ / ชวน", big: "I'd love to.", ask: "ตอบรับคำชวนอย่างสุภาพว่าอย่างไร",
        blocks: [
          { k: "table", head: ["พูดว่า", "ตอบรับ", "ปฏิเสธ"], rows: [
            ["Would you like some tea?", "Yes, please.", "No, thank you."],
            ["Would you like to join us?", "I'd love to.", "I'm afraid I can't."],
            ["Shall we go now?", "Sure, let's go.", "Let's wait a bit."],
          ] },
        ],
      },
      {
        id: "opinion", icon: "💭", tone: "lil", title: "เห็นด้วย / ไม่เห็นด้วย", big: "I couldn't agree more.", ask: "\"I couldn't agree more\" แปลว่าอะไร",
        sub: "= เห็นด้วยอย่างยิ่ง",
        blocks: [
          { k: "pairs", items: [
            { a: "เห็นด้วย", b: "I couldn't agree more. / Absolutely. / That's true." },
            { a: "ไม่เห็นด้วย (สุภาพ)", b: "I'm not sure about that. / I see your point, but ..." },
          ] },
          { k: "oops", t: "I couldn't agree more มีคำว่า couldn't แต่แปลว่า \"เห็นด้วยที่สุด\"" },
        ],
      },
      {
        id: "phone", icon: "☎️", tone: "pea", title: "โทรศัพท์ / ถามทาง", big: "Hold on, please.", ask: "\"กรุณารอสักครู่\" ทางโทรศัพท์พูดว่าอย่างไร",
        blocks: [
          { k: "words", items: [
            { w: "Hold on, please.", m: "กรุณารอสักครู่" }, { w: "Who's calling, please?", m: "ใครพูดสายคะ/ครับ" },
            { w: "May I take a message?", m: "ฝากข้อความไหม" }, { w: "Go straight on.", m: "ตรงไป" },
            { w: "Turn left / right.", m: "เลี้ยวซ้าย / ขวา" }, { w: "It's opposite the bank.", m: "อยู่ตรงข้ามธนาคาร" },
          ] },
        ],
      },
    ],
  },
  {
    id: "a2-read", group: "A2", topics: ["A2-READING"], icon: "📰",
    title: "การอ่าน (Reading)", hub: "Reading", hubSub: "อ่านคำถามก่อนอ่านเรื่อง",
    intro: "อ่านคำถามก่อน แล้วค่อยกลับไปหาคำตอบในบทความ ประหยัดเวลามาก",
    branches: [
      {
        id: "main", icon: "🎯", tone: "pink", title: "Main idea / Title", big: "คลุมทั้งเรื่อง", must: true, ask: "ตัวเลือกที่เป็น main idea ต้องมีลักษณะอย่างไร",
        sub: "ไม่แคบเกิน (แค่รายละเอียด) ไม่กว้างเกิน",
        blocks: [
          { k: "list", items: [
            { icon: "🔍", t: "ดูประโยคแรกของแต่ละย่อหน้า และย่อหน้าสุดท้าย" },
            { icon: "❌", t: "ตัดตัวเลือกที่พูดถึงแค่ย่อหน้าเดียว (แคบเกิน)" },
            { icon: "❌", t: "ตัดตัวเลือกที่กว้างกว่าเรื่องที่อ่าน" },
          ] },
        ],
      },
      {
        id: "scan", icon: "🔦", tone: "mint", title: "Skim vs Scan", big: "Scan = หาเจาะจง", ask: "หาตัวเลข ชื่อ วันที่ ในบทความ ใช้วิธีไหน",
        blocks: [
          { k: "pairs", items: [
            { a: "Skimming", b: "อ่านผ่านเร็ว ๆ เพื่อจับภาพรวม ใช้กับ main idea" },
            { a: "Scanning", b: "กวาดตาหาคำเจาะจง ตัวเลข ชื่อ วันที่ ใช้กับคำถามรายละเอียด" },
          ] },
        ],
      },
      {
        id: "refer", icon: "👉", tone: "sky", title: "คำอ้างถึง (it, they, this)", big: "ย้อนไปข้างหน้า", hot: true, ask: "\"it\" ในบทความ อ้างถึงคำที่อยู่ตรงไหน",
        sub: "หาคำนามที่อยู่ก่อนหน้า และพจน์ตรงกัน",
        blocks: [
          { k: "list", items: [
            { icon: "1️⃣", t: "it / this = เอกพจน์ · they / these = พหูพจน์" },
            { icon: "2️⃣", t: "ย้อนไปหาคำนามที่อยู่ใกล้ที่สุดก่อนหน้า" },
            { icon: "3️⃣", t: "แทนคำนั้นลงในประโยค ถ้าความหมายลงตัว คือคำตอบ" },
          ] },
        ],
      },
      {
        id: "context", icon: "🧩", tone: "lem", title: "เดาศัพท์จากบริบท", big: "ดูคำรอบ ๆ", ask: "เจอคำศัพท์ไม่รู้จัก ทำอย่างไร",
        blocks: [
          { k: "list", items: [
            { icon: "🔗", t: "คำอธิบายตามหลัง: that is, or, which means" },
            { icon: "↔️", t: "คำบอกความขัดแย้ง: but, however, unlike → ความหมายตรงข้าม" },
            { icon: "🧱", t: "แยกรากคำ prefix / suffix (ดูแผนผัง Vocabulary 1)" },
          ] },
        ],
      },
      {
        id: "infer", icon: "🕵️", tone: "lil", title: "อนุมาน (infer / imply)", big: "ไม่ได้เขียนตรง ๆ", hot: true, ask: "คำถาม infer / imply ต้องการคำตอบแบบไหน",
        sub: "แต่ต้องมีหลักฐานในบทความรองรับ",
        blocks: [
          { k: "oops", t: "ตัวเลือกที่ \"จริงในชีวิตจริง\" แต่บทความไม่ได้บอก ไม่ใช่คำตอบ ต้องอ้างจากเนื้อเรื่องเท่านั้น" },
        ],
      },
      {
        id: "tf", icon: "✅", tone: "pea", title: "จริง / ไม่จริง / ไม่ได้กล่าวถึง", big: "Not mentioned", ask: "ข้อมูลที่บทความไม่ได้พูดถึง ตอบว่าอะไร",
        blocks: [
          { k: "list", items: [
            { icon: "⚠️", t: "ระวังคำเด็ดขาด all, always, never ในตัวเลือก มักผิด" },
            { icon: "🔎", t: "ตัวเลือกที่ถอดความ (paraphrase) จากบทความ มักเป็นคำตอบที่ถูก" },
          ] },
        ],
      },
    ],
  },
];
