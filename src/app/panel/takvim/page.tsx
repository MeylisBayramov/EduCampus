'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { tr } from 'date-fns/locale/tr'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading'
import { createClient } from '@/lib/supabase/client'
import type { Assignment, Course, Submission } from '@/lib/types'
import { cn, formatDate, isOverdue } from '@/lib/utils'

type CalendarAssignment = Omit<Assignment, 'course'> & {
  course?: Pick<Course, 'id' | 'title'> | null
  submission?: Submission | null
}

type AssignmentRow = Omit<Assignment, 'course' | 'submission'> & {
  courses: Pick<Course, 'id' | 'title'> | Pick<Course, 'id' | 'title'>[] | null
}

type AssignmentStatus = 'submitted' | 'overdue' | 'upcoming'

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const

const STATUS_META: Record<
  AssignmentStatus,
  {
    label: string
    dotClass: string
    badgeVariant: 'success' | 'destructive' | 'warning'
  }
> = {
  submitted: {
    label: 'Teslim Edildi',
    dotClass: 'bg-green-500',
    badgeVariant: 'success',
  },
  overdue: {
    label: 'Süresi Geçti',
    dotClass: 'bg-red-500',
    badgeVariant: 'destructive',
  },
  upcoming: {
    label: 'Yaklaşan',
    dotClass: 'bg-amber-500',
    badgeVariant: 'warning',
  },
}

function getAssignmentStatus(assignment: CalendarAssignment): AssignmentStatus {
  if (assignment.submission) {
    return 'submitted'
  }
  if (isOverdue(assignment.due_date)) {
    return 'overdue'
  }
  return 'upcoming'
}

function normalizeCourse(
  courses: AssignmentRow['courses']
): Pick<Course, 'id' | 'title'> | null {
  if (!courses) return null
  return Array.isArray(courses) ? (courses[0] ?? null) : courses
}

export default function CalendarPage() {
  const { profile, loading: authLoading } = useAuth()
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [assignments, setAssignments] = useState<CalendarAssignment[]>([])
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !profile || profile.role !== 'student') {
      return
    }

    let isMounted = true

    const fetchCalendarData = async () => {
      const supabase = createClient()

      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', profile.id)
        .eq('status', 'approved')

      if (enrollmentError) {
        if (isMounted) {
          setError('Kayıtlı dersler yüklenirken bir hata oluştu.')
          setLoadedUserId(profile.id)
        }
        return
      }

      const courseIds = (enrollments ?? []).map((item) => item.course_id)
      if (courseIds.length === 0) {
        if (isMounted) {
          setError(null)
          setAssignments([])
          setLoadedUserId(profile.id)
        }
        return
      }

      const { data: assignmentRows, error: assignmentError } = await supabase
        .from('assignments')
        .select('*, courses(id, title)')
        .in('course_id', courseIds)
        .order('due_date', { ascending: true })

      if (assignmentError) {
        if (isMounted) {
          setError('Ödevler yüklenirken bir hata oluştu.')
          setLoadedUserId(profile.id)
        }
        return
      }

      const rows = (assignmentRows ?? []) as AssignmentRow[]
      const assignmentIds = rows.map((item) => item.id)

      const submissionMap = new Map<string, Submission>()
      if (assignmentIds.length > 0) {
        const { data: submissionRows, error: submissionError } = await supabase
          .from('submissions')
          .select('*')
          .eq('student_id', profile.id)
          .in('assignment_id', assignmentIds)

        if (submissionError) {
          if (isMounted) {
            setError('Teslim bilgileri yüklenirken bir hata oluştu.')
            setLoadedUserId(profile.id)
          }
          return
        }

        for (const sub of (submissionRows ?? []) as Submission[]) {
          submissionMap.set(sub.assignment_id, sub)
        }
      }

      const mapped: CalendarAssignment[] = rows.map((row) => ({
        id: row.id,
        course_id: row.course_id,
        title: row.title,
        description: row.description,
        due_date: row.due_date,
        max_score: row.max_score,
        created_at: row.created_at,
        course: normalizeCourse(row.courses),
        submission: submissionMap.get(row.id) ?? null,
      }))

      if (isMounted) {
        setError(null)
        setAssignments(mapped)
        setLoadedUserId(profile.id)
      }
    }

    fetchCalendarData()

    return () => {
      isMounted = false
    }
  }, [profile, authLoading])

  const loading = profile?.role === 'student' && loadedUserId !== profile.id

  const assignmentsByDay = useMemo(() => {
    const map = new Map<string, CalendarAssignment[]>()
    for (const assignment of assignments) {
      const key = format(new Date(assignment.due_date), 'yyyy-MM-dd')
      const existing = map.get(key)
      if (existing) {
        existing.push(assignment)
      } else {
        map.set(key, [assignment])
      }
    }
    return map
  }, [assignments])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentMonth])

  const selectedDayAssignments = useMemo(() => {
    return assignments.filter((assignment) =>
      isSameDay(new Date(assignment.due_date), selectedDate)
    )
  }, [assignments, selectedDate])

  if (authLoading || !profile) {
    return <LoadingSpinner />
  }

  if (profile.role !== 'student') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-red-50 p-4">
              <CalendarDays className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Erişim Yetkisi Yok</h2>
            <p className="mt-2 text-sm text-gray-500 max-w-sm">
              Ödev takvimi sayfası yalnızca öğrenciler tarafından görüntülenebilir.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <LoadingSpinner text="Takvim yükleniyor..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ödev Takvimi</h1>
          <p className="text-gray-500 mt-1">
            Kayıtlı olduğunuz derslerin ödev teslim tarihlerini aylık takvim üzerinde takip edin.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const today = new Date()
            setCurrentMonth(startOfMonth(today))
            setSelectedDate(today)
          }}
        >
          Bugüne Git
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: tr })}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Önceki ay"
              onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Sonraki ay"
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
            {WEEKDAYS.map((dayName) => (
              <div
                key={dayName}
                className="py-2 text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                {dayName}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const dayAssignments = assignmentsByDay.get(dateKey) ?? []
              const inCurrentMonth = isSameMonth(day, currentMonth)
              const selected = isSameDay(day, selectedDate)
              const today = isToday(day)

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'flex min-h-[72px] sm:min-h-[88px] flex-col items-start justify-between rounded-lg border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    inCurrentMonth
                      ? 'bg-white border-gray-200 hover:bg-gray-50'
                      : 'bg-gray-50/70 border-gray-100 text-gray-400 hover:bg-gray-100/70',
                    selected && 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600 hover:bg-blue-50',
                    today && !selected && 'border-blue-300'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs sm:text-sm font-medium',
                      today && 'bg-blue-600 text-white',
                      !today && inCurrentMonth && 'text-gray-900',
                      !today && !inCurrentMonth && 'text-gray-400'
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  {dayAssignments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1 w-full">
                      {dayAssignments.slice(0, 4).map((assignment) => {
                        const status = getAssignmentStatus(assignment)
                        return (
                          <span
                            key={assignment.id}
                            title={`${assignment.title} (${STATUS_META[status].label})`}
                            className={cn('h-2 w-2 rounded-full shrink-0', STATUS_META[status].dotClass)}
                          />
                        )
                      })}
                      {dayAssignments.length > 4 && (
                        <span className="text-[10px] font-medium text-gray-500 leading-none">
                          +{dayAssignments.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-100 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span>Teslim Edildi</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>Yaklaşan</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span>Süresi Geçti</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">
            {format(selectedDate, 'd MMMM yyyy, EEEE', { locale: tr })} Ödevleri
          </CardTitle>
          <Badge variant="secondary">{selectedDayAssignments.length} ödev</Badge>
        </CardHeader>
        <CardContent>
          {selectedDayAssignments.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Seçilen tarihte teslim edilecek ödev bulunmuyor.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayAssignments.map((assignment) => {
                const status = getAssignmentStatus(assignment)
                const meta = STATUS_META[status]

                return (
                  <div
                    key={assignment.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gray-200 bg-gray-50/70 p-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={cn('mt-1.5 h-2.5 w-2.5 rounded-full shrink-0', meta.dotClass)} />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{assignment.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {assignment.course?.title ?? 'Ders bilgisi yok'} · Son Teslim:{' '}
                          {formatDate(assignment.due_date)} ({format(new Date(assignment.due_date), 'HH:mm', { locale: tr })})
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {assignment.submission?.score !== null &&
                        assignment.submission?.score !== undefined && (
                          <Badge variant="outline">
                            Not: {assignment.submission.score} / {assignment.max_score}
                          </Badge>
                        )}
                      <Badge variant="secondary">Maks. {assignment.max_score} puan</Badge>
                      <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
