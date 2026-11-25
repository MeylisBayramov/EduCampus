'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { RichTextContent } from '@/components/rich-text-content'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { formatDate } from '@/lib/utils'
import { Star, Award, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'

interface JoinedCourse {
  title: string
}

interface JoinedAssignment {
  title: string
  max_score: number
  course_id: string
  courses: JoinedCourse | JoinedCourse[] | null
}

interface SubmissionRow {
  id: string
  assignment_id: string
  student_id: string
  content: string
  submitted_at: string
  score: number | null
  feedback: string | null
  assignments: JoinedAssignment | JoinedAssignment[] | null
}

interface GradedSubmission {
  id: string
  assignmentId: string
  assignmentTitle: string
  courseTitle: string
  score: number
  maxScore: number
  percentage: number
  feedback: string | null
  submittedAt: string
}

function unwrapSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function getScoreBadgeVariant(percentage: number): 'success' | 'default' | 'warning' | 'destructive' {
  if (percentage >= 85) return 'success'
  if (percentage >= 70) return 'default'
  if (percentage >= 50) return 'warning'
  return 'destructive'
}

function getProgressBarColor(percentage: number): string {
  if (percentage >= 85) return 'bg-green-500'
  if (percentage >= 70) return 'bg-blue-500'
  if (percentage >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function hasFeedbackContent(feedback: string | null): feedback is string {
  if (!feedback) return false
  const stripped = feedback.replace(/<[^>]*>/g, '').trim()
  return stripped.length > 0
}

export default function GradesPage() {
  const { profile, loading: authLoading } = useAuth()
  const [grades, setGrades] = useState<GradedSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!profile || profile.role !== 'student') return

    let active = true

    const fetchGrades = async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('submissions')
        .select('*, assignments(title, max_score, course_id, courses(title))')
        .eq('student_id', profile.id)
        .not('score', 'is', null)
        .order('submitted_at', { ascending: false })

      if (!active) return

      if (error) {
        toast.error('Notlar yüklenirken bir hata oluştu.')
        setLoading(false)
        return
      }

      const rows = (data ?? []) as SubmissionRow[]
      const mapped: GradedSubmission[] = rows
        .filter((row) => row.score !== null)
        .map((row) => {
          const assignment = unwrapSingle(row.assignments)
          const course = unwrapSingle(assignment?.courses)
          const score = row.score ?? 0
          const maxScore = assignment?.max_score ?? 100
          const rawPercentage = maxScore > 0 ? (score / maxScore) * 100 : 0
          const percentage = Math.min(100, Math.max(0, Math.round(rawPercentage)))

          return {
            id: row.id,
            assignmentId: row.assignment_id,
            assignmentTitle: assignment?.title ?? 'Bilinmeyen Ödev',
            courseTitle: course?.title ?? 'Bilinmeyen Ders',
            score,
            maxScore,
            percentage,
            feedback: row.feedback,
            submittedAt: row.submitted_at,
          }
        })

      setGrades(mapped)
      setLoading(false)
    }

    fetchGrades()

    return () => {
      active = false
    }
  }, [profile])

  const summary = useMemo(() => {
    const totalGraded = grades.length
    if (totalGraded === 0) {
      return {
        totalGraded: 0,
        averagePercentage: 0,
      }
    }

    const totalPercentage = grades.reduce((sum, item) => sum + item.percentage, 0)
    return {
      totalGraded,
      averagePercentage: Math.round(totalPercentage / totalGraded),
    }
  }, [grades])

  const toggleFeedback = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  if (authLoading || !profile) {
    return <LoadingSpinner text="Notlarınız yükleniyor..." />
  }

  if (profile.role !== 'student') {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={<Award className="h-8 w-8 text-gray-400" />}
            title="Öğrenci Sayfası"
            description="Notlarım sayfası yalnızca öğrenciler içindir."
          />
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <LoadingSpinner text="Notlarınız yükleniyor..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notlarım</h1>
        <p className="text-gray-500 mt-1">
          Değerlendirilen ödev puanlarınızı ve öğretmen geri bildirimlerini görüntüleyin.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Ortalama Başarı Yüzdesi</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  %{summary.averagePercentage}
                </p>
              </div>
              <div className="bg-blue-500 rounded-xl p-3">
                <Award className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Değerlendirilen Ödev Sayısı</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {summary.totalGraded}
                </p>
              </div>
              <div className="bg-amber-500 rounded-xl p-3">
                <Star className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {grades.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<Star className="h-8 w-8 text-gray-400" />}
              title="Henüz değerlendirilmiş ödev yok"
              description="Öğretmenleriniz teslim ettiğiniz ödevleri puanladığında notlarınız burada listelenecektir."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grades.map((item) => {
            const isExpanded = Boolean(expandedIds[item.id])
            const hasFeedback = hasFeedbackContent(item.feedback)

            return (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{item.courseTitle}</Badge>
                        <span className="text-xs text-gray-500">
                          Teslim: {formatDate(item.submittedAt)}
                        </span>
                      </div>
                      <CardTitle className="text-lg text-gray-900">
                        {item.assignmentTitle}
                      </CardTitle>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={getScoreBadgeVariant(item.percentage)} className="text-sm px-3 py-1">
                        {item.score} / {item.maxScore} Puan (%{item.percentage})
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Alınan Puan / Maksimum Puan</span>
                      <span className="font-medium text-gray-900">
                        {item.score} / {item.maxScore} (%{item.percentage})
                      </span>
                    </div>
                    <div
                      className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={item.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(item.percentage)}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    {hasFeedback ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleFeedback(item.id)}
                          aria-expanded={isExpanded}
                          className="flex w-full items-center justify-between text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors py-1"
                        >
                          <span>Öğretmen Geri Bildirimi</span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            {isExpanded ? 'Gizle' : 'Görüntüle'}
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 p-4">
                            <RichTextContent content={item.feedback as string} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">
                        Öğretmen geri bildirimi eklenmemiş.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
