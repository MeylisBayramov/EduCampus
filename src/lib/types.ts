export type UserRole = 'student' | 'teacher'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  about: string | null
  created_at: string
}

export interface Course {
  id: string
  teacher_id: string
  title: string
  description: string
  content: string
  created_at: string
  teacher?: Profile
}

export type EnrollmentStatus = 'pending' | 'approved' | 'rejected'

export interface Enrollment {
  id: string
  course_id: string
  student_id: string
  status: EnrollmentStatus
  created_at: string
  student?: Profile
  course?: Course
}

export interface Assignment {
  id: string
  course_id: string
  title: string
  description: string
  due_date: string
  max_score: number
  created_at: string
  course?: Course
  submission?: Submission | null
}

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  content: string
  submitted_at: string
  score: number | null
  feedback: string | null
  student?: Profile
  assignment?: Assignment
}

export interface Announcement {
  id: string
  course_id: string
  teacher_id: string
  title: string
  content: string
  created_at: string
  course?: Course
  teacher?: Profile
}
