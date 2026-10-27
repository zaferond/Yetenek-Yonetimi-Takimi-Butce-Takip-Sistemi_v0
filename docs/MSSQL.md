# MSSQL geçiş hazırlığı

Bu teslimatta çalışan backend SQLite kullanır. `schema.mssql.sql` ve taşıma araçları **hazırlık** durumundadır; gerçek MSSQL bağlantısı olmadığı için SQL Server üzerinde doğrulanmadı. Uygulama adaptörü yazılmadan şirket ortamına geçiş yapılmamalıdır.

## Hazırlananlar

- `backend/schema.mssql.sql`: 13 ilişkisel tablo, yabancı anahtarlar, dönem/tutar kısıtları, plan hücresi benzersizliği, yıl başına tek aktif versiyon.
- `scripts/export-mssql.mjs`: SQLite üzerinde salt okunur, tutarlı snapshot; bütünlük kontrolü; tam sayı alanları string; SHA-256 doğrulaması. Oturumları taşımaz. Çıktı parola özetleri içerdiğinden özel dosya izinleriyle oluşturulur.
- `scripts/mssql/import.mjs`: boş hedef şemaya, SERIALIZABLE işlem altında parametreli aktarım. Kimlikleri korur. Her tablonun tüm değerlerini SQL Server'dan tekrar okuyup kaynağa karşı karşılaştırır; farkta rollback yapar. Dolu hedefi reddeder.

Her iki şemada para ve kur `BIGINT` ölçekli tam sayı: 1 TL = 1.000.000 birim. Böylece aktarımda ondalık dönüşümü gerekmez. MSSQL adaptörü bu alanları sürücüden `number` olarak almamalı; string / BigInt kullanmalı. Katılımcılar ve ay/yıl ayrı tam sayı alanlarıdır.

## Test ortamına veri taşıma

1. `npm run backup` çalıştırın. Kesintili bir geçiş için uygulama yazmalarını durdurun.
2. `npm run db:export:mssql` ile `data/mssql-export.json` oluşturun. Mevcut çıktı üzerine yazılmaz.
3. SQL Server'da ayrı ve boş bir test veritabanı oluşturun. `backend/schema.mssql.sql` dosyasını bu veritabanında çalıştırın. Şema betiği mevcut tabloları silmez.
4. `npm install --prefix scripts/mssql` ile isteğe bağlı taşıma bağımlılığını kurun.
5. Ortama `MSSQL_SERVER`, `MSSQL_DATABASE`, `MSSQL_USER`, `MSSQL_PASSWORD` ve gerekirse `MSSQL_PORT` tanımlayın. Parolaları kaynak dosyalarına veya komut geçmişine yazmayın. TLS şifrelemesi açıktır. `MSSQL_TRUST_CERTIFICATE=true` yalnızca izole test ortamında kendinden imzalı sertifika için kullanılabilir.
6. `ALLOW_MSSQL_IMPORT=YES node scripts/mssql/import.mjs data/mssql-export.json` çalıştırın.
7. Aktarılan verileri kabul ortamında doğrulayın; oturumlar yeniden açılmalıdır.

## Canlıya geçmeden tamamlanacak işler

- SQLite `Store` sözleşmesi için MSSQL adaptörü: async sorgular, parametreli erişim, transaction, identity döndürme, upsert ve kilitleme davranışı.
- Revizyon kontrolünün tüm instance'larda aynı transaction içinde kilitlenmesi. Fatura ve planlı ödeme eşleştirmelerinde toplam sınırlarının aynı kilit altında doğrulanması.
- Oturum ve giriş denemesi sınırlarının çok instance ortamına uyarlanması (mevcut deneme sayacı süreç belleğinde).
- Gerçek MSSQL üzerinde API testleri; hassas tutarlar, Unicode/Türkçe adlar, iptal ve düzeltme, paralel yazma, deadlock/timeout, eksik veri ve kesilen aktarım senaryoları.
- Her yıl/versiyon/kategori/ay için plan, aktif fatura, kalan planlı ödeme, tasarruf ve kayıt sayısı mutabakatı.
- Kurum HTTPS, servis hesabı, en az yetki, yedekleme/geri yükleme ve geri dönüş provası.

Bu liste tamamlanmadan MSSQL uyumluluğu veya üretim kullanımı doğrulanmış sayılmaz.
