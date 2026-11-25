import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function ensureDemoUser(
  adminClient: Awaited<ReturnType<typeof createServiceRoleClient>>,
  email: string,
  password: string,
  fullName: string,
  role: 'teacher' | 'student'
): Promise<string> {
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingProfile) {
    await adminClient
      .from('profiles')
      .update({ role, full_name: fullName })
      .eq('id', existingProfile.id)
    return existingProfile.id
  }

  const { data: created, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error || !created.user) {
    throw new Error(`Demo kullanıcı oluşturulamadı (${email}): ${error?.message}`)
  }

  await adminClient
    .from('profiles')
    .upsert({
      id: created.user.id,
      full_name: fullName,
      email,
      role,
    })

  return created.user.id
}

// POST /api/seed - Creates demo auth users & sample data
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret')

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || secret !== process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 10)) {
      return NextResponse.json({ error: 'Yetkisiz istek' }, { status: 401 })
    }

    const supabase = await createServiceRoleClient()

    const teacherId = await ensureDemoUser(
      supabase,
      'ogretmen@demo.com',
      'Demo1234',
      'Demo Öğretmen',
      'teacher'
    )

    const studentId = await ensureDemoUser(
      supabase,
      'ogrenci@demo.com',
      'Demo1234',
      'Demo Öğrenci',
      'student'
    )

    const { data: existingCourse } = await supabase
      .from('courses')
      .select('id')
      .eq('teacher_id', teacherId)
      .limit(1)
      .single()

    let courseId: string

    if (existingCourse) {
      courseId = existingCourse.id
    } else {
      const { data: course1, error: c1Err } = await supabase
        .from('courses')
        .insert({
          teacher_id: teacherId,
          title: 'Python Programlamaya Giriş',
          description: 'Python değişkenleri, veri tipleri ve koşullu ifadeler.',
          content:
            '<h2>Python Programlamaya Giriş</h2><p>Bu derste Python programlama dilinin temellerini öğreneceksiniz.</p><ul><li><strong>Değişkenler</strong> ve veri tipleri (int, float, str, bool)</li><li><strong>Koşullu ifadeler</strong> (if-elif-else)</li><li><strong>Döngüler</strong> (for, while)</li><li><strong>Fonksiyonlar</strong> ve parametreler</li><li><strong>Listeler</strong>, demetler ve sözlükler</li></ul><p>Ders boyunca pratik örnekler ve ödevlerle öğrendiklerinizi pekiştireceksiniz.</p>',
        })
        .select('id')
        .single()

      if (c1Err || !course1) {
        throw new Error(c1Err?.message || 'Örnek ders oluşturulamadı')
      }

      courseId = course1.id

      const { data: course2 } = await supabase
        .from('courses')
        .insert({
          teacher_id: teacherId,
          title: 'HTML ve CSS Temelleri',
          description: 'Web geliştirmenin temellerini HTML ve CSS ile öğrenin.',
          content:
            '<h2>HTML ve CSS Temelleri</h2><p>Modern web sayfaları oluşturmak için gereken temel bilgileri bu derste öğreneceksiniz.</p><ul><li><strong>HTML</strong> etiketleri ve yapısı</li><li><strong>CSS</strong> seçiciler ve özellikler</li><li><strong>Flexbox</strong> ve <strong>Grid</strong> düzenleri</li></ul>',
        })
        .select('id')
        .single()

      await supabase.from('courses').insert({
        teacher_id: teacherId,
        title: 'JavaScript Başlangıç',
        description: 'JavaScript ile dinamik web uygulamaları geliştirmeye başlayın.',
        content:
          '<h2>JavaScript Başlangıç</h2><p>Bu derste JavaScript programlama dilini sıfırdan öğreneceksiniz.</p><ul><li>Değişkenler ve veri tipleri</li><li>Fonksiyonlar ve DOM manipülasyonu</li><li>Asenkron programlama</li></ul>',
      })

      await supabase.from('enrollments').insert({
        course_id: courseId,
        student_id: studentId,
        status: 'approved',
      })

      if (course2) {
        await supabase.from('enrollments').insert({
          course_id: course2.id,
          student_id: studentId,
          status: 'approved',
        })
      }
    }

    const { data: existingAssignments } = await supabase
      .from('assignments')
      .select('id')
      .eq('course_id', courseId)

    if (!existingAssignments || existingAssignments.length === 0) {
      const dueDate1 = new Date()
      dueDate1.setDate(dueDate1.getDate() + 14)

      const dueDate2 = new Date()
      dueDate2.setDate(dueDate2.getDate() + 30)

      await supabase.from('assignments').insert([
        {
          course_id: courseId,
          title: 'Python ile Basit Hesap Makinesi',
          description:
            '<h2>Ödev: Hesap Makinesi</h2><p>Python kullanarak dört işlem (toplama, çıkarma, çarpma, bölme) gerçekleştiren bir program geliştirin.</p><ul><li>Kullanıcıdan iki sayı ve işlem türü alınmalı</li><li>Sıfıra bölme durumu kontrol edilmeli</li></ul>',
          due_date: dueDate1.toISOString(),
          max_score: 100,
        },
        {
          course_id: courseId,
          title: 'Python Veri Tipleri Alıştırması',
          description:
            '<p>Python temel veri tiplerini (int, float, str, list, dict) kullanarak verilen alıştırmaları tamamlayın.</p>',
          due_date: dueDate2.toISOString(),
          max_score: 50,
        },
      ])
    }

    const { data: existingAnnouncements } = await supabase
      .from('announcements')
      .select('id')
      .eq('course_id', courseId)

    if (!existingAnnouncements || existingAnnouncements.length === 0) {
      await supabase.from('announcements').insert({
        course_id: courseId,
        teacher_id: teacherId,
        title: 'Python dersimizin ilk ödevi yayınlanmıştır.',
        content:
          '<p>Merhaba değerli öğrenciler,</p><p>Python Programlamaya Giriş dersimizin ilk ödevi <strong>"Python ile Basit Hesap Makinesi"</strong> yayınlanmıştır. Son teslim tarihine dikkat ediniz.</p>',
      })
    }

    return NextResponse.json({
      message: 'Demo kullanıcılar ve örnek veriler başarıyla oluşturuldu!',
      teacherId,
      studentId,
      courseId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sunucu hatası'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
