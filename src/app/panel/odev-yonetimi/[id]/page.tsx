'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { TipTapEditor } from '@/components/tiptap-editor'
import { RichTextContent } from '@/components/rich-text-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, formatDateTime, isOverdue } from '@/lib/utils'
import { gradingSchema } from '@/lib/validations'
import type { Assignment, Course, Submission, Profile } from '@/lib/types'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ClipboardList,
  FileText,
  Loader2,
  MessageSquare,
  Save,
  ShieldAlert,
  Users,
} from 'lucide-react'

type SubmissionWithStudent = Submission & {
  profiles?: Profile | Profile[] | null
}

type AssignmentWithCourse = Assignment & {
  course?: Pick<Course, 'id' | 'title'> | null
}

function getProfile(submission: SubmissionWithStudent): Profile | null {
  if (!submission.profiles) return null
  return Array.isArray(submission.profiles) ? submission.profiles[0] ?? null : submission.profiles
}

export default function TeacherAssignmentDetailPage() {
  const params = useParams()
  const assignmentId = Array.isArray(params.id) ? params.id[0] : params.id
  const { profile, loading: authLoading } = useAuth()

  const [assignment, setAssignment] = useState<AssignmentWithCourse | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState<string | null>(null)

  // Grading state
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null)
  const [gradeScore, setGradeScore] = useState<number>(0)
  const [gradeFeedback, setGradeFeedback] = useState('')
  const [savingGrade, setSavingGrade] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!profile || !assignmentId) {
        if (!authLoading) setLoading(false)
        return
      }

      if (profile.role !== 'teacher') {
        setAccessDenied('Bu sayfaya yalnızca öğretmenler erişebilir.')
        setLoading(false)
        return
      }

      setLoading(true)
      const supabase = createClient()

      // Fetch assignment with course info
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('*, courses(id, title, teacher_id)')
        .eq('id', assignmentId)
        .maybeSingle()

      if (assignmentError || !assignmentData) {
        setAccessDenied('Ödev bulunamadı.')
        setLoading(false)
        return
      }

      const courseData = Array.isArray(assignmentData.courses)
        ? assignmentData.courses[0]
        : assignmentData.courses

      if (courseData?.teacher_id !== profile.id) {
        setAccessDenied('Bu ödev sizin derslerinizden birine ait değil.')
        setLoading(false)
        return
      }

      const formatted: AssignmentWithCourse = {
        ...assignmentData,
        course: courseData ? { id: courseData.id, title: courseData.title } : null,
      }
      setAssignment(formatted)

      // Fetch submissions with student profiles
      const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .select('*, profiles(*)')
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false })

      if (submissionError) {
        toast.error('Teslimler yüklenirken bir hata oluştu.')
      } else {
        setSubmissions((submissionData as SubmissionWithStudent[]) ?? [])
      }

      setLoading(false)
    }

    if (!authLoading) {
      fetchData()
    }
  }, [assignmentId, profile, authLoading])

  const startGrading = (submission: SubmissionWithStudent) => {
    setGradingSubmissionId(submission.id)
    setGradeScore(submission.score ?? 0)
    setGradeFeedback(submission.feedback ?? '')
  }

  const cancelGrading = () => {
    setGradingSubmissionId(null)
    setGradeScore(0)
    setGradeFeedback('')
  }

  const handleSaveGrade = async (e: React.FormEvent, submissionId: string) => {
    e.preventDefault()

    if (!assignment) return

    const result = gradingSchema.safeParse({
      score: gradeScore,
      feedback: gradeFeedback === '<p></p>' ? '' : gradeFeedback.trim() || null,
    })

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Lütfen puan bilgisini kontrol ediniz')
      return
    }

    if (gradeScore > assignment.max_score) {
      toast.error(`Puan maksimum ${assignment.max_score} olabilir`)
      return
    }

    setSavingGrade(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('submissions')
      .update({
        score: result.data.score,
        feedback: result.data.feedback ?? null,
      })
      .eq('id', submissionId)
      .select('*, profiles(*)')
      .single()

    if (error) {
      toast.error('Not kaydedilirken bir hata oluştu')
      setSavingGrade(false)
      return
    }

    setSubmissions((prev) =>
      prev.map((s) => (s.id === submissionId ? (data as SubmissionWithStudent) : s))
    )
    toast.success('Not başarıyla kaydedildi')
    setSavingGrade(false)
    cancelGrading()
  }

  if (authLoading || loading) return <LoadingSpinner />

  if (accessDenied || !assignment) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/panel/odev-yonetimi">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Ödev Yönetimine Dön
          </Button>
        </Link>
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="rounded-full bg-red-100 p-4">
                <ShieldAlert className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Erişim Engellendi</h2>
              <p className="text-sm text-gray-500 max-w-md">
                {accessDenied ?? 'Ödev bilgilerine erişilemedi.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const overdue = isOverdue(assignment.due_date)
  const gradedCount = submissions.filter((s) => s.score !== null).length
  const ungradedCount = submissions.filter((s) => s.score === null).length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/panel/odev-yonetimi">
          <Button variant="ghost" size="sm" className="gap-2 mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Ödev Yönetimine Dön
          </Button>
        </Link>
      </div>

      {/* Assignment Info Card */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              {assignment.course?.title && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-blue-600">
                  <BookOpen className="h-4 w-4" />
                  <span>{assignment.course.title}</span>
                </div>
              )}
              <CardTitle className="text-2xl text-gray-900">{assignment.title}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {overdue ? (
                <Badge variant="destructive">Süresi Geçti</Badge>
              ) : (
                <Badge variant="success">Açık</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <Clock className={`h-5 w-5 shrink-0 ${overdue ? 'text-red-500' : 'text-blue-600'}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Son Teslim</p>
                <p className={`text-sm font-medium mt-0.5 ${overdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatDateTime(assignment.due_date)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <Award className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-xs font-medium text-gray-500">Maks. Puan</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{assignment.max_score}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <Users className="h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="text-xs font-medium text-gray-500">Teslim</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">{submissions.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-purple-600" />
              <div>
                <p className="text-xs font-medium text-gray-500">Notlandırılan</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {gradedCount} / {submissions.length}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="border-t border-gray-100 pt-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            Ödev Açıklaması
          </h4>
          <div className="rounded-lg bg-gray-50 p-4">
            <RichTextContent content={assignment.description} />
          </div>
        </CardContent>
      </Card>

      {/* Submissions */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-600" />
          Öğrenci Teslimleri
          {ungradedCount > 0 && (
            <Badge variant="warning">{ungradedCount} Notlandırılmamış</Badge>
          )}
        </h2>

        {submissions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={<ClipboardList className="h-8 w-8 text-gray-400" />}
                title="Henüz teslim yok"
                description="Bu ödeve henüz hiçbir öğrenci teslim yapmamış."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => {
              const student = getProfile(submission)
              const isGraded = submission.score !== null
              const isGrading = gradingSubmissionId === submission.id

              return (
                <Card key={submission.id}>
                  <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 space-y-0">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">
                          {student?.full_name ?? 'Bilinmeyen Öğrenci'}
                        </span>
                        <span className="text-xs text-gray-500">{student?.email ?? ''}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>Teslim: {formatDateTime(submission.submitted_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isGraded ? (
                        <Badge variant="success">
                          {submission.score} / {assignment.max_score} Puan
                        </Badge>
                      ) : (
                        <Badge variant="warning">Notlandırılmamış</Badge>
                      )}
                      {!isGrading && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startGrading(submission)}
                        >
                          <Award className="h-4 w-4" />
                          {isGraded ? 'Notu Düzenle' : 'Notlandır'}
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Student's submission content */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        Teslim İçeriği
                      </h4>
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                        <RichTextContent content={submission.content} />
                      </div>
                    </div>

                    {/* Grading form */}
                    {isGrading && (
                      <div className="border-t border-gray-200 pt-4">
                        <form onSubmit={(e) => handleSaveGrade(e, submission.id)} className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Puan (maks. {assignment.max_score})
                              </label>
                              <Input
                                type="number"
                                min={0}
                                max={assignment.max_score}
                                value={gradeScore}
                                onChange={(e) => setGradeScore(Number(e.target.value))}
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Geri Bildirim (Opsiyonel)
                            </label>
                            <TipTapEditor
                              key={`grade-${submission.id}`}
                              content={gradeFeedback}
                              onChange={setGradeFeedback}
                              placeholder="Öğrenciye geri bildirim yazın..."
                            />
                          </div>

                          <div className="flex justify-end gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={cancelGrading}
                              disabled={savingGrade}
                            >
                              İptal
                            </Button>
                            <Button type="submit" disabled={savingGrade}>
                              {savingGrade ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              {savingGrade ? 'Kaydediliyor...' : 'Notu Kaydet'}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Show existing feedback if graded and not editing */}
                    {isGraded && !isGrading && (
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-gray-500" />
                          Geri Bildirim
                        </h4>
                        {submission.feedback && submission.feedback !== '<p></p>' ? (
                          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                            <RichTextContent content={submission.feedback} />
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">
                            Geri bildirim eklenmemiş.
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
