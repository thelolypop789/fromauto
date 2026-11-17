"""วิชาเอกภาษาอังกฤษ (B3-ENG) เติม 65 ข้อ (17 พ.ย. 2569; ตัดที่ซ้ำคลังเดิม 1) — 236 → 301 ตามสัดส่วน docs/prep-major-blueprint.md

ลงหมวดที่บาง: Language Functions +18 (เดิม 0) · Reading +12 (บทอ่านเขียนใหม่ 6 เรื่อง เรื่องละ 2 ข้อ) · CEFR/วัดผล +10
Language & Culture +8 (เดิม 0) · วิธีสอน +6 · Clauses +4 · Tenses +4 · Reported speech +4 (Parts of speech/Vocab เกินเป้าแล้ว)
โจทย์ภาษาอังกฤษ คำอธิบายภาษาไทย · python3 scripts/prep/major_eng_bank_2026_11.py → content/prep/bank-major-eng-2026-11.json
"""
from pathlib import Path

from bankkit import Bank

ROOT = Path(__file__).resolve().parents[2]
T = "B3-ENG"
b = Bank(seed=2611182)
FUNC, READ, CEFR, CULT, METH, CLAUSE, TENSE, SPEECH = (
    "B3-ENG-FUNC", "B3-ENG-READ", "B3-ENG-PED-CEFR", "B3-ENG-CULT", "B3-ENG-PED-METH", "B3-ENG-CLAUSE",
    "B3-ENG-TENSE", "B3-ENG-SPEECH")
R = "Read the passage and answer the question. "

# ---------- Language Functions / Conversation (18) ----------
b.add(T, "understand", "A: Would you mind if I opened the window? It's quite hot in here.\nB: ______",
      "Not at all. Go ahead.", ["Yes, of course. Go ahead.", "Yes, I would. Open it, please.", "No, I don't mind it at all, sorry."],
      "Would you mind if I...? แปลตรงตัวว่า 'คุณจะรังเกียจไหม' ถ้าอนุญาตต้องตอบปฏิเสธ เช่น Not at all. / No, go ahead. "
      "การตอบ Yes หมายถึงรังเกียจ จึงขัดกับ Go ahead ที่ตามมา", sub=FUNC)
b.add(T, "understand", "A: Can I give you a hand with those heavy boxes?\nB: ______",
      "That's very kind of you. Thanks.", ["Yes, I can give you a hand too.", "No, my hands are very clean.", "You're welcome. Any time."],
      "give someone a hand = ช่วยเหลือ การตอบรับข้อเสนอความช่วยเหลือใช้ That's very kind of you / Thanks, that would be great "
      "You're welcome ใช้ตอบเมื่อผู้อื่นขอบคุณเรา ไม่ใช่ตอบรับความช่วยเหลือ", sub=FUNC)
b.add(T, "understand", "A: I'm so sorry I'm late. The traffic was terrible.\nB: ______",
      "Don't worry. We've only just started.", ["You're welcome. It's my pleasure.", "Yes, you are very late, aren't you?", "Thank you for your traffic today."],
      "การตอบรับคำขอโทษอย่างสุภาพใช้ Don't worry. / That's all right. / No problem. "
      "You're welcome ใช้ตอบคำขอบคุณ ส่วนการย้ำว่ามาสายมากเป็นการตอบที่ไม่สุภาพ", sub=FUNC)
b.add(T, "apply", "In a staff meeting, a colleague suggests giving Grade 1 students a 30-minute grammar test every day. Which response disagrees politely?",
      "I see your point, but I'm not sure that would suit such young learners.", ["That's the worst idea I've ever heard in this school.",
                                                                              "You are wrong, and everyone here knows it.", "Whatever. Do what you want with your class."],
      "การแสดงความไม่เห็นด้วยอย่างสุภาพมักเริ่มจากยอมรับความเห็นอีกฝ่าย (I see your point / I understand what you mean) "
      "แล้วใช้คำที่ลดความแรง (I'm not sure... / I wonder if...) ตัวเลือกอื่นตรงและแรงเกินไปสำหรับที่ประชุม", sub=FUNC)
b.add(T, "understand", "A teacher gives instructions too quickly for a student. What is the most appropriate thing for the student to say?",
      "Sorry, could you say that again more slowly, please?", ["What? I don't care about the instructions.", "You speak very badly, teacher.",
                                                             "Stop talking and give me the answer now."],
      "การขอให้พูดซ้ำหรือขอคำอธิบาย (asking for clarification) ใช้ Sorry, could you repeat that? / Could you say that again more slowly? "
      "เป็นสำนวนที่ครูควรสอนให้นักเรียนใช้สื่อสารเมื่อฟังไม่ทัน", sub=FUNC)
b.add(T, "understand", "A: I'm bored. There's nothing to do this weekend.\nB: ______",
      "Why don't we go to the night market on Saturday?", ["Because we don't go to the night market.", "Yes, I went to the night market last week.",
                                                         "How about you were bored last weekend?"],
      "Why don't we...? / How about + V-ing...? / Let's... เป็นการเสนอแนะ (making suggestions) "
      "ตัวเลือก How about you were... ผิดโครงสร้าง ต้องตามด้วย V-ing หรือคำนาม", sub=FUNC)
b.add(T, "apply", "At a restaurant, a customer finds an extra item on the bill. Which is the most polite way to complain?",
      "Excuse me, I think there may be a mistake on our bill.", ["Hey! You cheated me on this bill!", "This bill is wrong. Fix it now.",
                                                               "I'm not paying anything until you apologise."],
      "การร้องเรียนอย่างสุภาพเริ่มด้วย Excuse me และใช้คำที่ไม่กล่าวหา เช่น I think there may be a mistake... "
      "ภาษาที่อ่อนโยน (hedging) ช่วยให้แก้ปัญหาได้ราบรื่นกว่าการกล่าวหาตรง ๆ", sub=FUNC)
b.add(T, "understand", "Caller: Hello. Could I speak to Ms. Malee, please?\nReceptionist: ______",
      "I'm afraid she's not in at the moment. Can I take a message?", ["No, you can't. She is not here. Goodbye.", "Yes, I'm speaking to Ms. Malee now.",
                                                                     "Please hold. I'm afraid that I can speak."],
      "ภาษาโทรศัพท์ที่สุภาพ: I'm afraid she's not available. / Can I take a message? / Would you like to leave a message? "
      "I'm afraid... ใช้บอกข่าวที่ไม่น่ายินดีอย่างนุ่มนวล", sub=FUNC)
b.add(T, "understand", "A: I heard you passed the teacher exam. Congratulations!\nB: ______",
      "Thank you so much! I'm really relieved.", ["Don't mention it. It was nothing at all.", "I'm sorry to hear that. It's terrible news.",
                                                 "Congratulations to you too on your exam!"],
      "การตอบรับคำแสดงความยินดีใช้ Thank you (so much)! และอาจบอกความรู้สึกต่อ Don't mention it ใช้ตอบคำขอบคุณ "
      "ส่วน I'm sorry to hear that ใช้แสดงความเห็นใจเมื่อได้ยินข่าวร้าย", sub=FUNC)
b.add(T, "understand", "A: We're having a small party at my place on Saturday. Would you like to come?\nB: ______ (B cannot go.)",
      "I'd love to, but I've already made plans for Saturday.", ["No, I would not like your party.", "Yes, I'd love to come. See you then!",
                                                               "I don't come to parties on any days."],
      "การปฏิเสธคำเชิญอย่างสุภาพใช้ I'd love to, but... / I'm afraid I can't... พร้อมเหตุผลสั้น ๆ "
      "การปฏิเสธตรง ๆ ว่าไม่อยากไปถือว่าไม่สุภาพ", sub=FUNC)
b.add(T, "understand", "A: My grandmother passed away last week.\nB: ______",
      "I'm so sorry to hear that. Let me know if I can help.", ["Congratulations! That's wonderful news.", "Never mind. It doesn't matter at all.",
                                                              "That's OK. Don't worry about it."],
      "การแสดงความเสียใจ (expressing sympathy) ใช้ I'm so sorry to hear that / I'm sorry for your loss "
      "Never mind และ That's OK ใช้กับเรื่องเล็กน้อย ไม่เหมาะกับข่าวการเสียชีวิต", sub=FUNC)
b.add(T, "analyze", "After explaining a group task, which question best checks whether students really understood the instructions?",
      "So, what do you have to do first?", ["Do you understand?", "Is everything clear?", "Any questions? No? Good."],
      "คำถาม Do you understand? มักได้คำตอบ Yes แม้นักเรียนยังไม่เข้าใจ ครูภาษาจึงใช้ instruction-checking questions "
      "ที่ให้นักเรียนบอกสิ่งที่ต้องทำจริง เช่น What do you do first? / How many minutes do you have? ทำให้ตรวจความเข้าใจได้จริง", sub=FUNC)
b.add(T, "understand", "A student needs to leave class early for a doctor's appointment. Which is the most appropriate request to the teacher?",
      "Excuse me, may I leave a little early today? I have a doctor's appointment.", ["I'm going now. I have a doctor's appointment.",
                                                                                    "Leave me early today, teacher, because the doctor.",
                                                                                    "You must let me go home early today, OK?"],
      "การขออนุญาตอย่างสุภาพใช้ May I...? / Could I...? พร้อมให้เหตุผล การบอกว่าจะไปเลยหรือใช้ must เป็นการไม่ขออนุญาต", sub=FUNC)
b.add(T, "apply", "A: I don't really enjoy horror films.\nB: ______ They give me nightmares.",
      "Neither do I.", ["So do I.", "Me too do.", "Neither I don't."],
      "การเห็นด้วยกับประโยคปฏิเสธใช้ Neither do I. หรือ Me neither. ส่วน So do I. / Me too. ใช้กับประโยคบอกเล่า "
      "Neither ตามด้วยกริยาช่วยรูปบอกเล่าแล้วจึงเป็นประธาน (Neither + aux + subject)", sub=FUNC)
b.add(T, "understand", "A: I can't sleep well because I drink coffee every evening.\nB: ______",
      "If I were you, I'd switch to decaf after lunch.", ["If I am you, I will drink more coffee.", "If I were you, I drank decaf after lunch.",
                                                         "If you were me, you sleep better."],
      "การให้คำแนะนำใช้ If I were you, I'd (would) + V1 เป็นเงื่อนไขแบบที่ 2 (สมมติไม่จริงในปัจจุบัน) ใช้ were กับทุกประธาน "
      "ส่วนผลต้องเป็น would + V1 ไม่ใช่กริยาช่องที่ 2", sub=FUNC)
b.add(T, "understand", "A: Thank you so much for helping me with my lesson plan.\nB: ______",
      "My pleasure. Good luck with your class.", ["I'm sorry. It was my fault.", "Same to you, and thank you too.", "Yes, you should thank me more often."],
      "การตอบคำขอบคุณใช้ You're welcome. / My pleasure. / No problem. / Don't mention it. "
      "I'm sorry ใช้ขอโทษ ส่วน Same to you ใช้ตอบคำอวยพร เช่น Have a nice weekend!", sub=FUNC)
b.add(T, "analyze", "A: How come you're so tired today?\nB: I stayed up late marking exam papers.\nWhat does 'How come' mean in A's question?",
      "Why", ["How", "When", "How often"],
      "How come...? เป็นสำนวนในภาษาพูดแปลว่า Why...? แต่โครงสร้างหลัง How come ไม่ต้องสลับกริยาช่วยกับประธาน "
      "เช่น How come you're tired? (ไม่ใช่ How come are you tired?) คำตอบของ B จึงเป็นเหตุผล", sub=FUNC)
b.add(T, "apply", "A tourist asks, 'Excuse me, how do I get to the post office?' Which answer gives clear directions?",
      "Go straight ahead and take the second turning on the left.", ["The post office is a very old building.", "You can send letters at the post office.",
                                                                    "It opens at 8.30 and closes at 4.30."],
      "การบอกทาง (giving directions) ใช้ประโยคคำสั่งพร้อมจุดสังเกต เช่น Go straight ahead / Turn right at the traffic lights / "
      "Take the second turning on the left / It's next to the bank ตัวเลือกอื่นให้ข้อมูลที่ไม่ได้ตอบคำถามเรื่องเส้นทาง", sub=FUNC)

# ---------- Reading (12: 6 passages × 2) ----------
P1 = (R + "Last year, Ban Nong Khai School turned an empty corner of its playground into a vegetable garden. Students in each class "
      "take turns to water the plants before lessons, and they sell the vegetables to teachers every Friday. The money pays for new seeds. "
      "Teachers say the project has done more than produce vegetables: students who used to arrive late now come early because they do not want their plants to die.")
b.add(T, "understand", "What is the main idea of the passage?", "A school garden project has had benefits beyond growing food.",
      ["The school sells vegetables to make a large profit.", "Students should not arrive late for their lessons.", "Teachers prefer to buy vegetables from the market."],
      "ใจความหลักคือโครงการแปลงผักให้ผลมากกว่าการได้ผัก (has done more than produce vegetables) โดยเฉพาะเรื่องความรับผิดชอบ "
      "เงินที่ขายได้ใช้ซื้อเมล็ดพันธุ์ ไม่ใช่กำไรมาก และเรื่องมาสายเป็นรายละเอียดสนับสนุน", stim=P1, sub=READ)
b.add(T, "analyze", "Why do some students now arrive at school early?", "They feel responsible for keeping their plants alive.",
      ["Teachers give them extra marks for arriving early.", "They have to sell vegetables before lessons.", "The school changed its opening time last year."],
      "บทอ่านบอกว่า they do not want their plants to die แสดงว่านักเรียนรู้สึกรับผิดชอบต่อต้นไม้ที่ต้องรดน้ำก่อนเรียน "
      "การขายผักทำวันศุกร์ ไม่ใช่ก่อนเรียนทุกวัน และไม่มีข้อมูลเรื่องคะแนนหรือเวลาเปิดโรงเรียน", stim=P1, sub=READ)
P2 = (R + "Notice to all parents: From 1 December, the school gate will close at 7.50 a.m. instead of 8.00 a.m. so that morning assembly "
      "can start on time. Students who arrive after the gate closes must sign in at the office. Parents who drop off children by car "
      "are asked to use the back entrance on Soi 3 to reduce traffic in front of the school.")
b.add(T, "understand", "What is the main purpose of this notice?", "To inform parents about changes to morning arrival arrangements",
      ["To invite parents to attend the morning assembly", "To complain about parents who drive too fast", "To announce that the school will close in December"],
      "ประกาศแจ้งเวลาปิดประตูที่เปลี่ยน การลงชื่อเมื่อมาสาย และทางเข้าสำหรับรถผู้ปกครอง จุดประสงค์จึงเป็นการแจ้งการเปลี่ยนแปลงช่วงเช้า "
      "โรงเรียนไม่ได้ปิด และไม่มีการเชิญผู้ปกครองเข้าร่วมกิจกรรมหน้าเสาธง", stim=P2, sub=READ)
b.add(T, "apply", "A student arrives at 7.55 a.m. on 3 December. According to the notice, what must the student do?",
      "Sign in at the school office", ["Wait at the gate until 8.00 a.m.", "Go home and come back tomorrow", "Enter through the back gate on Soi 3"],
      "ตั้งแต่ 1 ธันวาคม ประตูปิด 7.50 น. นักเรียนที่มาถึง 7.55 น. จึงมาหลังประตูปิด ต้องลงชื่อที่ห้องธุรการ (must sign in at the office) "
      "ทางเข้าซอย 3 มีไว้สำหรับผู้ปกครองที่ขับรถมาส่ง ไม่ใช่ทางสำหรับนักเรียนที่มาสาย", stim=P2, sub=READ)
P3 = (R + "Microplastics are pieces of plastic smaller than five millimetres. Some are made small on purpose, such as the tiny beads once used in face scrubs, "
      "while most come from larger items that slowly break apart in sunlight and sea water. Scientists have found them in fish, salt and even drinking water. "
      "Although their effects on human health are still being studied, many countries have already banned plastic microbeads in cosmetics.")
b.add(T, "understand", "According to the passage, where do most microplastics come from?", "Larger plastic items that gradually break down",
      ["Tiny beads added to face scrubs", "Fish that eat plastic in the sea", "Factories that make drinking water"],
      "บทอ่านระบุว่า most come from larger items that slowly break apart in sunlight and sea water ส่วนเม็ดบีดในสครับเป็นแหล่งส่วนน้อย "
      "(Some are made small on purpose) ปลาและน้ำดื่มเป็นที่ที่พบไมโครพลาสติก ไม่ใช่แหล่งกำเนิด", stim=P3, sub=READ)
b.add(T, "analyze", "Which statement can be inferred from the passage?", "Some governments acted before the health effects were fully known.",
      ["Scientists have proved that microplastics cause cancer.", "Microplastics are larger than five centimetres.", "Microbeads are still allowed in all cosmetics worldwide."],
      "ผลต่อสุขภาพยัง 'are still being studied' แต่หลายประเทศ 'have already banned' แล้ว แสดงว่ารัฐบาลบางแห่งออกมาตรการก่อนจะรู้ผลชัดเจน "
      "ไม่มีข้อความว่าพิสูจน์แล้วว่าก่อมะเร็ง และไมโครพลาสติกเล็กกว่า 5 มิลลิเมตร ไม่ใช่เซนติเมตร", stim=P3, sub=READ)
P4 = (R + "Dear Khun Somsri, Thank you for agreeing to speak to our Grade 9 students about your work as a nurse. As we discussed, the talk will be "
      "on Friday 12 January in the school hall from 10.00 to 11.00 a.m. The students have prepared some questions, and they are especially keen to hear "
      "how you deal with stress. Please let me know if you need a projector. Best regards, Arun (English teacher)")
b.add(T, "understand", "What is the main purpose of Arun's email?", "To confirm the details of a talk Khun Somsri has agreed to give",
      ["To invite Khun Somsri to apply for a teaching job", "To ask Khun Somsri for advice about stress at work", "To cancel a talk because the hall is not available"],
      "Thank you for agreeing to speak... และ As we discussed แสดงว่าตกลงกันแล้ว อีเมลนี้จึงยืนยันวัน เวลา สถานที่ และถามเรื่องโปรเจกเตอร์ "
      "เรื่องความเครียดเป็นสิ่งที่นักเรียนอยากฟัง ไม่ใช่ครูขอคำปรึกษาเอง", stim=P4, sub=READ)
b.add(T, "understand", "The word 'keen' in the email is closest in meaning to ______.", "eager",
      ["afraid", "unwilling", "confused"],
      "be keen to do something = อยากทำสิ่งนั้นมาก ใกล้เคียง eager ในบริบทนี้นักเรียนอยากฟังว่าพยาบาลจัดการความเครียดอย่างไร "
      "การเดาความหมายจากบริบท (they have prepared some questions) ช่วยตัดตัวเลือก unwilling และ afraid ออก", stim=P4, sub=READ)
P5 = (R + "Some parents believe that more homework always means better results. However, a large review of studies found that for primary students "
      "the link between time spent on homework and test scores is weak. For secondary students the link is stronger, but only up to about "
      "one to two hours a night; beyond that, scores do not improve and students report more stress. The quality of homework, the review concludes, matters more than the quantity.")
b.add(T, "analyze", "What is the writer's main argument?", "The amount of homework is less important than how useful it is.",
      ["Primary students should do at least two hours of homework.", "Homework should be banned at every level of school.", "Parents should stop helping their children with homework."],
      "ประโยคสรุป The quality of homework... matters more than the quantity คือข้อโต้แย้งหลัก ผู้เขียนไม่ได้เสนอให้ยกเลิกการบ้าน "
      "และข้อมูลชี้ว่าระดับประถมการบ้านมากไม่ได้ช่วยมากนัก", stim=P5, sub=READ)
b.add(T, "apply", "According to the passage, what happens when secondary students do more than about two hours of homework a night?",
      "Their scores stop improving and they feel more stressed.", ["Their scores continue to rise steadily.", "They no longer need to attend lessons.",
                                                                  "Their parents report better family relationships."],
      "บทอ่านระบุ beyond that, scores do not improve and students report more stress คะแนนจึงไม่เพิ่มต่อและความเครียดสูงขึ้น "
      "คำเชื่อม However และ but only up to... เป็นตัวบอกขอบเขตของข้อค้นพบ", stim=P5, sub=READ)
P6 = (R + "When Daeng opened her small noodle shop in 2015, she had only four tables and no idea how to advertise. Instead of paying for adverts, "
      "she asked every customer to write one sentence about their meal on a board by the door. Within a year, the board was full, passers-by stopped to read it, "
      "and a local food blogger wrote about the shop. Today Daeng runs three branches, but the original board still hangs in the first shop.")
b.add(T, "understand", "How did Daeng's shop first become well known?", "Customers' comments on a board attracted attention and a blogger's interest.",
      ["She paid a famous blogger to advertise her noodles.", "She opened three branches at the same time in 2015.", "She gave free noodles to everyone who passed by."],
      "บทอ่านบอกว่าเธอไม่ได้จ่ายค่าโฆษณา แต่ให้ลูกค้าเขียนลงกระดาน คนเดินผ่านหยุดอ่าน และบล็อกเกอร์ท้องถิ่นเขียนถึงร้าน "
      "การขยาย 3 สาขาเกิดภายหลัง", stim=P6, sub=READ)
b.add(T, "analyze", "Why does the writer mention that the original board 'still hangs in the first shop'?",
      "To show that Daeng values how her business began", ["To explain that she cannot afford a new board", "To complain that the shop has not been decorated",
                                                         "To suggest that the board is now for sale"],
      "รายละเอียดปิดท้ายสื่อว่าแม้ธุรกิจโตเป็น 3 สาขา เดงยังเก็บกระดานแรกไว้ สะท้อนการให้คุณค่ากับจุดเริ่มต้นและลูกค้า "
      "คำถามแบบนี้ถามจุดประสงค์ของผู้เขียน (author's purpose) ต้องอ่านความหมายแฝง ไม่ใช่แค่ข้อเท็จจริง", stim=P6, sub=READ)

# ---------- CEFR แผนการจัดการเรียนรู้ และการวัดผล (10) ----------
b.add(T, "understand", "'Can introduce him/herself and others and can ask and answer questions about personal details such as where he/she lives.' This CEFR descriptor matches which level?",
      "A1", ["A2", "B1", "B2"],
      "คำอธิบายระดับ A1 (Breakthrough) คือใช้ประโยคพื้นฐานง่าย ๆ แนะนำตัว ถามตอบข้อมูลส่วนตัว และสื่อสารได้ถ้าคู่สนทนาพูดช้าและชัด "
      "A2 เริ่มบรรยายเรื่องใกล้ตัวและสื่อสารงานประจำ B1 จัดการสถานการณ์ส่วนใหญ่ระหว่างเดินทางได้", sub=CEFR)
b.add(T, "understand", "'Can understand a wide range of demanding, longer texts, and recognise implicit meaning.' This CEFR descriptor matches which level?",
      "C1", ["A2", "B1", "C2 only when reading poems"],
      "C1 (Effective operational proficiency) เข้าใจข้อความยากและยาวหลากหลาย จับความหมายแฝงได้ ใช้ภาษาคล่องและยืดหยุ่นในงานและการศึกษา "
      "C2 เข้าใจแทบทุกสิ่งที่ฟังหรืออ่านได้อย่างง่ายดาย", sub=CEFR)
b.add(T, "understand", "The CEFR Companion Volume gives much more attention to which mode of communication, in which learners help others understand texts or ideas?",
      "Mediation", ["Memorisation", "Translation only", "Pronunciation drills"],
      "CEFR Companion Volume ขยายกิจกรรมการสื่อสารเป็น reception, production, interaction และ mediation "
      "mediation คือการเป็นตัวกลางสื่อความหมาย เช่น สรุปเนื้อหาให้เพื่อน อธิบายข้อมูลจากกราฟ หรือช่วยให้กลุ่มทำงานร่วมกันได้ ไม่ใช่แค่การแปล", sub=CEFR)
b.add(T, "apply", "Which learning objective is best written for a 50-minute lesson at A2 level?",
      "Students will be able to ask and answer 5 questions about daily routines.", ["Students will understand English very deeply.",
                                                                                   "Students will know all present tense rules.", "Students will appreciate English culture."],
      "จุดประสงค์ที่ดีระบุพฤติกรรมที่สังเกตและวัดได้ (be able to ask and answer) เงื่อนไข และเกณฑ์ (5 questions) เหมาะกับเวลาและระดับ "
      "คำว่า understand, know, appreciate วัดตรง ๆ ไม่ได้ และ 'all rules' กว้างเกินไปสำหรับคาบเดียว", sub=CEFR)
b.add(T, "understand", "A teacher designs the final speaking task first, then plans the lessons that will prepare students for it. This planning approach is called ______.",
      "backward design", ["grammar-translation", "the audio-lingual method", "summative ranking"],
      "backward design (Wiggins & McTighe) เริ่มจากกำหนดผลการเรียนรู้ที่ต้องการ แล้วออกแบบหลักฐานการประเมิน "
      "จากนั้นจึงวางกิจกรรมการเรียนรู้ ทำให้กิจกรรมทุกอย่างมุ่งไปที่เป้าหมายเดียวกัน", sub=CEFR)
b.add(T, "analyze", "A school's English exam only tests grammar through multiple choice, so teachers stop practising speaking in class. This effect of a test on teaching is called ______.",
      "negative washback", ["positive washback", "inter-rater reliability", "face validity"],
      "washback คือผลของการสอบต่อการสอนและการเรียน ถ้าข้อสอบวัดเพียงไวยากรณ์ ครูอาจละเลยทักษะการพูด จึงเป็น negative washback "
      "การออกแบบการประเมินให้ครอบคลุมทักษะสื่อสารช่วยให้เกิด positive washback", sub=CEFR)
b.add(T, "understand", "Two teachers score the same speaking test very differently. Which action improves inter-rater reliability most?",
      "Use a shared rubric and practise scoring sample recordings together.", ["Let each teacher use his or her own criteria.",
                                                                               "Give the test only to the best students.", "Make the speaking test shorter by half."],
      "inter-rater reliability คือความสอดคล้องของคะแนนระหว่างผู้ประเมิน เพิ่มได้ด้วยเกณฑ์ร่วม (rubric) ที่ชัดเจน "
      "และการปรับมาตรฐาน (standardisation) โดยลองให้คะแนนตัวอย่างร่วมกันก่อนประเมินจริง", sub=CEFR)
b.add(T, "apply", "Which is an example of formative assessment in a writing lesson?",
      "The teacher gives comments on first drafts so students can revise them.", ["Students take a final writing exam that counts for 40%.",
                                                                                  "The school ranks students by their end-of-year scores.", "Scores are sent to parents at the end of the term only."],
      "formative assessment ใช้ข้อมูลระหว่างเรียนเพื่อปรับปรุงการเรียนรู้ เช่น feedback บนฉบับร่าง peer review และ self-assessment "
      "ส่วน summative assessment ใช้ตัดสินผลเมื่อจบหน่วยหรือภาคเรียน", sub=CEFR)
b.add(T, "understand", "In a PPP lesson, what happens in the 'Production' stage?",
      "Students use the new language more freely in a communicative task.", ["The teacher explains the grammar rule for the first time.",
                                                                            "Students repeat the model sentences after the teacher.", "The teacher checks attendance and homework."],
      "PPP มี 3 ขั้น: Presentation (ครูนำเสนอภาษาใหม่) Practice (ฝึกแบบควบคุม เช่น drill) และ Production (ใช้ภาษาอย่างอิสระในงานสื่อสาร) "
      "การพูดตามแบบเป็นขั้น Practice", sub=CEFR)
b.add(T, "analyze", "A teacher wants to test reading comprehension but the test uses many difficult words that are not in the course. Which quality of the test is most affected?",
      "Validity, because it may measure vocabulary knowledge instead of reading skills", ["Practicality, because the test is too cheap to print",
                                                                                         "Reliability, because the test has too many questions", "Authenticity, because the passage is about real life"],
      "ความตรง (validity) คือแบบทดสอบวัดสิ่งที่ตั้งใจจะวัดหรือไม่ ถ้าคำศัพท์ยากนอกหลักสูตร ผลอาจสะท้อนความรู้คำศัพท์มากกว่าทักษะการอ่าน "
      "ผลที่ได้จึงตีความเรื่องความเข้าใจการอ่านได้ไม่ถูกต้อง", sub=CEFR)

# ---------- Language & Culture (8) ----------
b.add(T, "understand", "In many English-speaking countries, which question is generally considered too personal when meeting someone for the first time?",
      "How much money do you earn?", ["Where are you from?", "What do you do?", "How was your trip here?"],
      "การถามรายได้ อายุ น้ำหนัก หรือศาสนาในการพบกันครั้งแรกมักถือว่าเป็นเรื่องส่วนตัวเกินไป "
      "หัวข้อที่ปลอดภัยสำหรับ small talk คือการเดินทาง สภาพอากาศ งาน และที่มาของอีกฝ่าย", sub=CULT)
b.add(T, "understand", "Someone sneezes in a meeting in the United States. What do people usually say?",
      "Bless you.", ["Excuse me for you.", "Good luck.", "Cheers."],
      "Bless you. เป็นธรรมเนียมเมื่อมีคนจาม และผู้จามมักตอบ Thank you. "
      "Cheers ใช้ชนแก้วหรือขอบคุณแบบไม่เป็นทางการในอังกฤษ Good luck ใช้อวยพรให้โชคดี", sub=CULT)
b.add(T, "understand", "A British colleague says, 'It's raining cats and dogs.' What does this idiom mean?",
      "It's raining very heavily.", ["Pets are not allowed outside.", "The weather is changing quickly.", "It is a little cloudy and cool."],
      "raining cats and dogs เป็นสำนวน (idiom) แปลว่าฝนตกหนักมาก ความหมายของสำนวนไม่ได้มาจากความหมายของแต่ละคำ "
      "ครูควรสอนสำนวนในบริบทพร้อมสถานการณ์การใช้", sub=CULT)
b.add(T, "analyze", "After a presentation, a British manager says, 'That's an interesting idea. We might come back to it later.' What does this most likely suggest?",
      "The manager is politely showing little support for the idea.", ["The manager wants to start the idea immediately.", "The manager has misunderstood the presentation.",
                                                                       "The manager is giving very strong praise."],
      "ภาษาอังกฤษแบบบริติชมักสื่อความไม่เห็นด้วยแบบอ้อม (understatement / indirectness) คำว่า interesting และ might come back to it later "
      "อาจหมายถึงยังไม่สนับสนุน การเข้าใจความหมายเชิงวัฒนธรรมช่วยลดความเข้าใจผิดในการสื่อสารข้ามวัฒนธรรม", sub=CULT)
b.add(T, "understand", "In the United States, Thanksgiving is celebrated on ______.",
      "the fourth Thursday of November", ["the last Monday of December", "the first Sunday of October", "the 4th of July every year"],
      "Thanksgiving ในสหรัฐอเมริกาตรงกับวันพฤหัสบดีที่ 4 ของเดือนพฤศจิกายน เป็นวันรวมครอบครัวและรับประทานไก่งวง "
      "ส่วน 4 กรกฎาคมเป็นวันประกาศอิสรภาพ (Independence Day)", sub=CULT)
b.add(T, "apply", "A new English teacher from Canada is introduced to the class. How should students greet her if her name is Sarah Brown?",
      "Good morning, Ms. Brown.", ["Good morning, Ms. Sarah.", "Good morning, Teacher Sarah Brown.", "Good morning, Mrs. Sarah."],
      "ในภาษาอังกฤษ คำนำหน้า Mr./Ms./Mrs. ใช้กับนามสกุล (Ms. Brown) ไม่ใช้กับชื่อต้น ต่างจากภาษาไทยที่ใช้ 'ครู' หรือ 'คุณ' กับชื่อต้น "
      "Ms. ใช้ได้กับผู้หญิงโดยไม่ต้องรู้สถานภาพสมรส", sub=CULT)
b.add(T, "analyze", "A Thai teacher wants students to compare Loy Krathong with a festival in another culture. Which activity best develops intercultural competence?",
      "Students research both festivals, compare their meanings, and avoid judging one as better.", ["Students memorise the date of a Western festival only.",
                                                                                                     "Students decide which country has the best festival.", "Students translate a festival song word by word."],
      "ความสามารถในการสื่อสารข้ามวัฒนธรรม (intercultural competence) ต้องมีทั้งความรู้ ทักษะการเปรียบเทียบ และเจตคติที่เปิดกว้าง "
      "การเทียบความหมายของประเพณีโดยไม่ตัดสินว่าอะไรดีกว่า ช่วยลดอคติและเห็นทั้งความเหมือนและความต่าง", sub=CULT)
b.add(T, "understand", "Students say a speaker from Singapore 'does not speak real English' because of her accent. How should the teacher respond?",
      "Explain that English has many varieties and accents, all of which are valid for communication.",
      ["Agree that only American English is real English.", "Tell students to ignore speakers from Asia.", "Correct the speaker's accent as a class activity."],
      "แนวคิด World Englishes และ English as a Lingua Franca มองว่าภาษาอังกฤษมีหลายสำเนียงและรูปแบบที่ใช้สื่อสารได้จริง "
      "เป้าหมายของผู้เรียนคือความเข้าใจได้ (intelligibility) มากกว่าการพูดให้เหมือนเจ้าของภาษาประเทศใดประเทศหนึ่ง", sub=CULT)

# ---------- วิธีสอนภาษา (6) ----------
b.add(T, "understand", "A teacher of young learners says 'Stand up', 'Touch your nose', 'Jump three times' and students respond with actions before speaking. This method is ______.",
      "Total Physical Response (TPR)", ["Grammar-Translation Method", "Silent Way", "Content and Language Integrated Learning"],
      "TPR (James Asher) ให้ผู้เรียนฟังคำสั่งแล้วตอบสนองด้วยการเคลื่อนไหวก่อนการพูด เลียนแบบการเรียนภาษาแม่ของเด็ก "
      "ลดความกังวล เหมาะกับผู้เรียนวัยเด็กและผู้เริ่มต้น", sub=METH)
b.add(T, "understand", "Which feature best describes the Audio-Lingual Method?",
      "Repetition drills to form correct language habits", ["Long reading and translation of literature", "Tasks with real outcomes and no drills",
                                                            "Learning subject content through English"],
      "Audio-Lingual Method มีฐานจากพฤติกรรมนิยม (behaviourism) เชื่อว่าภาษาคือนิสัย ใช้การฟังและพูดตามแบบ ฝึกซ้ำ (drills) "
      "และเสริมแรงเมื่อพูดถูก การอ่านแปลวรรณกรรมเป็นลักษณะของ Grammar-Translation", sub=METH)
b.add(T, "understand", "In CLIL (Content and Language Integrated Learning), the '4Cs' refer to ______.",
      "content, communication, cognition and culture", ["courses, classes, clubs and camps", "correctness, clarity, completeness and conciseness",
                                                       "copying, checking, correcting and completing"],
      "CLIL สอนเนื้อหาวิชาผ่านภาษาเป้าหมาย กรอบ 4Cs (Coyle) คือ Content (ความรู้ในวิชา) Communication (การใช้ภาษา) "
      "Cognition (ทักษะการคิด) และ Culture (ความเข้าใจตนเองและผู้อื่น)", sub=METH)
b.add(T, "analyze", "Some students know the answers but rarely speak because they are afraid of making mistakes in front of classmates. According to Krashen, which factor is blocking their learning?",
      "A high affective filter", ["Too much comprehensible input", "A low level of fossilisation", "Overuse of the natural order"],
      "สมมติฐานตัวกรองทางอารมณ์ (affective filter) ของ Krashen กล่าวว่าความกังวล ความกลัว และแรงจูงใจต่ำทำให้ข้อมูลภาษาเข้าไปไม่ถึงกระบวนการเรียนรู้ "
      "ครูลดตัวกรองได้ด้วยบรรยากาศที่ปลอดภัย การทำงานคู่หรือกลุ่มเล็ก และการแก้ข้อผิดพลาดอย่างเหมาะสม", sub=METH)
b.add(T, "apply", "In an information-gap activity, Student A has a timetable with some times missing and Student B has the missing times. What is the main communicative purpose?",
      "Students must exchange information to complete the task.", ["Students copy the timetable from the board.", "Students memorise the timetable alone.",
                                                                    "Students translate the timetable into Thai."],
      "information gap คือแต่ละคนมีข้อมูลไม่ครบ ต้องถามและตอบเพื่อเติมให้ครบ จึงเกิดความจำเป็นในการสื่อสารจริง "
      "เป็นกิจกรรมสำคัญของการสอนภาษาเพื่อการสื่อสาร (CLT)", sub=METH)
b.add(T, "understand", "In Jane Willis's task-based framework, when do students focus on the grammar and vocabulary of the task?",
      "In the language focus stage after the task cycle", ["Before any task, in a long grammar lecture", "Only in the final exam at the end of term",
                                                         "Never, because tasks do not involve language"],
      "กรอบ TBL ของ Willis มี 3 ขั้น: pre-task (เตรียม) task cycle (task → planning → report) และ language focus "
      "(วิเคราะห์และฝึกภาษาที่ปรากฏในงาน) ภาษาจึงถูกเน้นหลังจากผู้เรียนใช้ภาษาสื่อสารทำงานจริงแล้ว", sub=METH)

# ---------- Clauses (4) ----------
b.add(T, "apply", "The teacher ______ I met at the conference has written three textbooks.",
      "whom", ["whose", "which", "what"],
      "ประโยคต้องการ relative pronoun แทนคนที่เป็นกรรมของ met (I met the teacher) จึงใช้ whom (หรือ who/that หรือละได้) "
      "whose แสดงความเป็นเจ้าของ which ใช้กับสิ่งของ ส่วน what ไม่ใช้เป็น relative pronoun หลังคำนาม", sub=CLAUSE)
b.add(T, "apply", "______ the students finished the project on time surprised everyone.",
      "That", ["What", "Which", "If"],
      "ประโยคใช้ noun clause เป็นประธาน (That + ประโยคสมบูรณ์) That the students finished... เป็นประธานของ surprised "
      "What ใช้เมื่อประโยคตามมาขาดส่วนใดส่วนหนึ่ง เช่น What they did surprised everyone ส่วน if ใช้ขึ้นต้นประธานไม่ได้ (ต้องใช้ whether)", sub=CLAUSE)
b.add(T, "analyze", "Which sentence uses a non-defining relative clause correctly?",
      "My father, who is a farmer, gets up at five every day.", ["My father that is a farmer gets up at five every day.",
                                                               "My father, that is a farmer, gets up at five every day.", "My father who, is a farmer gets up at five every day."],
      "non-defining relative clause ให้ข้อมูลเพิ่มเติมเกี่ยวกับนามที่ชี้ชัดแล้ว (my father มีคนเดียว) ต้องมีจุลภาคทั้งหน้าและหลัง "
      "และห้ามใช้ that ใน non-defining clause", sub=CLAUSE)

# ---------- Tenses (4) ----------
b.add(T, "apply", "By the time we arrived at the cinema, the film ______.",
      "had already started", ["has already started", "already starts", "was already starting to start"],
      "By the time + past simple บอกจุดเวลาในอดีต เหตุการณ์ที่เกิดก่อนหน้าจุดนั้นใช้ past perfect (had + V3) "
      "present perfect ใช้เชื่อมกับปัจจุบัน จึงไม่เข้ากับเรื่องเล่าในอดีต", sub=TENSE)
b.add(T, "apply", "Look at those dark clouds! It ______ rain.",
      "is going to", ["will be", "rains", "has"],
      "be going to ใช้ทำนายจากหลักฐานที่เห็นในปัจจุบัน (dark clouds) ส่วน will ใช้ทำนายจากความคิดเห็นหรือตัดสินใจทันที "
      "will be rain ผิดโครงสร้าง เพราะ rain ในที่นี้เป็นกริยา", sub=TENSE)
b.add(T, "apply", "I ______ English at this school since 2019.",
      "have been teaching", ["am teaching", "teach", "was teaching"],
      "since + จุดเริ่มต้นในอดีต ใช้กับ present perfect หรือ present perfect continuous เพื่อบอกการกระทำที่เริ่มในอดีตและยังทำอยู่ "
      "present continuous และ present simple ไม่ใช้กับ since ในความหมายนี้", sub=TENSE)
b.add(T, "analyze", "Which sentence is grammatically correct?",
      "When I was walking home, it started to rain.", ["When I walked home, it was starting rain.", "When I am walking home, it started to rain.",
                                                       "When I was walk home, it starts to rain."],
      "past continuous (was walking) บอกเหตุการณ์ที่กำลังดำเนินอยู่ แล้วมีเหตุการณ์สั้นแทรกเข้ามาด้วย past simple (started) "
      "ตัวเลือกอื่นผิดเรื่องการผสม tense หรือรูปกริยา (was walk, starting rain)", sub=TENSE)

# ---------- Direct / Indirect Speech (4) ----------
b.add(T, "apply", "'Have you finished your homework?' my mother asked me. → My mother asked me ______.",
      "if I had finished my homework", ["had I finished my homework", "if I have finished my homework", "that had I finished my homework"],
      "Yes/No question เปลี่ยนเป็น reported question ด้วย if/whether และเรียงแบบประโยคบอกเล่า (subject + verb) "
      "กริยารายงานเป็นอดีต (asked) จึงถอย tense: have finished → had finished และ your → my", sub=SPEECH)
b.add(T, "apply", "'I can't come to the meeting tomorrow,' said Nida. → Nida said that she ______ to the meeting the next day.",
      "couldn't come", ["can't come", "won't come", "couldn't came"],
      "ใน reported speech ที่กริยารายงานเป็นอดีต can't เปลี่ยนเป็น couldn't และ tomorrow เปลี่ยนเป็น the next day / the following day "
      "หลัง could ต้องใช้ V1 (come) ไม่ใช่ V2", sub=SPEECH)
b.add(T, "apply", "'Please close the door,' the teacher said to Tom. → The teacher ______.",
      "asked Tom to close the door", ["said Tom closed the door", "asked Tom that he closes the door", "told to Tom close the door"],
      "คำขอร้องหรือคำสั่งในรูป reported speech ใช้ ask/tell + object + to-infinitive เช่น asked Tom to close the door "
      "ใช้ told to Tom ไม่ได้ เพราะ tell ตามด้วยกรรมโดยตรง", sub=SPEECH)
b.add(T, "analyze", "'We are studying here now,' the students said. Which reported version is most appropriate when reported a week later in another place?",
      "The students said that they were studying there then.", ["The students said that we are studying here now.",
                                                               "The students said that they are studied there then.", "The students said that they were study here now."],
      "เมื่อรายงานต่างเวลาและสถานที่ ต้องเปลี่ยนสรรพนาม (we → they) tense (are studying → were studying) "
      "และคำบอกเวลาสถานที่ (here → there, now → then) ตามมุมมองของผู้รายงาน", sub=SPEECH)

# รอบแรกข้อถูกยาวที่สุด 42/66 → ย่อข้อถูก/ยืดตัวลวง (ความหมายถูกผิดเหมือนเดิม)
b.shorter.update({
    "I see your point, but I'm not sure that would suit such young learners.": "I see your point, but I'm not sure it suits young learners.",
    "Excuse me, may I leave a little early today? I have a doctor's appointment.": "Excuse me, may I leave early today? I have a doctor's appointment.",
    "Customers' comments on a board attracted attention and a blogger's interest.": "Customers' comments on a board caught people's attention.",
    "Students will be able to ask and answer 5 questions about daily routines.": "Students will be able to ask and answer 5 questions on daily routines.",
    "Validity, because it may measure vocabulary knowledge instead of reading skills": "Validity, as it may measure vocabulary instead of reading",
    "Students research both festivals, compare their meanings, and avoid judging one as better.": "Students compare the meanings of both festivals without judging either.",
    "Explain that English has many varieties and accents, all of which are valid for communication.": "Explain that English has many valid varieties and accents.",
    "The teacher gives comments on first drafts so students can revise them.": "The teacher comments on first drafts so students can revise.",
    "Use a shared rubric and practise scoring sample recordings together.": "Use a shared rubric and practise scoring samples together.",
})
b.longer.update({
    "She paid a famous blogger to advertise her noodles.": "She paid a famous food blogger to advertise her noodles online.",
    "That's the worst idea I've ever heard in this school.": "That's the worst idea I've ever heard in this school, honestly speaking.",
    "What? I don't care about the instructions.": "What? I don't care about the instructions you gave us today.",
    "Yes, I went to the night market last week.": "Yes, I went to the night market with my family last week.",
    "I'm not paying anything until you apologise.": "I'm not paying anything at all until you apologise to me first.",
    "Please hold. I'm afraid that I can speak.": "Please hold the line. I'm afraid that I can speak to you now.",
    "Yes, I'd love to come. See you then!": "Yes, I'd love to come to your party. See you on Saturday then!",
    "Congratulations! That's wonderful news.": "Congratulations! That's really wonderful news for your family.",
    "Any questions? No? Good.": "Any questions? No? Good. Let's begin.",
    "Leave me early today, teacher, because the doctor.": "Leave me go early today, teacher, because I have the doctor appointment.",
    "If I were you, I drank decaf after lunch.": "If I were you, I drank decaf coffee every day after lunch.",
    "Yes, you should thank me more often.": "Yes, you should thank me more often than you do.",
    "You can send letters at the post office.": "You can send letters and parcels at the post office there.",
    "The school sells vegetables to make a large profit.": "The school sells vegetables every Friday to make a very large profit.",
    "Teachers give them extra marks for arriving early.": "Teachers give them extra marks every time they arrive before 8 a.m.",
    "To announce that the school will close in December": "To announce that the school will close for a long holiday in December",
    "Factories that make drinking water": "Factories that make and bottle drinking water for sale",
    "Microbeads are still allowed in all cosmetics worldwide.": "Microbeads are still allowed in all cosmetics in every country worldwide.",
    "To cancel a talk because the hall is not available": "To cancel a talk because the school hall is not available on that day",
    "Primary students should do at least two hours of homework.": "Primary students should do at least two hours of homework every single night.",
    "Their parents report better family relationships.": "Their parents report better family relationships and less stress at home.",
    "Students will understand English very deeply.": "Students will understand the English language and its grammar very deeply.",
    "Let each teacher use his or her own criteria.": "Let each teacher use his or her own criteria and personal judgement.",
    "Scores are sent to parents at the end of the term only.": "Scores are sent to parents only once, at the very end of the school term.",
    "The teacher explains the grammar rule for the first time.": "The teacher explains the new grammar rule to the whole class for the first time.",
    "Authenticity, because the passage is about real life": "Authenticity, because the reading passage is about real-life situations",
    "The manager wants to start the idea immediately.": "The manager wants to start working on the idea immediately, this week.",
    "Students memorise the date of a Western festival only.": "Students memorise only the date and name of a Western festival.",
    "Agree that only American English is real English.": "Agree with them that only American or British English is real English.",
    "Long reading and translation of literature": "Long reading and word-by-word translation of classic literature",
    "Students copy the timetable from the board.": "Students copy the whole timetable from the board into their notebooks.",
    "Never, because tasks do not involve language": "Never, because tasks do not involve any language work at all",
})

OUT = ROOT / "content" / "prep" / "bank-major-eng-2026-11.json"
out = b.build(OUT, "claude-major-2026-11")
