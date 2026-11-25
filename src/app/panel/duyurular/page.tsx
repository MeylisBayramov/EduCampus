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
import { announcementSchema } from '@/lib/validations'
import type { Announcement, Course } from '@/lib/types'
import { toast } from 'sonner'
import { Megaphone, Plus, Edit2, Trash2, Loader2 } from 'lucide-react'

type CourseOption = Pick<Course, 'id' | 'title'>

type AnnouncementWithCourse = Announcement & {
  courses?: CourseOption | CourseOption[] | null
}

function getCourseTitle(announcement: AnnouncementWithCourse): string {
  if (announcement.course?.title) return announcement.course.title
  if (Array.isArray(announcement.courses)) {
    return announcement.courses[0]?.title ?? 'Ders'
  }
  return announcement.courses?.title ?? 'Ders'
}

function normalizeEditorContent(html: string): string {
  return html === '<p></p>' ? '' : html.trim()
}

export default function AnnouncementsPage() {
  const { profile, loading: authLoading } = useAuth()

  if (authLoading || !profile) {
    return <LoadingSpinner />
  }

  return profile.role === 'teacher' ? (
    <TeacherAnnouncements teacherId={profile.id} />
  ) : (
    <StudentAnnouncements studentId={profile.id} />
  )
}

function TeacherAnnouncements({ teacherId }: { teacherId: string }) {
  const [announcements, setAnnouncements] = useState<AnnouncementWithCourse[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [loading, setLoading] = useState(true)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCourseId, setEditCourseId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AnnouncementWithCourse | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const supabase = createClient()

      const [coursesRes, announcementsRes] = await Promise.all([
        supabase
          .from('courses')
          .select('id, title')
          .eq('teacher_id', teacherId)
          .order('title', { ascending: true }),
        supabase
          .from('announcements')
          .select('*, courses(id, title)')
          .eq('teacher_id', teacherId)
          .order('created_at', { ascending: false }),
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

      if (announcementsRes.error) {
        toast.error('Duyurular yüklenirken bir hata oluştu')
      } else {
        setAnnouncements((announcementsRes.data as AnnouncementWithCourse[]) ?? [])
      }

      setLoading(false)
    }

    fetchData()
  }, [teacherId])

  const resetCreateForm = () => {
    setTitle('')
    setContent('')
    setCourseId(courses[0]?.id ?? '')
    setShowCreateForm(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!courseId) {
      toast.error('Lütfen bir ders seçiniz')
      return
    }

    const result = announcementSchema.safeParse({
      title: title.trim(),
      content: normalizeEditorContent(content),
    })

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Lütfen duyuru alanlarını kontrol ediniz')
      return
    }

    setCreating(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        course_id: courseId,
        teacher_id: teacherId,
        title: result.data.title,
        content: result.data.content,
      })
      .select('*, courses(id, title)')
      .single()

    if (error) {
      toast.error('Duyuru oluşturulurken bir hata oluştu')
      setCreating(false)
      return
    }

    setAnnouncements((prev) => [data as AnnouncementWithCourse, ...prev])
    toast.success('Duyuru başarıyla oluşturuldu')
    setCreating(false)
    resetCreateForm()
  }

  const startEdit = (announcement: AnnouncementWithCourse) => {
    setEditingId(announcement.id)
    setEditCourseId(announcement.course_id)
    setEditTitle(announcement.title)
    setEditContent(announcement.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditCourseId('')
    setEditTitle('')
    setEditContent('')
  }

  const handleUpdate = async (e: React.FormEvent, announcementId: string) => {
    e.preventDefault()

    if (!editCourseId) {
      toast.error('Lütfen bir ders seçiniz')
      return
    }

    const result = announcementSchema.safeParse({
      title: editTitle.trim(),
      content: normalizeEditorContent(editContent),
    })

    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? 'Lütfen duyuru alanlarını kontrol ediniz')
      return
    }

    setSavingEdit(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('announcements')
      .update({
        course_id: editCourseId,
        title: result.data.title,
        content: result.data.content,
      })
      .eq('id', announcementId)
      .eq('teacher_id', teacherId)
      .select('*, courses(id, title)')
      .single()

    if (error) {
      toast.error('Duyuru güncellenirken bir hata oluştu')
      setSavingEdit(false)
      return
    }

    setAnnouncements((prev) =>
      prev.map((item) =>
        item.id === announcementId ? (data as AnnouncementWithCourse) : item
      )
    )
    toast.success('Duyuru başarıyla güncellendi')
    setSavingEdit(false)
    cancelEdit()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('teacher_id', teacherId)

    if (error) {
      toast.error('Duyuru silinirken bir hata oluştu')
      setDeleting(false)
      return
    }

    setAnnouncements((prev) => prev.filter((item) => item.id !== deleteTarget.id))
    if (editingId === deleteTarget.id) {
      cancelEdit()
    }
    toast.success('Duyuru başarıyla silindi')
    setDeleting(false)
    setDeleteTarget(null)
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Duyurular</h1>
          <p className="text-gray-500 mt-1">
            Dersleriniz için duyuru oluşturun, düzenleyin ve yönetin.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setShowCreateForm((prev) => !prev)}
          disabled={courses.length === 0}
        >
          <Plus className="h-4 w-4" />
          {showCreateForm ? 'Formu Kapat' : 'Yeni Duyuru'}
        </Button>
      </div>

      {courses.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Duyuru oluşturabilmek için önce en az bir ders oluşturmalısınız.
            </p>
          </CardContent>
        </Card>
      )}

      {showCreateForm && courses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-blue-600" />
              Yeni Duyuru Oluştur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label
                  htmlFor="create-course"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
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
                <label
                  htmlFor="create-title"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Duyuru Başlığı
                </label>
                <Input
                  id="create-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Duyuru başlığını giriniz..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duyuru İçeriği
                </label>
                <TipTapEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Duyuru içeriğini yazın..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetCreateForm}
                  disabled={creating}
                >
                  İptal
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {creating ? 'Yayınlanıyor...' : 'Duyuru Yayınla'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<Megaphone className="h-8 w-8 text-gray-400" />}
              title="Henüz duyuru yok"
              description="Öğrencilerinizi bilgilendirmek için yeni bir duyuru oluşturabilirsiniz."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => {
            const isEditing = editingId === announcement.id

            return (
              <Card key={announcement.id}>
                {isEditing ? (
                  <>
                    <CardHeader>
                      <CardTitle className="text-lg">Duyuruyu Düzenle</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form
                        onSubmit={(e) => handleUpdate(e, announcement.id)}
                        className="space-y-4"
                      >
                        <div>
                          <label
                            htmlFor={`edit-course-${announcement.id}`}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Ders
                          </label>
                          <select
                            id={`edit-course-${announcement.id}`}
                            value={editCourseId}
                            onChange={(e) => setEditCourseId(e.target.value)}
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
                          <label
                            htmlFor={`edit-title-${announcement.id}`}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Duyuru Başlığı
                          </label>
                          <Input
                            id={`edit-title-${announcement.id}`}
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Duyuru başlığını giriniz..."
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Duyuru İçeriği
                          </label>
                          <TipTapEditor
                            key={announcement.id}
                            content={editContent}
                            onChange={setEditContent}
                            placeholder="Duyuru içeriğini yazın..."
                          />
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={cancelEdit}
                            disabled={savingEdit}
                          >
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
                          <Badge>{getCourseTitle(announcement)}</Badge>
                          <span className="text-xs text-gray-500">
                            {formatDate(announcement.created_at)}
                          </span>
                        </div>
                        <CardTitle className="text-lg text-gray-900">
                          {announcement.title}
                        </CardTitle>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(announcement)}
                        >
                          <Edit2 className="h-4 w-4" />
                          Düzenle
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(announcement)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Sil
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <RichTextContent content={announcement.content} />
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
        title="Duyuruyu Sil"
        description={`"${deleteTarget?.title ?? ''}" başlıklı duyuruyu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        confirmText="Sil"
        cancelText="İptal"
        variant="destructive"
        loading={deleting}
      />
    </div>
  )
}

function StudentAnnouncements({ studentId }: { studentId: string }) {
  const [announcements, setAnnouncements] = useState<AnnouncementWithCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true)
      const supabase = createClient()

      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', studentId)
        .eq('status', 'approved')

      if (enrollError) {
        toast.error('Duyurular yüklenirken bir hata oluştu')
        setLoading(false)
        return
      }

      const courseIds = (enrollments ?? []).map((enrollment) => enrollment.course_id)

      if (courseIds.length === 0) {
        setAnnouncements([])
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('announcements')
        .select('*, courses(id, title)')
        .in('course_id', courseIds)
        .order('created_at', { ascending: false })

      if (error) {
        toast.error('Duyurular yüklenirken bir hata oluştu')
      } else {
        setAnnouncements((data as AnnouncementWithCourse[]) ?? [])
      }

      setLoading(false)
    }

    fetchAnnouncements()
  }, [studentId])

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Duyurular</h1>
        <p className="text-gray-500 mt-1">
          Kayıtlı olduğunuz derslere ait güncel duyuruları görüntüleyin.
        </p>
      </div>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<Megaphone className="h-8 w-8 text-gray-400" />}
              title="Henüz duyuru yok"
              description="Kayıtlı olduğunuz derslerde henüz yayınlanmış bir duyuru bulunmuyor."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge>{getCourseTitle(announcement)}</Badge>
                  <span className="text-xs text-gray-500">
                    {formatDate(announcement.created_at)}
                  </span>
                </div>
                <CardTitle className="text-lg text-gray-900">
                  {announcement.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RichTextContent content={announcement.content} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
