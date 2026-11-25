'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { TipTapEditor } from '@/components/tiptap-editor'
import { RichTextContent } from '@/components/rich-text-content'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, formatDateTime, isOverdue } from '@/lib/utils'
import { assignmentSchema, assignmentUpdateSchema } from '@/lib/validations'
import type { Assignment, Course } from '@/lib/types'
import { toast } from 'sonner'
import {
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Clock,
  ArrowRight,
  Shield,
} from 'lucide-react'

type CourseOption = Pick<Course, 'id' | 'title'>

type AssignmentWithCourse = Assignment & {
  courses?: CourseOption | CourseOption[] | null
}

function getCourseTitle(assignment: AssignmentWithCourse): string {
  if (assignment.course?.title) return assignment.course.title
  if (Array.isArray(assignment.courses)) return assignment.courses[0]?.title ?? 'Ders'
  return assignment.courses?.title ?? 'Ders'
}

function normalizeEditorContent(html: string): string {
  return html === '<p></p>' ? '' : html.trim()
}

export default function TeacherAssignmentsPage() {
  const { profile, loading: authLoading } = useAuth()

  if (authLoading || !profile) return <LoadingSpinner />

  if (profile.role !== 'teacher') {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={<Shield className="h-8 w-8 text-red-500" />}
            title="Erişim Yetkisi Yok"
            description="Bu sayfaya yalnızca öğretmenler erişebilir."
          />
        </CardContent>
      </Card>
    )
  }

  return <AssignmentsList teacherId={profile.id} />
}

function AssignmentsList({ teacherId }: { teacherId: string }) {
  const [assignments, setAssignments] = useState<AssignmentWithCourse[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [maxScore, setMaxScore] = useState(100)
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCourseId, setEditCourseId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editMaxScore, setEditMaxScore] = useState(100)
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AssignmentWithCourse | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const supabase = createClient()

      const [coursesRes, assignmentsRes] = await Promise.all([
        supabase
          .from('courses')
          .select('id, title')
          .eq('teacher_id', teacherId)
          .order('title', { ascending: true }),
        supabase
          .from('assignments')
          .select('*, courses(id, title)')
          .eq('courses.teacher_id', teacherId)
          .order('due_date', { ascending: false }),
      ])

      if (coursesRes.error) {
        toast.error('Dersler yüklenirken bir hata oluştu')
      } else {
        const loadedCourses = coursesRes.data ?? []
        setCourses(loadedCourses)
        if (loadedCourses.length > 0) {
          setCourseId((prev) => prev || loadedCourses[0].id)
        }
      }

      if (assignmentsRes.error) {
        toast.error('Ödevler yüklenirken bir hata oluştu')
      } else {
        // Filter to only assignments that belong to this teacher's courses
        const courseIds = new Set((coursesRes.data ?? []).map((c: CourseOption) => c.id))
        const filtered = ((assignmentsRes.data ?? []) as AssignmentWithCourse[]).filter((a) =>
          courseIds.has(a.course_id)
        )
        setAssignments(filtered)
      }

      setLoading(false)
    }

    fetchData()
  }, [teacherId])

  const resetCreateForm = () => {
    setTitle('')
    setDescription('')
    setDueDate('')
    setMaxScore(100)
    setCourseId(courses[0]?.id ?? '')
    setShowCreateForm(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!courseId) {
      toast.error('Lütfen bir ders seçiniz')
      return
    }

    const result = assignmentSchema.safeParse({
      title: title.trim(),
      description: normalizeEditorContent(description),
      due_date: dueDate,
      max_score: maxScore,
    })

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Lütfen ödev alanlarını kontrol ediniz')
      return
    }

    setCreating(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('assignments')
      .insert({
        course_id: courseId,
        title: result.data.title,
        description: result.data.description,
        due_date: new Date(result.data.due_date).toISOString(),
        max_score: result.data.max_score,
      })
      .select('*, courses(id, title)')
      .single()

    if (error) {
      toast.error('Ödev oluşturulurken bir hata oluştu')
      setCreating(false)
      return
    }

    setAssignments((prev) => [data as AssignmentWithCourse, ...prev])
    toast.success('Ödev başarıyla oluşturuldu')
    setCreating(false)
    resetCreateForm()
  }

  const startEdit = (assignment: AssignmentWithCourse) => {
    setEditingId(assignment.id)
    setEditCourseId(assignment.course_id)
    setEditTitle(assignment.title)
    setEditDescription(assignment.description)
    const d = new Date(assignment.due_date)
    setEditDueDate(d.toISOString().slice(0, 16))
    setEditMaxScore(assignment.max_score)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const handleUpdate = async (e: React.FormEvent, assignmentId: string) => {
    e.preventDefault()

    if (!editCourseId) {
      toast.error('Lütfen bir ders seçiniz')
      return
    }

    const result = assignmentUpdateSchema.safeParse({
      title: editTitle.trim(),
      description: normalizeEditorContent(editDescription),
      due_date: editDueDate,
      max_score: editMaxScore,
    })

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Lütfen ödev alanlarını kontrol ediniz')
      return
    }

    setSavingEdit(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('assignments')
      .update({
        course_id: editCourseId,
        title: result.data.title,
        description: result.data.description,
        due_date: new Date(result.data.due_date).toISOString(),
        max_score: result.data.max_score,
      })
      .eq('id', assignmentId)
      .select('*, courses(id, title)')
      .single()

    if (error) {
      toast.error('Ödev güncellenirken bir hata oluştu')
      setSavingEdit(false)
      return
    }

    setAssignments((prev) =>
      prev.map((item) => (item.id === assignmentId ? (data as AssignmentWithCourse) : item))
    )
    toast.success('Ödev başarıyla güncellendi')
    setSavingEdit(false)
    cancelEdit()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    const supabase = createClient()

    const { error } = await supabase.from('assignments').delete().eq('id', deleteTarget.id)

    if (error) {
      toast.error('Ödev silinirken bir hata oluştu')
      setDeleting(false)
      return
    }

    setAssignments((prev) => prev.filter((item) => item.id !== deleteTarget.id))
    if (editingId === deleteTarget.id) cancelEdit()
    toast.success('Ödev başarıyla silindi')
    setDeleting(false)
    setDeleteTarget(null)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ödev Yönetimi</h1>
          <p className="text-gray-500 mt-1">
            Derslerinize ödev ekleyin, düzenleyin ve öğrenci teslimlerini değerlendirin.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setShowCreateForm((prev) => !prev)}
          disabled={courses.length === 0}
        >
          <Plus className="h-4 w-4" />
          {showCreateForm ? 'Formu Kapat' : 'Yeni Ödev'}
        </Button>
      </div>

      {courses.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Ödev oluşturabilmek için önce en az bir ders oluşturmalısınız.{' '}
              <Link href="/panel/derslerim" className="underline font-medium">
                Derslerim sayfasına git →
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {showCreateForm && courses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              Yeni Ödev Oluştur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="create-course" className="block text-sm font-medium text-gray-700 mb-1">
                  Ders
                </label>
                <select
                  id="create-course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  required
                >
                  <option value="">Ders seçiniz...</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="create-title" className="block text-sm font-medium text-gray-700 mb-1">
                  Ödev Başlığı
                </label>
                <Input
                  id="create-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ödev başlığını giriniz..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ödev Açıklaması</label>
                <TipTapEditor
                  content={description}
                  onChange={setDescription}
                  placeholder="Ödev açıklamasını yazın..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="create-due-date" className="block text-sm font-medium text-gray-700 mb-1">
                    Son Teslim Tarihi
                  </label>
                  <Input
                    id="create-due-date"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="create-max-score" className="block text-sm font-medium text-gray-700 mb-1">
                    Maksimum Puan
                  </label>
                  <Input
                    id="create-max-score"
                    type="number"
                    min={1}
                    max={1000}
                    value={maxScore}
                    onChange={(e) => setMaxScore(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={resetCreateForm} disabled={creating}>
                  İptal
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {creating ? 'Oluşturuluyor...' : 'Ödev Oluştur'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<ClipboardList className="h-8 w-8 text-gray-400" />}
              title="Henüz ödev oluşturmadınız"
              description="Derslerinize yeni ödevler ekleyerek öğrencilerinize görev verebilirsiniz."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const isEditing = editingId === assignment.id
            const overdue = isOverdue(assignment.due_date)

            return (
              <Card key={assignment.id}>
                {isEditing ? (
                  <>
                    <CardHeader>
                      <CardTitle className="text-lg">Ödevi Düzenle</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={(e) => handleUpdate(e, assignment.id)} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ders</label>
                          <select
                            value={editCourseId}
                            onChange={(e) => setEditCourseId(e.target.value)}
                            className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                            required
                          >
                            <option value="">Ders seçiniz...</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ödev Başlığı</label>
                          <Input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ödev Açıklaması</label>
                          <TipTapEditor
                            key={assignment.id}
                            content={editDescription}
                            onChange={setEditDescription}
                            placeholder="Ödev açıklamasını yazın..."
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Son Teslim Tarihi</label>
                            <Input
                              type="datetime-local"
                              value={editDueDate}
                              onChange={(e) => setEditDueDate(e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Maksimum Puan</label>
                            <Input
                              type="number"
                              min={1}
                              max={1000}
                              value={editMaxScore}
                              onChange={(e) => setEditMaxScore(Number(e.target.value))}
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                          <Button type="button" variant="outline" onClick={cancelEdit} disabled={savingEdit}>
                            İptal
                          </Button>
                          <Button type="submit" disabled={savingEdit}>
                            {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                            {savingEdit ? 'Kaydediliyor...' : 'Kaydet'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 space-y-0">
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge>{getCourseTitle(assignment)}</Badge>
                          {overdue ? (
                            <Badge variant="destructive">Süresi Geçti</Badge>
                          ) : (
                            <Badge variant="success">Açık</Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg text-gray-900">{assignment.title}</CardTitle>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Son Teslim: {formatDateTime(assignment.due_date)}
                          </span>
                          <span>Maks. Puan: {assignment.max_score}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/panel/odev-yonetimi/${assignment.id}`}>
                          <Button type="button" variant="outline" size="sm">
                            Teslimleri Gör <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(assignment)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(assignment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <RichTextContent content={assignment.description} />
                    </CardContent>
                  </>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Ödevi Sil"
        description={`"${deleteTarget?.title ?? ''}" ödevini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
        cancelText="İptal"
        variant="destructive"
        loading={deleting}
      />
    </div>
  )
}
