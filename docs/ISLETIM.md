# Yerel işletim ve şirket hazırlığı

## Yerel dosyalar

Veritabanı varsayılan olarak `data/budget.sqlite` konumundadır. SQLite WAL modunda çalışır. Açık uygulamanın yalnızca `.sqlite` dosyasını dosya yöneticisinden kopyalamayın; `npm run backup` kullanın. Yedekler kullanıcı ve parola özetlerini, işlem geçmişini ve bütçe verilerini içerir.

`npm run backup` veritabanının tutarlı kopyasını oluşturur ve `PRAGMA integrity_check` ile doğrular. Ayrı bir kurumsal yedek ortamına kopyalama ve saklama süresi bu uygulama tarafından otomatik yapılmaz.

## Geri yükleme

1. Uygulamayı terminalde Ctrl+C ile durdurun; başka instance olmadığını kontrol edin.
2. Mevcut `data/` klasörünü ayrı bir kurtarma klasörüne kopyalayın.
3. Doğrulanmış yedeği **yeni** bir dosyaya kopyalayın, örneğin `data/recovered.sqlite`.
4. `.env` içindeki `DB_PATH` değerini yeni dosyaya yönlendirin. Eski dosyayı veya WAL dosyalarını silmeyin.
5. `node --env-file-if-exists=.env scripts/revoke-sessions.mjs` ile geri yüklenen oturumları iptal edin.
6. `npm start` ile uygulamayı başlatın; yıl/versiyon/toplamlar ve son faturalardan örnekler kontrol edin.

## Güvenlik davranışı

- scrypt parola özeti, kriptografik oturum belirteci, veritabanında belirtecin SHA-256 özeti.
- HttpOnly, SameSite=Strict çerez; normal oturum 8 saat, beni hatırla 7 gün. Süre dolduğunda açık form verisi korunarak yeniden giriş istenir.
- Yazmalarda tam Origin ve CSRF belirteci kontrolü; JSON gövde sınırı 512 KB.
- IP başına 15 dakikada 10 başarısız giriş denemesi sınırı; sayaç tek süreç belleğinde tutulur.
- Tüm veri API'leri oturum gerektirir. Veritabanı ve yedekler statik dosya olarak sunulmaz.
- Parametreli SQL, aktif SQLite yabancı anahtarları, atomik kayıt, uygulama genelinde revizyon kontrolü. Eski ekrandan gelen yazmalar HTTP 409 ile reddedilir.
- Her değişiklikte kullanıcı/zaman kaydı. Otomatik geçmiş silme yoktur.

## Şirket ortamı

Mevcut yerel uygulama çok kullanıcılı kurumsal kabulden geçirilmemiştir. Ayrıntılı rol ve onay sistemi bu sürümün kapsamında değildir; giriş yapan hesap düzenleme yetkisine sahiptir.

HTTPS reverse proxy kullanın. `APP_ORIGIN` dışarıdan kullanılan HTTPS adresiyle eşleşmeli, `COOKIE_SECURE=true` ve `NODE_ENV=production` olmalıdır. API için CORS açılmamıştır. Proxy arkasındaki IP başına giriş limiti bu sürümde doğrudan bağlantı IP'sini kullanır; istemcilerin ortak proxy adresini paylaşması ihtimali kurum entegrasyonunda ele alınmalıdır. `trust proxy` gelişigüzel açılmamalıdır.

Servis hesabına yalnızca uygulama/veri dizinleri için gerekli izinleri verin. Üretim kurulumunda kurgusal veriler oluşturulmaz. MSSQL geçişi için [MSSQL.md](MSSQL.md) belgesindeki eksik adaptör ve gerçek ortam testleri tamamlanmalıdır.
