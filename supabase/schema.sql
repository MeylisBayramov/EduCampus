-- =====================================================
-- EduCampus - Veritabanı Şeması
-- Supabase PostgreSQL
-- =====================================================

-- Profiller tablosu
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  about TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dersler tablosu
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_teacher_id ON courses(teacher_id);

-- Kayıtlar tablosu
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, student_id)
);

CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);

-- Ödevler tablosu
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 100 CHECK (max_score > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assignments_course_id ON assignments(course_id);
CREATE INDEX idx_assignments_due_date ON assignments(due_date);

-- Teslimler tablosu
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score NUMERIC CHECK (score IS NULL OR score >= 0),
  feedback TEXT,
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX idx_submissions_assignment_id ON submissions(assignment_id);
CREATE INDEX idx_submissions_student_id ON submissions(student_id);

-- Duyurular tablosu
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_course_id ON announcements(course_id);
CREATE INDEX idx_announcements_teacher_id ON announcements(teacher_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- profiles RLS
CREATE POLICY "Herkes profilleri okuyabilir"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Kullanıcı kendi profilini güncelleyebilir"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Service role profil ekleyebilir"
  ON profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Kullanıcı kendi profilini silebilir veya öğretmen silebilir"
  ON profiles FOR DELETE
  USING (
    email NOT IN ('ogretmen@demo.com', 'ogrenci@demo.com')
    AND (
      auth.uid() = id 
      OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'
      )
    )
  );

-- courses RLS
CREATE POLICY "Herkes dersleri listeleyebilir"
  ON courses FOR SELECT
  USING (true);

CREATE POLICY "Öğretmen ders oluşturabilir"
  ON courses FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
    AND teacher_id = auth.uid()
  );

CREATE POLICY "Öğretmen kendi dersini güncelleyebilir"
  ON courses FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Öğretmen kendi dersini silebilir"
  ON courses FOR DELETE
  USING (teacher_id = auth.uid());

-- enrollments RLS
CREATE POLICY "Kayıtları okuma"
  ON enrollments FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses WHERE courses.id = enrollments.course_id AND courses.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'
    )
  );

CREATE POLICY "Öğrenci katılma isteği gönderebilir veya öğretmen öğrenci ekleyebilir"
  ON enrollments FOR INSERT
  WITH CHECK (
    (
      student_id = auth.uid()
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student')
    )
    OR
    EXISTS (
      SELECT 1 FROM courses WHERE courses.id = enrollments.course_id AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Kayıt güncelleme"
  ON enrollments FOR UPDATE
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses WHERE courses.id = enrollments.course_id AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Kayıt silme"
  ON enrollments FOR DELETE
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM courses WHERE courses.id = enrollments.course_id AND courses.teacher_id = auth.uid()
    )
  );

-- assignments RLS
CREATE POLICY "Ödevleri okuma"
  ON assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses WHERE courses.id = assignments.course_id AND courses.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM enrollments 
      WHERE enrollments.course_id = assignments.course_id 
      AND enrollments.student_id = auth.uid() 
      AND enrollments.status = 'approved'
    )
  );

CREATE POLICY "Öğretmen ödev oluşturabilir"
  ON assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses WHERE courses.id = assignments.course_id AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Öğretmen ödev güncelleyebilir"
  ON assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM courses WHERE courses.id = assignments.course_id AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Öğretmen ödev silebilir"
  ON assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM courses WHERE courses.id = assignments.course_id AND courses.teacher_id = auth.uid()
    )
  );

-- submissions RLS
CREATE POLICY "Teslimleri okuma"
  ON submissions FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM assignments 
      JOIN courses ON courses.id = assignments.course_id 
      WHERE assignments.id = submissions.assignment_id 
      AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Öğrenci teslim yapabilir"
  ON submissions FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM assignments
      JOIN enrollments ON enrollments.course_id = assignments.course_id
      WHERE assignments.id = submissions.assignment_id
      AND enrollments.student_id = auth.uid()
      AND enrollments.status = 'approved'
    )
  );

CREATE POLICY "Teslim güncelleme"
  ON submissions FOR UPDATE
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM assignments 
      JOIN courses ON courses.id = assignments.course_id 
      WHERE assignments.id = submissions.assignment_id 
      AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teslim silme"
  ON submissions FOR DELETE
  USING (
    student_id = auth.uid()
  );

-- announcements RLS
CREATE POLICY "Duyuruları okuma"
  ON announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses WHERE courses.id = announcements.course_id AND courses.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = announcements.course_id
      AND enrollments.student_id = auth.uid()
      AND enrollments.status = 'approved'
    )
  );

CREATE POLICY "Öğretmen duyuru oluşturabilir"
  ON announcements FOR INSERT
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM courses WHERE courses.id = announcements.course_id AND courses.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Öğretmen duyuru güncelleyebilir"
  ON announcements FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Öğretmen duyuru silebilir"
  ON announcements FOR DELETE
  USING (teacher_id = auth.uid());

-- =====================================================
-- Trigger: Yeni kullanıcı kayıt olduğunda profil oluştur
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Kullanıcı'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
