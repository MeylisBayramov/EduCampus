'use client'

import { useEffect, useState } from 'react'
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
import { formatDate } from '@/lib/utils'
import { courseSchema } from '@/lib/validations'
import type { Course, Enrollment, Profile } from '@/lib/types'
import { toast } from 'sonner'
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Users,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  UserPlus,
  UserX,
  Search,
} from 'lucide-react'

type EnrollmentWithStudent = Enrollment & { profiles?: Profile | Profile[] | null }

type CourseWithMeta = Course & {
  enrollments?: EnrollmentWithStudent[]
}

function normalizeEditorContent(html: string): string {
  return html === '<p></p>' ? '' : html.trim()
}

export default function CoursesPage() {
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

  return <TeacherCourses teacherId={profile.id} />
}

function TeacherCourses({ teacherId }: { teacherId: string }) {
  const [courses, setCourses] = useState<CourseWithMeta[]>([])
  const [allStudents, setAllStudents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<CourseWithMeta | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null)
  const [updatingEnrollment, setUpdatingEnrollment] = useState<string | null>(null)

  // Öğrenci ekleme modalı state'leri
  const [addStudentModalCourse, setAddStudentModalCourse] = useState<CourseWithMeta | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [addingStudent, setAddingStudent] = useState(false)

  // Öğrenciyi dersten çıkarma state'i
  const [removeEnrollmentTarget, setRemoveEnrollmentTarget] = useState<{ id: string; studentName: string } | null>(null)
  const [removingEnrollment, setRemovingEnrollment] = useState(false)

  const fetchCourses = async () => {
    setLoading(true)
    const supabase = createClient()

    const [coursesRes, studentsRes] = await Promise.all([
      supabase
        .from('courses')
        .select('*, enrollments(*, profiles(*))')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('full_name', { ascending: true }),
    ])

    if (coursesRes.error) {
      toast.error('Dersler yüklenirken bir hata oluştu')
    } else {
      setCourses((coursesRes.data as CourseWithMeta[]) ?? [])
    }

    if (!studentsRes.error && studentsRes.data) {
      setAllStudents(studentsRes.data)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchCourses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId])

  const resetCreateForm = () => {
    setTitle('')
    setDescription('')
    setContent('')
    setShowCreateForm(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    const result = courseSchema.safeParse({
      title: title.trim(),
      description: description.trim(),
      content: normalizeEditorContent(content),
    })

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Lütfen ders alanlarını kontrol ediniz')
      return
    }

    setCreating(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('courses')
      .insert({
        teacher_id: teacherId,
        title: result.data.title,
        description: result.data.description,
        content: result.data.content,
      })
      .select('*, enrollments(*, profiles(*))')
      .single()

    if (error) {
      toast.error('Ders oluşturulurken bir hata oluştu')
      setCreating(false)
      return
    }

    setCourses((prev) => [data as CourseWithMeta, ...prev])
    toast.success('Ders başarıyla oluşturuldu')
    setCreating(false)
    resetCreateForm()
  }

  const startEdit = (course: CourseWithMeta) => {
    setEditingId(course.id)
    setEditTitle(course.title)
    setEditDescription(course.description)
    setEditContent(course.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditDescription('')
    setEditContent('')
  }

  const handleUpdate = async (e: React.FormEvent, courseId: string) => {
    e.preventDefault()

    const result = courseSchema.safeParse({
      title: editTitle.trim(),
      description: editDescription.trim(),
      content: normalizeEditorContent(editContent),
    })

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Lütfen ders alanlarını kontrol ediniz')
      return
    }

    setSavingEdit(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('courses')
      .update({
        title: result.data.title,
        description: result.data.description,
        content: result.data.content,
      })
      .eq('id', courseId)
      .eq('teacher_id', teacherId)
      .select('*, enrollments(*, profiles(*))')
      .single()

    if (error) {
      toast.error('Ders güncellenirken bir hata oluştu')
      setSavingEdit(false)
      return
    }

    setCourses((prev) =>
      prev.map((item) => (item.id === courseId ? (data as CourseWithMeta) : item))
    )
    toast.success('Ders başarıyla güncellendi')
    setSavingEdit(false)
    cancelEdit()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('teacher_id', teacherId)

    if (error) {
      toast.error('Ders silinirken bir hata oluştu')
      setDeleting(false)
      return
    }

    setCourses((prev) => prev.filter((item) => item.id !== deleteTarget.id))
    if (editingId === deleteTarget.id) cancelEdit()
    toast.success('Ders başarıyla silindi')
    setDeleting(false)
    setDeleteTarget(null)
  }

  const handleEnrollmentAction = async (enrollmentId: string, status: 'approved' | 'rejected') => {
    setUpdatingEnrollment(enrollmentId)
    const supabase = createClient()

    const { error } = await supabase
      .from('enrollments')
      .update({ status })
      .eq('id', enrollmentId)

    if (error) {
      toast.error('Kayıt durumu güncellenirken bir hata oluştu')
    } else {
      toast.success(status === 'approved' ? 'Kayıt onaylandı' : 'Kayıt reddedildi')
      await fetchCourses()
    }
    setUpdatingEnrollment(null)
  }

  // Öğretmenin derse öğrenci eklemesi
  const handleAddStudentToCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addStudentModalCourse || !selectedStudentId) {
      toast.error('Lütfen bir öğrenci seçiniz')
      return
    }

    setAddingStudent(true)
    try {
      const res = await fetch('/api/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: addStudentModalCourse.id,
          studentId: selectedStudentId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Öğrenci eklenemedi')
      }

      toast.success('Öğrenci derse başarıyla eklendi!')
      setAddStudentModalCourse(null)
      setSelectedStudentId('')
      setStudentSearch('')
      await fetchCourses()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bir hata oluştu'
      toast.error(message)
    } finally {
      setAddingStudent(false)
    }
  }

  // Öğretmenin öğrenciyi dersten çıkarması
  const handleRemoveEnrollmentConfirm = async () => {
    if (!removeEnrollmentTarget) return

    setRemovingEnrollment(true)
    try {
      const res = await fetch('/api/admin/enrollments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId: removeEnrollmentTarget.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Öğrenci dersten çıkarılamadı')
      }

      toast.success('Öğrenci dersten çıkarıldı')
      setRemoveEnrollmentTarget(null)
      await fetchCourses()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bir hata oluştu'
      toast.error(message)
    } finally {
      setRemovingEnrollment(false)
    }
  }

  const getStudentName = (enrollment: EnrollmentWithStudent): string => {
    if (!enrollment.profiles) return 'Bilinmeyen'
    const p = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles
    return p?.full_name ?? 'Bilinmeyen'
  }

  const getStudentEmail = (enrollment: EnrollmentWithStudent): string => {
    if (!enrollment.profiles) return ''
    const p = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles
    return p?.email ?? ''
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Derslerim</h1>
          <p className="text-gray-500 mt-1">
            Derslerinizi oluşturun, düzenleyin ve öğrenci kayıtlarını yönetin.
          </p>
        </div>

        <Button type="button" onClick={() => setShowCreateForm((prev) => !prev)}>
          <Plus className="h-4 w-4" />
          {showCreateForm ? 'Formu Kapat' : 'Yeni Ders'}
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Yeni Ders Oluştur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="create-title" className="block text-sm font-medium text-gray-700 mb-1">
                  Ders Başlığı
                </label>
                <Input
                  id="create-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ders başlığını giriniz..."
                  required
                />
              </div>

              <div>
                <label htmlFor="create-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Kısa Açıklama
                </label>
                <Input
                  id="create-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kısa ders açıklaması..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ders İçeriği
                </label>
                <TipTapEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Ders içeriğini yazın..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={resetCreateForm} disabled={creating}>
                  İptal
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {creating ? 'Oluşturuluyor...' : 'Ders Oluştur'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {courses.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<BookOpen className="h-8 w-8 text-gray-400" />}
              title="Henüz ders oluşturmadınız"
              description="Öğrencileriniz için yeni bir ders oluşturarak başlayın."
              action={
                !showCreateForm ? (
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="h-4 w-4" /> İlk Dersimi Oluştur
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => {
            const isEditing = editingId === course.id
            const isExpanded = expandedCourseId === course.id
            const enrollments = course.enrollments ?? []
            const approvedCount = enrollments.filter((e) => e.status === 'approved').length
            const pendingCount = enrollments.filter((e) => e.status === 'pending').length

            return (
              <Card key={course.id}>
                {isEditing ? (
                  <>
                    <CardHeader>
                      <CardTitle className="text-lg">Dersi Düzenle</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={(e) => handleUpdate(e, course.id)} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ders Başlığı</label>
                          <Input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Kısa Açıklama</label>
                          <Input
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Ders İçeriği</label>
                          <TipTapEditor
                            key={course.id}
                            content={editContent}
                            onChange={setEditContent}
                            placeholder="Ders içeriğini yazın..."
                          />
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
                          <Badge variant="secondary">{formatDate(course.created_at)}</Badge>
                          <Badge className="bg-blue-100 text-blue-800">
                            <Users className="h-3 w-3 mr-1" />
                            {approvedCount} Öğrenci
                          </Badge>
                          {pendingCount > 0 && (
                            <Badge variant="warning">
                              <Clock className="h-3 w-3 mr-1" />
                              {pendingCount} Bekleyen
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg text-gray-900">{course.title}</CardTitle>
                        <p className="text-sm text-gray-500">{course.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(course)}>
                          <Edit2 className="h-4 w-4" /> Düzenle
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(course)}
                        >
                          <Trash2 className="h-4 w-4" /> Sil
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <RichTextContent content={course.content} />

                      {/* Enrollments section */}
                      <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors py-1"
                          >
                            <Users className="h-4 w-4" />
                            <span>Kayıtlı Öğrenciler ({enrollments.length})</span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                            onClick={() => {
                              setAddStudentModalCourse(course)
                              setSelectedStudentId('')
                              setStudentSearch('')
                            }}
                          >
                            <UserPlus className="h-4 w-4" />
                            <span>Öğrenci Ekle</span>
                          </Button>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-2">
                            {enrollments.length === 0 ? (
                              <p className="text-xs text-gray-500 italic py-2">
                                Bu derse henüz kayıtlı öğrenci yok. Yukarıdaki &quot;Öğrenci Ekle&quot; butonuyla öğrenci ekleyebilirsiniz.
                              </p>
                            ) : (
                              enrollments.map((enrollment) => (
                                <div
                                  key={enrollment.id}
                                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900">{getStudentName(enrollment)}</p>
                                    <p className="text-xs text-gray-500">{getStudentEmail(enrollment)}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {enrollment.status === 'pending' ? (
                                      <>
                                        <Button
                                          type="button"
                                          size="sm"
                                          disabled={updatingEnrollment === enrollment.id}
                                          onClick={() => handleEnrollmentAction(enrollment.id, 'approved')}
                                        >
                                          <CheckCircle2 className="h-4 w-4" /> Onayla
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          disabled={updatingEnrollment === enrollment.id}
                                          onClick={() => handleEnrollmentAction(enrollment.id, 'rejected')}
                                        >
                                          <XCircle className="h-4 w-4" /> Reddet
                                        </Button>
                                      </>
                                    ) : enrollment.status === 'approved' ? (
                                      <Badge variant="success">Onaylı</Badge>
                                    ) : (
                                      <Badge variant="destructive">Reddedildi</Badge>
                                    )}

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 h-auto"
                                      title="Dersten Çıkar"
                                      onClick={() =>
                                        setRemoveEnrollmentTarget({
                                          id: enrollment.id,
                                          studentName: getStudentName(enrollment),
                                        })
                                      }
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
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
        title="Dersi Sil"
        description={`"${deleteTarget?.title ?? ''}" dersini silmek istediğinize emin misiniz? Bu işlem dersin tüm ödevlerini, duyurularını ve kayıtlarını da silecektir. Bu işlem geri alınamaz.`}
        confirmText="Sil"
        cancelText="İptal"
        variant="destructive"
        loading={deleting}
      />

      {/* Öğrenci Çıkar Onay Diyaloğu */}
      <ConfirmDialog
        open={Boolean(removeEnrollmentTarget)}
        onClose={() => {
          if (!removingEnrollment) setRemoveEnrollmentTarget(null)
        }}
        onConfirm={handleRemoveEnrollmentConfirm}
        title="Öğrenciyi Dersten Çıkar"
        description={`${removeEnrollmentTarget?.studentName ?? 'Bu öğrenci'} adlı öğrenciyi dersten çıkarmak istediğinize emin misiniz?`}
        confirmText="Dersten Çıkar"
        cancelText="İptal"
        variant="destructive"
        loading={removingEnrollment}
      />

      {/* Öğrenci Ekle Modalı */}
      {addStudentModalCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Derse Öğrenci Ekle</h3>
                  <p className="text-xs text-gray-500">{addStudentModalCourse.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddStudentModalCourse(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudentToCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Öğrenci Seçin
                </label>

                {/* Arama Kutusu */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Öğrenci ara (ad veya e-posta)..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>

                {/* Öğrenci Listesi / Seçim */}
                {(() => {
                  const enrolledStudentIds = new Set(
                    (addStudentModalCourse.enrollments ?? []).map((e) => e.student_id)
                  )
                  const filteredStudents = allStudents
                    .filter((s) => !enrolledStudentIds.has(s.id))
                    .filter(
                      (s) =>
                        !studentSearch ||
                        s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                        s.email.toLowerCase().includes(studentSearch.toLowerCase())
                    )

                  if (allStudents.length === 0) {
                    return (
                      <p className="text-xs text-gray-500 py-3 text-center bg-gray-50 rounded-lg">
                        Sistemde kayıtlı öğrenci bulunamadı.
                      </p>
                    )
                  }

                  if (filteredStudents.length === 0) {
                    return (
                      <p className="text-xs text-gray-500 py-3 text-center bg-gray-50 rounded-lg">
                        Tüm öğrenciler zaten bu derse eklenmiş veya aramayla eşleşen öğrenci yok.
                      </p>
                    )
                  }

                  return (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-200 rounded-lg p-2">
                      {filteredStudents.map((student) => (
                        <label
                          key={student.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                            selectedStudentId === student.id
                              ? 'border-blue-500 bg-blue-50 text-blue-900 font-medium'
                              : 'border-transparent hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-medium truncate">{student.full_name}</p>
                            <p className="text-xs text-gray-500 truncate">{student.email}</p>
                          </div>
                          <input
                            type="radio"
                            name="selectedStudent"
                            value={student.id}
                            checked={selectedStudentId === student.id}
                            onChange={() => setSelectedStudentId(student.id)}
                            className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                        </label>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddStudentModalCourse(null)}
                  disabled={addingStudent}
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  disabled={addingStudent || !selectedStudentId}
                  className="gap-2"
                >
                  {addingStudent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {addingStudent ? 'Ekleniyor...' : 'Derse Ekle'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
