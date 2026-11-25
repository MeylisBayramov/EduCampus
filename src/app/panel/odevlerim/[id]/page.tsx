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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingSpinner } from '@/components/ui/loading'
import { formatDate, formatDateTime, isOverdue } from '@/lib/utils'
import { submissionSchema } from '@/lib/validations'
import type { Assignment, Course, Submission } from '@/lib/types'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  Pencil,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'

type AssignmentWithCourse = Assignment & {
  course?: Pick<Course, 'id' | 'title' | 'teacher_id'>
}

export default function StudentAssignmentDetailPage() {
  const params = useParams()
  const assignmentId = Array.isArray(params.id) ? params.id[0] : params.id
  const { profile, loading: authLoading } = useAuth()

  const [assignment, setAssignment] = useState<AssignmentWithCourse | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  useEffect(() => {
    const fetchAssignmentData = async () => {
      if (!profile || !assignmentId) {
        if (!authLoading) setLoading(false)
        return
      }

      if (profile.role !== 'student') {
        setAccessDenied('Bu sayfaya yalnızca öğrenciler erişebilir.')
        setLoading(false)
        return
      }

      setLoading(true)
      setAccessDenied(null)
      const supabase = createClient()

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('*, courses(id, title, teacher_id)')
        .eq('id', assignmentId)
        .maybeSingle()

      if (assignmentError || !assignmentData) {
        setAccessDenied('Ödev bulunamadı veya bu ödeve erişim yetkiniz yok.')
        setLoading(false)
        return
      }

      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('id, status')
        .eq('course_id', assignmentData.course_id)
        .eq('student_id', profile.id)
        .eq('status', 'approved')
        .maybeSingle()

      if (enrollmentError || !enrollmentData) {
        setAccessDenied('Bu ödevi görüntüleyebilmek için ilgili derse onaylı kaydınızın bulunması gerekir.')
        setLoading(false)
        return
      }

      const { data: submissionData, error: submissionError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', profile.id)
        .maybeSingle()

      if (submissionError) {
        toast.error('Teslim bilgisi yüklenirken bir hata oluştu.')
      }

      const formattedAssignment: AssignmentWithCourse = {
        ...assignmentData,
        course: (assignmentData as Assignment & { courses?: Pick<Course, 'id' | 'title' | 'teacher_id'> }).courses,
      }

      setAssignment(formattedAssignment)
      setSubmission(submissionData ?? null)
      setContent(submissionData?.content ?? '')
      setLoading(false)
    }

    if (!authLoading) {
      fetchAssignmentData()
    }
  }, [assignmentId, profile, authLoading])

  const validateContent = (rawContent: string): string | null => {
    const cleaned = rawContent === '<p></p>' ? '' : rawContent.trim()
    const plainText = cleaned.replace(/<[^>]*>/g, '').trim()
    const result = submissionSchema.safeParse({
      content: plainText.length === 0 ? '' : cleaned,
    })

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Lütfen teslim içeriğini kontrol edin.')
      return null
    }

    return result.data.content
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignment || !profile) return

    if (isOverdue(assignment.due_date)) {
      toast.error('Süresi geçti, teslim yapılamaz.')
      return
    }

    const validContent = validateContent(content)
    if (!validContent) return

    setSubmitting(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        assignment_id: assignment.id,
        student_id: profile.id,
        content: validContent,
      })
      .select()
      .single()

    if (error) {
      toast.error('Ödev teslim edilirken bir hata oluştu.')
      setSubmitting(false)
      return
    }

    setSubmission(data)
    setContent(data.content)
    toast.success('Ödeviniz başarıyla teslim edildi.')
    setSubmitting(false)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignment || !submission) return

    if (submission.score !== null) {
      toast.error('Notlandırılmış teslim düzenlenemez.')
      return
    }

    if (isOverdue(assignment.due_date)) {
      toast.error('Süresi geçti, teslim düzenlenemez.')
      return
    }

    const validContent = validateContent(content)
    if (!validContent) return

    setSubmitting(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('submissions')
      .update({
        content: validContent,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', submission.id)
      .select()
      .single()

    if (error) {
      toast.error('Teslim güncellenirken bir hata oluştu.')
      setSubmitting(false)
      return
    }

    setSubmission(data)
    setContent(data.content)
    setIsEditing(false)
    toast.success('Tesliminiz başarıyla güncellendi.')
    setSubmitting(false)
  }

  const handleWithdraw = async () => {
    if (!assignment || !submission) return

    if (submission.score !== null) {
      toast.error('Notlandırılmış teslim geri çekilemez.')
      setWithdrawDialogOpen(false)
      return
    }

    if (isOverdue(assignment.due_date)) {
      toast.error('Süresi geçti, teslim geri çekilemez.')
      setWithdrawDialogOpen(false)
      return
    }

    setWithdrawing(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', submission.id)

    if (error) {
      toast.error('Teslim geri çekilirken bir hata oluştu.')
      setWithdrawing(false)
      return
    }

    setSubmission(null)
    setContent('')
    setIsEditing(false)
    setWithdrawDialogOpen(false)
    toast.success('Tesliminiz başarıyla geri çekildi.')
    setWithdrawing(false)
  }

  if (authLoading || loading) {
    return <LoadingSpinner />
  }

  if (accessDenied || !assignment) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/panel/odevlerim">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Ödevlerime Dön
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
              <Link href="/panel/odevlerim">
                <Button variant="outline" className="mt-2">
                  Ödev Listesine Git
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const overdue = isOverdue(assignment.due_date)
  const isSubmitted = submission !== null
  const isGraded = submission !== null && submission.score !== null
  const canEditOrWithdraw = isSubmitted && !isGraded && !overdue

  const renderStatusBadge = () => {
    if (isGraded) {
      return <Badge variant="success">Notlandırıldı</Badge>
    }
    if (isSubmitted) {
      return <Badge variant="default">Teslim Edildi</Badge>
    }
    if (overdue) {
      return <Badge variant="destructive">Süresi Geçti</Badge>
    }
    return <Badge variant="warning">Teslim Bekliyor</Badge>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/panel/odevlerim">
          <Button variant="ghost" size="sm" className="gap-2 mb-3 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Ödevlerime Dön
          </Button>
        </Link>
      </div>

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
            {renderStatusBadge()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <Clock className={`h-5 w-5 shrink-0 ${overdue ? 'text-red-500' : 'text-blue-600'}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Son Teslim Tarihi</p>
                <p className={`text-sm font-medium mt-0.5 ${overdue ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatDateTime(assignment.due_date)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <Award className="h-5 w-5 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Maksimum Puan</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {assignment.max_score} puan
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <Calendar className="h-5 w-5 shrink-0 text-gray-500" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Oluşturulma Tarihi</p>
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {formatDate(assignment.created_at)}
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

      {isGraded && submission && (
        <Card className="border-green-200 bg-green-50/40">
          <CardHeader>
            <CardTitle className="text-lg text-green-800 flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              Değerlendirme Sonucu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white border border-green-200 p-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Alınan Puan</p>
                <p className="text-2xl font-bold text-green-700 mt-0.5">
                  {submission.score} <span className="text-base font-medium text-gray-500">/ {assignment.max_score}</span>
                </p>
              </div>
              <Badge variant="success">Notlandırıldı</Badge>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                Öğretmen Geri Bildirimi
              </h4>
              {submission.feedback && submission.feedback !== '<p></p>' ? (
                <div className="rounded-lg bg-white border border-gray-200 p-4">
                  <RichTextContent content={submission.feedback} />
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  Öğretmen tarafından geri bildirim eklenmemiş.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg flex items-center gap-2">
            {isSubmitted ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Send className="h-5 w-5 text-blue-600" />
            )}
            Ödev Teslimi
          </CardTitle>

          {canEditOrWithdraw && !isEditing && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setContent(submission.content)
                  setIsEditing(true)
                }}
              >
                <Pencil className="h-4 w-4" />
                Düzenle
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setWithdrawDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Geri Çek
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isSubmitted && submission ? (
            isEditing && canEditOrWithdraw ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teslim İçeriğini Düzenle
                  </label>
                  <TipTapEditor
                    key={`edit-${submission.id}`}
                    content={content}
                    onChange={setContent}
                    placeholder="Ödev tesliminizi buraya yazın..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setContent(submission.content)
                      setIsEditing(false)
                    }}
                    disabled={submitting}
                  >
                    <X className="h-4 w-4" />
                    İptal
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Değişiklikleri Kaydet
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                  <span>
                    Teslim Tarihi:{' '}
                    <strong className="text-gray-900">
                      {formatDateTime(submission.submitted_at)}
                    </strong>
                  </span>
                </div>

                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <RichTextContent content={submission.content} />
                </div>

                {isGraded && (
                  <p className="text-xs text-gray-500">
                    Bu ödev notlandırıldığı için tesliminiz üzerinde düzenleme veya geri çekme işlemi yapılamaz.
                  </p>
                )}

                {!isGraded && overdue && (
                  <p className="text-xs text-red-600">
                    Son teslim tarihi geçtiği için tesliminizi düzenleyemez veya geri çekemezsiniz.
                  </p>
                )}
              </div>
            )
          ) : overdue ? (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              <Clock className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">Süresi geçti, teslim yapılamaz</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Teslim İçeriği
                </label>
                <TipTapEditor
                  key="new-submission"
                  content={content}
                  onChange={setContent}
                  placeholder="Ödev yanıtınızı veya teslim içeriğinizi buraya yazın..."
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Ödevi Teslim Et
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={withdrawDialogOpen}
        onClose={() => {
          if (!withdrawing) setWithdrawDialogOpen(false)
        }}
        onConfirm={handleWithdraw}
        title="Teslimi Geri Çek"
        description="Ödev tesliminizi geri çekmek istediğinize emin misiniz? Bu işlem tesliminizi kalıcı olarak silecektir."
        confirmText="Evet, Geri Çek"
        cancelText="İptal"
        variant="destructive"
        loading={withdrawing}
      />
    </div>
  )
}
