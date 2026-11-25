import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
})

export const registerSchema = z.object({
  full_name: z.string().min(2, 'Ad soyad en az 2 karakter olmalıdır').max(100, 'Ad soyad en fazla 100 karakter olabilir'),
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır').max(72, 'Şifre en fazla 72 karakter olabilir'),
  role: z.enum(['student', 'teacher']).default('student'),
})

export const profileSchema = z.object({
  full_name: z.string().min(2, 'Ad soyad en az 2 karakter olmalıdır').max(100, 'Ad soyad en fazla 100 karakter olabilir'),
  about: z.string().max(5000, 'Hakkında alanı en fazla 5000 karakter olabilir').nullable().optional(),
})

export const courseSchema = z.object({
  title: z.string().min(3, 'Ders başlığı en az 3 karakter olmalıdır').max(200, 'Ders başlığı en fazla 200 karakter olabilir'),
  description: z.string().min(10, 'Açıklama en az 10 karakter olmalıdır').max(500, 'Açıklama en fazla 500 karakter olabilir'),
  content: z.string().min(10, 'İçerik en az 10 karakter olmalıdır'),
})

export const assignmentSchema = z.object({
  title: z.string().min(3, 'Ödev başlığı en az 3 karakter olmalıdır').max(200, 'Ödev başlığı en fazla 200 karakter olabilir'),
  description: z.string().min(10, 'Açıklama en az 10 karakter olmalıdır'),
  due_date: z.string().refine((date) => {
    const d = new Date(date)
    return !isNaN(d.getTime()) && d > new Date()
  }, 'Son teslim tarihi gelecekte olmalıdır'),
  max_score: z.number().int().min(1, 'Maksimum puan en az 1 olmalıdır').max(1000, 'Maksimum puan en fazla 1000 olabilir'),
})

export const assignmentUpdateSchema = z.object({
  title: z.string().min(3, 'Ödev başlığı en az 3 karakter olmalıdır').max(200, 'Ödev başlığı en fazla 200 karakter olabilir'),
  description: z.string().min(10, 'Açıklama en az 10 karakter olmalıdır'),
  due_date: z.string().refine((date) => {
    const d = new Date(date)
    return !isNaN(d.getTime())
  }, 'Geçerli bir tarih giriniz'),
  max_score: z.number().int().min(1, 'Maksimum puan en az 1 olmalıdır').max(1000, 'Maksimum puan en fazla 1000 olabilir'),
})

export const submissionSchema = z.object({
  content: z.string().min(10, 'Teslim içeriği en az 10 karakter olmalıdır'),
})

export const gradingSchema = z.object({
  score: z.number().min(0, 'Puan sıfırdan küçük olamaz'),
  feedback: z.string().optional().nullable(),
})

export const announcementSchema = z.object({
  title: z.string().min(3, 'Duyuru başlığı en az 3 karakter olmalıdır').max(200, 'Duyuru başlığı en fazla 200 karakter olabilir'),
  content: z.string().min(10, 'Duyuru içeriği en az 10 karakter olmalıdır'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ProfileInput = z.infer<typeof profileSchema>
export type CourseInput = z.infer<typeof courseSchema>
export type AssignmentInput = z.infer<typeof assignmentSchema>
export type SubmissionInput = z.infer<typeof submissionSchema>
export type GradingInput = z.infer<typeof gradingSchema>
export type AnnouncementInput = z.infer<typeof announcementSchema>
