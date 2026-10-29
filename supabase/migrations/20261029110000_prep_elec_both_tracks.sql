-- สพฐ. users asked for เอกไฟฟ้ากำลัง (feedback #2). The bank (209 questions) was สอศ.-only; track null lists it
-- for both exams (prep_topics, major picker, mock exam and readiness already treat null as "both").
update prep.topics set track = null where code = 'B3-V-ELEC';
