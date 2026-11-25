# EduCampus - E-Öğrenme Platformu

BTÖ-303 Ara Uygulama 5 kapsamında geliştirilen, Moodle'dan esinlenen modern, güvenli ve Türkçe e-öğrenme yönetim sistemi (LMS).

## Teknoloji Altyapısı
- **Framework:** Next.js (App Router) + TypeScript
- **Stil & UI:** Tailwind CSS + Lucide React + Sonner
- **Veritabanı & Kimlik Doğrulama:** Supabase (PostgreSQL, Authentication, Row Level Security)
- **Zengin Metin Editörü:** TipTap Rich Text Editor + DOMPurify (XSS Koruması)
- **Doğrulama:** Zod
- **Yayınlama:** Vercel

## Özellikler
1. **Üyelik ve Roller (Modül 1):** Kayıt, giriş, TipTap ile profil düzenleme, hesap silme, öğretmenler için üye yönetimi (rol değiştirme ve hesap silme). Demo hesaplar korumalıdır.
2. **Ders ve Derse Kayıt (Modül 2):** Öğretmenler için ders oluşturma/düzenleme/silme, doğrudan öğrenci ekleme/çıkarma, katılım isteklerini onaylama/reddetme; öğrenciler için ders keşfetme, katılma isteği gönderme/iptal etme ve dersten ayrılma.
3. **Ödev Yönetimi (Modül 3):** Son teslim tarihine göre sıralama, açık/süresi geçti durumları, yalnızca kayıtlı öğrencilerin görebilmesi.
4. **Ödev Teslimi ve Notlandırma (Modül 4):** TipTap ile ödev teslimi, süre/not kontrolü altında düzenleme ve geri çekme, öğretmenler için teslim eden/etmeyen listesi, puanlama ve geri bildirim, öğrenciler için *Notlarım* ekranı.
5. **Duyurular (Modül 5):** Ders bazlı duyuru oluşturma/düzenleme/silme, ana sayfada en yeni 5 duyuru.
6. **Ek Özellik - Ödev Takvimi:** Öğrenciler için aylık takvim üzerinde yaklaşan, teslim edilmiş ve süresi geçmiş ödevlerin renk kodlu gösterimi.

## Kurulum Adımları

### 1. Ortam Değişkenleri (`.env.local`)
Proje kök dizinindeki `.env.local.example` dosyasını `.env.local` olarak kopyalayıp kendi Supabase bilgilerinizi girin:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJE_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=supabase_service_role_key
```

Bu bilgileri **Supabase Dashboard > Project Settings > API** sayfasından alabilirsiniz:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY` (İstemciye kesinlikle gönderilmez, yalnızca sunucu API rotalarında kullanılır.)

### 2. Veritabanı Şemasını Oluşturma
**Supabase Dashboard > SQL Editor** bölümüne gidin, `supabase/schema.sql` dosyasının içeriğini yapıştırıp **Run** butonuna tıklayın.

### 3. Demo Hesapları ve Örnek Verileri Yükleme
Uygulamayı çalıştırdıktan sonra (`npm run dev` veya Vercel URL'si üzerinden) `/api/seed` endpoint'ine `POST` isteği göndererek demo hesapları (`ogretmen@demo.com` / `ogrenci@demo.com`, şifre: `Demo1234`) ve örnek ders/ödev/duyuru verilerini otomatik oluşturabilirsiniz:

```bash
curl -X POST "http://localhost:3000/api/seed?secret=SERVICE_ROLE_KEY_ILK_10_KARAKTER"
```

*(Alternatif olarak Supabase Dashboard > Authentication > Users kısmından kullanıcıları manuel oluşturup `profiles` tablosunda öğretmenin rolünü `teacher` yapabilirsiniz.)*

### 4. Geliştirme Sunucusu ve Production Build
```bash
npm install
npm run dev
# Production build kontrolü:
npm run build
```

## Vercel'de Yayınlama
1. Projeyi GitHub reponuza pushlayın.
2. [Vercel](https://vercel.com) üzerinden **Add New Project** diyerek repoyu seçin.
3. **Root Directory** olarak `educampus` klasörünü seçin (eğer repo üst klasördeyse).
4. **Environment Variables** bölümüne `.env.local` içindeki 3 değişkeni (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) ekleyin.
5. **Deploy** butonuna tıklayın.
6. Yayınlandıktan sonra canlı URL üzerinden `/api/seed?secret=...` isteğini bir kez çalıştırarak demo verilerini yükleyin.
