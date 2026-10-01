-- ====================================================================
-- Migration: Enable RLS Policies for Examination System
-- Description: Grant SELECT, INSERT, UPDATE access to anon and authenticated roles
-- ====================================================================

-- 1. Question Bank & Choices
CREATE POLICY "Allow public select question_bank" 
ON question_bank FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Allow public insert question_bank" 
ON question_bank FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Allow public update question_bank" 
ON question_bank FOR UPDATE 
TO anon, authenticated 
USING (true);

CREATE POLICY "Allow public select question_choices" 
ON question_choices FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Allow public insert question_choices" 
ON question_choices FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Allow public update question_choices" 
ON question_choices FOR UPDATE 
TO anon, authenticated 
USING (true);

-- 2. Subjects
CREATE POLICY "Allow public select subjects" 
ON subjects FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Allow public all subjects" 
ON subjects FOR ALL 
TO anon, authenticated 
USING (true);

-- 3. Exams
CREATE POLICY "Allow public all exams" 
ON exams FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Exam Questions
CREATE POLICY "Allow public all exam_questions" 
ON exam_questions FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 5. Students
CREATE POLICY "Allow public all students" 
ON students FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 6. Exam Sessions (Proctoring & Status)
CREATE POLICY "Allow public all exam_sessions" 
ON exam_sessions FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 7. Student Answers
CREATE POLICY "Allow public all student_answers" 
ON student_answers FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);
