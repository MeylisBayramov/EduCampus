'use client'

import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSpinner } from '@/components/ui/loading'
import {
  BookOpen, Users, ClipboardList, Megaphone, ArrowRight, Clock
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatDate, isOverdue } from '@/lib/utils'
import type { Announcement, Course, Assignment } from '@/lib/types'

type CourseSummary = Pick<Course, 'title'>
type DashboardAnnouncement = Omit<Announcement, 'course'> & { course?: CourseSummary }
type DashboardAssignment = Omit<Assignment, 'course'> & { course?: CourseSummary }

export default function DashboardPage() {
  const { profile } = useAuth()

  if (!profile) return <LoadingSpinner />

  return profile.role === 'teacher' ? <TeacherDashboard /> : <StudentDashboard />
}

function TeacherDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ courses: 0, students: 0, assignments: 0, announcements: 0 })
  const [recentAnnouncements, setRecentAnnouncements] = useState<DashboardAnnouncement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return

    const fetchData = async () => {
      const supabase = createClient()

      const [coursesRes, enrollmentsRes, assignmentsRes, announcementsRes] = await Promise.all([
        supabase.from('courses').select('id, title').eq('teacher_id', profile.id),
        supabase.from('enrollments').select('id, course_id, courses!inner(teacher_id)').eq('status', 'approved').eq('courses.teacher_id', profile.id),
        supabase.from('assignments').select('id, course_id, courses!inner(teacher_id)').eq('courses.teacher_id', profile.id),
        supabase.from('announcements').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }).limit(5),
      ])
      const courseById = new Map(
        (coursesRes.data ?? []).map((course: { id: string; title: string }) => [
          course.id,
          { title: course.title },
        ])
      )

      setStats({
        courses: coursesRes.data?.length ?? 0,
        students: enrollmentsRes.data?.length ?? 0,
        assignments: assignmentsRes.data?.length ?? 0,
        announcements: announcementsRes.data?.length ?? 0,
      })

      setRecentAnnouncements(
        (announcementsRes.data ?? []).map((announcement: Announcement) => ({
          ...announcement,
          course: courseById.get(announcement.course_id),
        }))
      )
      setLoading(false)
    }
    fetchData()
  }, [profile])

  if (loading) return <LoadingSpinner />

  const statCards = [
    { label: 'Derslerim', value: stats.courses, icon: BookOpen, color: 'bg-blue-500', href: '/panel/derslerim' },
    { label: 'Kayıtlı Öğrenciler', value: stats.students, icon: Users, color: 'bg-green-500', href: '/panel/uyeler' },
    { label: 'Ödevler', value: stats.assignments, icon: ClipboardList, color: 'bg-amber-500', href: '/panel/odev-yonetimi' },
    { label: 'Duyurular', value: stats.announcements, icon: Megaphone, color: 'bg-purple-500', href: '/panel/duyurular' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hoş Geldiniz, {profile?.full_name}</h1>
        <p className="text-gray-500 mt-1">Öğretmen Kontrol Paneli</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                    <div className={`${stat.color} rounded-xl p-3`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Son Duyurular</CardTitle>
            <Link href="/panel/duyurular">
              <Button variant="ghost" size="sm">
                Tümünü Gör <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentAnnouncements.length === 0 ? (
              <EmptyState title="Duyuru yok" description="Henüz duyuru oluşturmadınız." />
            ) : (
              <div className="space-y-3">
                {recentAnnouncements.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                    <Megaphone className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{a.title}</p>
                      <p className="text-xs text-gray-500">{a.course?.title} · {formatDate(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hızlı İşlemler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/panel/derslerim">
              <Button variant="outline" className="w-full justify-start gap-2">
                <BookOpen className="h-4 w-4" /> Derslerimi Yönet
              </Button>
            </Link>
            <Link href="/panel/odev-yonetimi">
              <Button variant="outline" className="w-full justify-start gap-2">
                <ClipboardList className="h-4 w-4" /> Ödevleri Yönet
              </Button>
            </Link>
            <Link href="/panel/duyurular">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Megaphone className="h-4 w-4" /> Duyuruları Yönet
              </Button>
            </Link>
            <Link href="/panel/uyeler">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Users className="h-4 w-4" /> Üye Yönetimi
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StudentDashboard() {
  const { profile } = useAuth()
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([])
  const [upcomingAssignments, setUpcomingAssignments] = useState<DashboardAssignment[]>([])
  const [recentAnnouncements, setRecentAnnouncements] = useState<DashboardAnnouncement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return

    const fetchData = async () => {
      const supabase = createClient()

      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', profile.id)
        .eq('status', 'approved')

      const courseIds = (enrollments ?? []).map((enrollment) => enrollment.course_id)
      let courses: Course[] = []

      if (courseIds.length > 0) {
        const { data: courseRows } = await supabase
          .from('courses')
          .select('*')
          .in('id', courseIds)
        courses = (courseRows ?? []) as Course[]
      }

      setEnrolledCourses(courses)

      if (courses.length > 0) {
        const courseById = new Map(courses.map((course) => [course.id, { title: course.title }]))

        // upcoming assignments
        const { data: assignments } = await supabase
          .from('assignments')
          .select('*')
          .in('course_id', courseIds)
          .order('due_date', { ascending: true })
          .limit(5)

        setUpcomingAssignments(
          (assignments ?? []).map((assignment: Assignment) => ({
            ...assignment,
            course: courseById.get(assignment.course_id),
          }))
        )

        // announcements
        const { data: announcements } = await supabase
          .from('announcements')
          .select('*')
          .in('course_id', courseIds)
          .order('created_at', { ascending: false })
          .limit(5)

        setRecentAnnouncements(
          (announcements ?? []).map((announcement: Announcement) => ({
            ...announcement,
            course: courseById.get(announcement.course_id),
          }))
        )
      }

      setLoading(false)
    }
    fetchData()
  }, [profile])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hoş Geldiniz, {profile?.full_name}</h1>
        <p className="text-gray-500 mt-1">Öğrenci Kontrol Paneli</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Kayıtlı Dersler</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{enrolledCourses.length}</p>
                </div>
                <div className="bg-blue-500 rounded-xl p-3">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
        </Card>
        <Link href="/panel/odevlerim">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Yaklaşan Ödevler</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {upcomingAssignments.filter((a) => !isOverdue(a.due_date)).length}
                  </p>
                </div>
                <div className="bg-amber-500 rounded-xl p-3">
                  <ClipboardList className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/panel/duyurular">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Duyurular</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{recentAnnouncements.length}</p>
                </div>
                <div className="bg-purple-500 rounded-xl p-3">
                  <Megaphone className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Yaklaşan Ödevler</CardTitle>
            <Link href="/panel/odevlerim">
              <Button variant="ghost" size="sm">
                Tümünü Gör <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingAssignments.length === 0 ? (
              <EmptyState title="Ödev yok" description="Şu an bekleyen ödeviniz bulunmuyor." />
            ) : (
              <div className="space-y-3">
                {upcomingAssignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <div className={`shrink-0 p-2 rounded-lg ${isOverdue(a.due_date) ? 'bg-red-100' : 'bg-blue-100'}`}>
                      {isOverdue(a.due_date) ? (
                        <Clock className="h-4 w-4 text-red-600" />
                      ) : (
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-gray-900 truncate">{a.title}</p>
                      <p className="text-xs text-gray-500">{a.course?.title}</p>
                    </div>
                    <Badge variant={isOverdue(a.due_date) ? 'destructive' : 'warning'}>
                      {isOverdue(a.due_date) ? 'Süresi Geçti' : formatDate(a.due_date)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Son Duyurular</CardTitle>
            <Link href="/panel/duyurular">
              <Button variant="ghost" size="sm">
                Tümünü Gör <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentAnnouncements.length === 0 ? (
              <EmptyState title="Duyuru yok" description="Henüz duyuru bulunmuyor." />
            ) : (
              <div className="space-y-3">
                {recentAnnouncements.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                    <Megaphone className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{a.title}</p>
                      <p className="text-xs text-gray-500">{a.course?.title} · {formatDate(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
