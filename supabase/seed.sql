-- =====================================================
-- EduCampus - Demo Verileri (Seed)
-- Bu dosyayı Supabase SQL Editor'da çalıştırın
-- Önce demo kullanıcıları Supabase Auth'da oluşturun
-- =====================================================

-- NOT: Demo kullanıcılar Supabase Auth Dashboard'dan
-- veya aşağıdaki API çağrılarıyla oluşturulmalıdır.
-- Auth kullanıcıları oluşturulduktan sonra profiles tablosuna
-- trigger otomatik olarak kayıt ekler.

-- Demo öğretmen profilini öğretmen olarak güncelle
-- (Auth ID'sini Supabase'den alıp aşağıya yazın)
-- UPDATE profiles SET role = 'teacher', full_name = 'Demo Öğretmen' 
-- WHERE email = 'ogretmen@demo.com';

-- Örnek ders oluştur (teacher_id'yi güncelleyin)
-- INSERT INTO courses (teacher_id, title, description, content) VALUES
-- ('<TEACHER_UUID>', 'Python Programlamaya Giriş', 
--  'Python programlama dilinin temellerini öğrenin.',
--  '<h2>Python Programlamaya Giriş</h2><p>Bu derste Python programlama dilinin temellerini öğreneceksiniz.</p><ul><li><strong>Değişkenler</strong> ve veri tipleri</li><li><strong>Koşullu ifadeler</strong> (if-elif-else)</li><li><strong>Döngüler</strong> (for, while)</li><li><strong>Fonksiyonlar</strong></li><li><strong>Listeler</strong> ve sözlükler</li></ul><p>Ders boyunca pratik örnekler ve ödevlerle öğrendiklerinizi pekiştireceksiniz.</p>');

-- Seed script API route'u ile otomatik çalıştırılacak
