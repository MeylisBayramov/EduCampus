'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate, isOverdue } from '@/lib/utils'
import type { Assignment, Course, Submission } from '@/lib/types'
import { ClipboardList, Clock, CheckCircle2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

type FilterType = 'all' | 'pending' | 'submitted' | 'graded'

interface AssignmentItem extends Assignment {
  course?: Course
  submission: Submission | null
}

export default function StudentAssignmentsPage() {
  const { profile, loading: authLoading } = useAuth()
  const [assignments, setAssignments] = useState<AssignmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    if (!profile) return

    let active = true

    const fetchAssignments = async () => {
      const supabase = createClient()

      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', profile.id)
        .eq('status', 'approved')

      if (!active) return

      if (enrollmentError) {
        toast.error('Kayıtlı dersler yüklenirken bir hata oluştu')
        setLoading(false)
        return
      }

      const courseIds = (enrollments ?? []).map((e) => e.course_id)

      if (courseIds.length === 0) {
        setAssignments([])
        setLoading(false)
        return
      }

      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('assignments')
        .select('*, courses(*)')
        .in('course_id', courseIds)
        .order('due_date', { ascending: true })

      if (!active) return

      if (assignmentError) {
        toast.error('Ödevler yüklenirken bir hata oluştu')
        setLoading(false)
        return
      }

      const rows = (assignmentRows ?? []) as (Assignment & { courses?: Course | null })[]
      const assignmentIds = rows.map((a) => a.id)
      const submissionMap = new Map<string, Submission>()

      if (assignmentIds.length > 0) {
        const { data: submissions, error: submissionError } = await supabase
          .from('submissions')
          .select('*')
          .eq('student_id', profile.id)
          .in('assignment_id', assignmentIds)

        if (!active) return

        if (submissionError) {
          toast.error('Teslim bilgileri yüklenirken bir hata oluştu')
        } else {
          for (const sub of (submissions ?? []) as Submission[]) {
            submissionMap.set(sub.assignment_id, sub)
          }
        }
      }

      const combined: AssignmentItem[] = rows.map((item) => ({
        id: item.id,
        course_id: item.course_id,
        title: item.title,
        description: item.description,
        due_date: item.due_date,
        max_score: item.max_score,
        created_at: item.created_at,
        course: item.courses ?? undefined,
        submission: submissionMap.get(item.id) ?? null,
      }))

      setAssignments(combined)
      setLoading(false)
    }

    fetchAssignments()

    return () => {
      active = false
    }
  }, [profile])

  if (authLoading || !profile || loading) {
    return <LoadingSpinner />
  }

  const filteredAssignments = assignments.filter((assignment) => {
    const sub = assignment.submission
    if (filter === 'pending') return !sub
    if (filter === 'submitted') return Boolean(sub) && sub?.score === null
    if (filter === 'graded') return Boolean(sub) && sub?.score !== null
    return true
  })

  const totalCount = assignments.length
  const submittedCount = assignments.filter((a) => Boolean(a.submission)).length
  const pendingCount = assignments.filter((a) => !a.submission && !isOverdue(a.due_date)).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ödevlerim</h1>
          <p className="text-gray-500 mt-1">
            Kayıtlı olduğunuz derslere ait ödevleri ve teslim durumlarınızı takip edin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Tümü ({totalCount})
          </Button>
          <Button
            type="button"
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Teslim Edilmeyen ({assignments.filter((a) => !a.submission).length})
          </Button>
          <Button
            type="button"
            variant={filter === 'submitted' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('submitted')}
          >
            Teslim Edilen ({assignments.filter((a) => a.submission && a.submission.score === null).length})
          </Button>
          <Button
            type="button"
            variant={filter === 'graded' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('graded')}
          >
            Notlandırılan ({assignments.filter((a) => a.submission && a.submission.score !== null).length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Toplam Ödev</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{totalCount}</p>
              </div>
              <div className="bg-blue-500 rounded-xl p-3">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Bekleyen Açık Ödev</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{pendingCount}</p>
              </div>
              <div className="bg-amber-500 rounded-xl p-3">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Teslim Edilen</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{submittedCount}</p>
              </div>
              <div className="bg-green-500 rounded-xl p-3">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {filteredAssignments.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<ClipboardList className="h-8 w-8 text-gray-400" />}
              title={assignments.length === 0 ? 'Henüz ödeviniz yok' : 'Bu filtrede ödev bulunamadı'}
              description={
                assignments.length === 0
                  ? 'Kayıtlı olduğunuz onaylı derslerde henüz yayınlanmış bir ödev bulunmuyor. Ders kaydı için öğretmeninizle iletişime geçin.'
                  : 'Seçtiğiniz teslim durumuna uygun ödev bulunamadı.'
              }
              action={assignments.length > 0 ? (
                <Button variant="outline" onClick={() => setFilter('all')}>
                  Tüm Ödevleri Göster
                </Button>
              ) : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAssignments.map((assignment) => {
            const overdue = isOverdue(assignment.due_date)
            const submission = assignment.submission
            const isGraded = submission !== null && submission.score !== null

            return (
              <Link
                key={assignment.id}
                href={`/panel/odevlerim/${assignment.id}`}
                className="block group"
              >
                <Card className="hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                          {assignment.title}
                        </CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                          {assignment.course?.title ?? 'Ders bilgisi yok'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {overdue ? (
                          <Badge variant="destructive">Süresi Geçti</Badge>
                        ) : (
                          <Badge variant="success">Açık</Badge>
                        )}

                        {isGraded ? (
                          <Badge className="bg-purple-100 text-purple-800">
                            Notlandırıldı ({submission.score}/{assignment.max_score})
                          </Badge>
                        ) : submission ? (
                          <Badge variant="default">Teslim Edildi</Badge>
                        ) : (
                          <Badge variant="secondary">Teslim Edilmedi</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span>Son Teslim: {formatDate(assignment.due_date)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <ClipboardList className="h-4 w-4 text-gray-400" />
                          <span>Maksimum Puan: {assignment.max_score}</span>
                        </span>
                        {submission && (
                          <span className="inline-flex items-center gap-1.5 text-blue-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Teslim: {formatDate(submission.submitted_at)}</span>
                          </span>
                        )}
                      </div>

                      <span className="inline-flex items-center gap-1 font-medium text-blue-600 group-hover:translate-x-0.5 transition-transform">
                        Detayları Gör
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
