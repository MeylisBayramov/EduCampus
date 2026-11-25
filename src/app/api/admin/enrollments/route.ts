import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const addEnrollmentSchema = z.object({
  courseId: z.string().uuid(),
  studentId: z.string().uuid(),
})

const removeEnrollmentSchema = z.object({
  enrollmentId: z.string().uuid(),
})

// POST: Öğretmenin kendi dersine öğrenci eklemesi
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Bu işlem için öğretmen yetkisi gerekiyor' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = addEnrollmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz parametreler' }, { status: 400 })
    }

    const { courseId, studentId } = parsed.data
    const adminClient = await createServiceRoleClient()

    // Dersin bu öğretmene ait olup olmadığını kontrol et
    const { data: course, error: courseError } = await adminClient
      .from('courses')
      .select('id, teacher_id')
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      return NextResponse.json({ error: 'Ders bulunamadı' }, { status: 404 })
    }

    if (course.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Sadece kendi dersinize öğrenci ekleyebilirsiniz' }, { status: 403 })
    }

    // Öğrencinin var olup olmadığını kontrol et
    const { data: student, error: studentError } = await adminClient
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      return NextResponse.json({ error: 'Öğrenci bulunamadı' }, { status: 404 })
    }

    // Zaten kayıtlı mı kontrol et
    const { data: existing } = await adminClient
      .from('enrollments')
      .select('id, status')
      .eq('course_id', courseId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'approved') {
        return NextResponse.json({ error: 'Bu öğrenci zaten derse kayıtlı' }, { status: 400 })
      }
      // Beklemede veya reddedilmişse onayla
      const { data: updated, error: updateError } = await adminClient
        .from('enrollments')
        .update({ status: 'approved' })
        .eq('id', existing.id)
        .select('*, profiles(*)')
        .single()

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
      return NextResponse.json({ success: true, enrollment: updated })
    }

    // Yeni kayıt oluştur (doğrudan onaylı)
    const { data: created, error: insertError } = await adminClient
      .from('enrollments')
      .insert({
        course_id: courseId,
        student_id: studentId,
        status: 'approved',
      })
      .select('*, profiles(*)')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, enrollment: created })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sunucu hatası'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Öğretmenin dersten öğrenci kaydını kaldırması
export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = removeEnrollmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz kayıt ID' }, { status: 400 })
    }

    const { enrollmentId } = parsed.data
    const adminClient = await createServiceRoleClient()

    // Kaydı ve bağlı olduğu dersi kontrol et
    const { data: enrollment, error: enrollmentError } = await adminClient
      .from('enrollments')
      .select('id, course_id, courses(teacher_id)')
      .eq('id', enrollmentId)
      .single()

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })
    }

    const courseTeacherId = Array.isArray(enrollment.courses)
      ? enrollment.courses[0]?.teacher_id
      : (enrollment.courses as { teacher_id: string } | null)?.teacher_id

    if (courseTeacherId !== user.id) {
      return NextResponse.json({ error: 'Bu dersten öğrenci çıkarmak için yetkiniz yok' }, { status: 403 })
    }

    const { error: deleteError } = await adminClient
      .from('enrollments')
      .delete()
      .eq('id', enrollmentId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sunucu hatası'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
