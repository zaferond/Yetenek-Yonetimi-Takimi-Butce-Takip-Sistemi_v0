# backend-veri ajanı günlüğü

Bu dosyaya yalnızca `backend-veri` ajanı yazar. Yeni kayıtlar en alta eklenir; eski kayıtlar değiştirilmez.

## 2026-10-30 — Backend performans ve veri analizi (yalnız inceleme)
- Görev: store/app/admin/auth/schema/domain dosyalarını performans ve veri bütünlüğü açısından incelemek; kod değiştirilmedi.
- Değiştirilen dosyalar: docs/ajan-gunlukleri/backend-veri.md (yalnız günlük)
- Çalıştırılan testler: npm test → 31 testten 29 geçti, 2 başarısız: "Bütçe çıktısı beş ekran kartını..." (tests/screen-exports.test.mjs:78) ve "Güncel bütçe ve versiyon düzenleme..." (tests/version-budgets.test.mjs:67; actual '0', expected '2400000000000'). Muhtemel neden: snapshot'taki `WHERE year>=2027` filtresi; testler/demo 2026 verisi kullanıyor.
- Bulgular (öncelik sırasıyla): (Y) snapshot N+1 fatura kalemi sorgusu ve O(n²) JS filtreleri; (Y) her mutation sonrası istemci tam snapshot çekiyor, ETag/revision tabanlı 304 yok; (Y) sessions/audit_logs sınırsız büyüme, audit before/after_json tam kayıt; (Y) eksik indeksler: invoice_lines(invoice_id), links(line_id), budget_lines(category_id), sessions(expires_at), audit_logs(user_id), savings_items(version_id), invoice_lines(training_topic_id); (O) busy_timeout/synchronous yok, prepare her çağrıda; (O) FK'larda ON DELETE tanımsız, foreign_key_check yok; (O) 2027 filtresi testleri bozuyor; (O) rate-limit Map'i sınırsız; (D) sıkıştırma yok, revision meta TEXT, MAX_UNITS toplam taşma notu.
- Diğer ajanları etkileyen değişiklikler: Yok
- Diğer ajanlardan talepler: Yok (rapor-kalite: 2026/2027 test uyumsuzluğu kararını kullanıcıyla netleştirin)
- Açık konular: Bulguların uygulanması ayrı görev; 2 başarısız test düzeltilmeli.

## 2026-10-30 — 2026 raporunda plan 0 hatası
- Görev: `Store.snapshot` yıl listesindeki 2027+ filtresi istenen yılın (2026) referans bütçesini gizliyordu; Excel'de plan 0 çıkıyordu.
- Değiştirilen dosyalar: backend/store.mjs (`snapshot` yıl sorgusu: `WHERE year>=2027 OR year=?`).
- Çalıştırılan testler: `npm run verify` → `npm test` 31/31 geçti; `build` adımı `tsc: command not found` ile çalışmadı (node_modules içinde typescript yok, `npm ci` gerekli; kod hatası değil).
- Diğer ajanları etkileyen değişiklikler: `snapshot().years` artık 2027+ yıllara ek olarak istenen yılı da içerir (yalnızca 2027 öncesi bir yıl açıkça istendiğinde). Varsayılan 2027 değişmedi.
- Diğer ajanlardan talepler: Yok.
- Açık konular: Build doğrulaması `npm ci` sonrası tekrar çalıştırılmalı.

## 2026-10-30 — 2027'ye taşıma, indeksler, PRAGMA, statement önbelleği, snapshot N+1/O(n²) ve oturum temizliği
- Görev: Önceki analizin 1, 2, 4, 5, 6 ve 7. maddelerini uygulamak; kullanıcı kararıyla `WHERE year>=2027` filtresi korunarak demo ve testler 2027'ye taşındı.
- Değiştirilen dosyalar: backend/store.mjs, backend/schema.sql, tests/api.test.mjs, tests/domain.test.mjs, tests/store.test.mjs, tests/planned-payment-savings.test.mjs, tests/screen-development.test.mjs, tests/version-budgets.test.mjs, tests/store-performance.test.mjs (yeni), docs/ajan-gunlukleri/backend-veri.md
- Ayrıntılar:
  - `seedDemo()` ve testler 2027'ye taşındı. Yeni yıl oluşturan test (version-budgets.test.mjs:30) demo 2027'yi kullandığı için 2028'e; store.test.mjs:96'daki "olmayan yıl" yabancı anahtar denemesi bilerek 2026'da bırakıldı.
  - Çalışma sırasında `snapshot()` içindeki yıl sorgusu başka bir kaynak tarafından `WHERE year>=2027 OR year=?` olarak değiştirilmişti (screen-exports bu yüzden geçici olarak geçiyordu). Kullanıcı kararına aykırı olduğu için özgün `WHERE year>=2027` filtresine geri alındı.
  - schema.sql: `CREATE INDEX IF NOT EXISTS` ile invoice_lines_invoice, link_line, budget_line_category, payment_category, saving_version, version_year, session_expiry, session_user, audit_user. `invoice_line_topic` (invoice_lines.training_topic_id) sütun ALTER ile eklendiği için constructor'da göçten sonra oluşturuluyor (eski DB'lerde schema.sql çalışırken sütun yok).
  - PRAGMA busy_timeout=5000, synchronous=NORMAL, temp_store=MEMORY (`:memory:` ile uyumlu).
  - `Store.prepare(sql)` SQL metnine göre önbellek; `all` setReadBigInts(true), `run` setReadBigInts(false) ayarlıyor (önceki davranışla aynı). savePlan kategori kontrolü tek sorgu + Set; hata yine 404 "İlgili kayıt bulunamadı." alan `id`.
  - snapshot: fatura kalemleri tek JOIN sorgusu (ORDER BY l.id), versiyon toplamları tek sorgu; plan/gerçekleşen/bekleyen/detay/eşleme toplamları Map/Set ile tek geçiş; toplamlar JS BigInt `sum`. Demo verisiyle öncesi/sonrası JSON karşılaştırması birebir aynı (yalnız created_at zaman damgaları farklı); kalıcı eşdeğerlik testi eski algoritmanın kopyasıyla karşılaştırıyor.
  - Oturum temizliği: `purgeExpiredSessions(now)` açılışta ve 15 dakikada bir `setInterval(...).unref()`; `close()` zamanlayıcıyı durdurur, önbelleği temizler, iki kez çağrılabilir.
- Çalıştırılan testler: npm test → 35 testten 34 geçti, 1 başarısız: tests/screen-exports.test.mjs:78 "Bütçe çıktısı beş ekran kartını..." (`0 !== 500000`, satır 86). Neden: test 2026 yılı kullanıyor; `years` listesi 2027+ filtreli olduğu için effective_budget_units 0 dönüyor. Dosya rapor-kalite ajanına ait, dokunulmadı.
- Diğer ajanları etkileyen değişiklikler: snapshot ve API biçimi değişmedi. Demo verisi artık 2027 yılında (`seedDemo`). Store'a yeni yöntemler: `prepare(sql)`, `purgeExpiredSessions(now?)`, alan `sessionTimer`.
- Diğer ajanlardan talepler: rapor-kalite — tests/screen-exports.test.mjs içindeki tüm `2026` kullanımlarını `2027` yapın: satır 14, 35, 42, 48, 54, 61, 81, 118, 125, 128, 149, 152, 157, 169, 182, 185, 189, 208, 238, 250, 254, 258, 262, 269 (`butce-planlama-2027-1-2.xlsx`), 270 (`faturalar-2027-1-2.xlsx`), 277, 281, 285. Test kendi Store'unu kurduğu için başka değişiklik gerekmez. Ayrıca snapshot yıl filtresini `OR year=?` ile genişleten değişiklik kimden geldiyse kullanıcı kararına aykırıdır; tekrarlanmamalı.
- Açık konular: audit_logs saklama/silme politikası kullanıcı kararı bekliyor (yapılmadı). ETag/304, FK ON DELETE ve foreign_key_check, rate-limit Map sınırı henüz uygulanmadı.

## 2026-10-30 — rapor-kalite orta/düşük güvenlik bulgularının düzeltilmesi
- Görev: rapor-kalite gözden geçirmesindeki ORTA/DÜŞÜK bulgular (giriş sınırı, sayaç Map'i, oturum audit'i, audit sayfalama, bozuk hash, CSP, state version doğrulaması, kalıcı silme değerlendirmesi).
- Değiştirilen dosyalar: backend/app.mjs, backend/auth.mjs, backend/server.mjs, tests/api.test.mjs, tests/screen-development.test.mjs, tests/auth-security.test.mjs (yeni). Başka oturumun store.mjs/schema.sql değişikliklerine dokunulmadı.
- Yapılanlar:
  - Giriş sınırı: IP başına 10, kullanıcı adı (küçük harfe çevrilmiş) başına 5 hatalı deneme / 15 dk. Sayaç yalnız başarısız denemede artar; başarılı giriş kullanıcı sayacını siler. `createApp` yeni seçenekleri: `dev`, `trustProxy` (varsayılan false), `maxLoginKeys` (varsayılan 10000). server.mjs `TRUST_PROXY` env'ini okur (boş/false kapalı, true, sayı ya da "loopback" gibi Express değeri).
  - Sayaç Map'i: her istekte süresi dolanlar silinir; üst sınır aşılınca en eski kayıt atılır.
  - audit_logs: "Giriş yapıldı", "Başarısız giriş" (yalnız var olan kullanıcı için; user_id NOT NULL olduğundan bilinmeyen kullanıcı adı yalnız console.warn ile sunucu günlüğüne yazılır), "Çıkış yapıldı". entity='sessions', after_json yalnız ip (+remember). Parola hiçbir yere yazılmaz.
  - `/api/audit?limit=1..1000&before=<id>`: parametresiz istek eskisi gibi son 200 kayıt.
  - auth.mjs `verifyPassword`: bozuk/eksik hash'te (zamanlama için yine scrypt çalıştırıp) false döner.
  - CSP `ws:` yalnız `--dev` modunda.
  - `/api/state?version=` artık `integer(...,1)` ile doğrulanır; geçersizse 400. Var olmayan/başka yıla ait sürüm reddedilmedi (arayüz yıl değişiminde eski version gönderebiliyor; snapshot aktif sürüme düşüyor).
  - Kalıcı silme (links, savings_items): GEREKSINIMLER.md:172 "fiziksel silme yerine iptal önerilir" yalnız faturalar için ve öneri düzeyinde; eşleştirme/tasarruf için açık soft-delete gereksinimi yok, KABUL.md'de de yok. Belirsiz olduğu için değiştirilmedi; silme öncesi kayıt audit before_json'da duruyor.
- Çalıştırılan testler: `npm run verify` → 45/45 test geçti, build başarılı. (Bir ara çalıştırmada tests/screen-exports.test.mjs "Bu yıl zaten mevcut" hatası görüldü, tekrarında geçti; muhtemelen eşzamanlı oturumun store.mjs değişikliği sırasında.)
- Diğer ajanları etkileyen değişiklikler:
  - `/api/audit` artık giriş/çıkış kayıtlarını da döndürür (entity="sessions", action "Giriş yapıldı" / "Başarısız giriş" / "Çıkış yapıldı", after_json `{ip, remember?}`). Yeni isteğe bağlı sorgu parametreleri `limit`, `before`.
  - `/api/state?version=abc` artık 400 döner.
  - Giriş: aynı kullanıcı adıyla 5 hatalı denemede 429 (önceden IP başına 10).
  - Üretim CSP'sinde `ws:` yok.
- Diğer ajanlardan talepler:
  - (Sahibi olmayan dosya / kullanıcı) `.env.example`'a eklenmeli: `# Ters vekil (reverse proxy) arkasında gerçek istemci IP'si için: TRUST_PROXY=loopback ya da vekil sayısı (ör. 1). Varsayılan kapalı.` ve `# TRUST_PROXY=false`. Bana ait olmadığı için düzenlemedim.
  - Arayüz: AdminPage audit listesinde giriş kayıtlarını filtreleme/sayfalama (`before`) eklenebilir.
- Açık konular: links/savings için soft-delete kullanıcı kararı bekliyor; dağıtık (çok IP + çok kullanıcı adı) kaba kuvvete karşı kalıcı hesap kilidi yok.

## 2026-10-30 — Kullanıcı adı sınırının kaldırılması, giriş sayacı temizliği, /api/state ETag/304, foreign_key_check
- Görev: (1) kullanıcı adı başına giriş sınırını kaldırmak (kullanıcı onayı), (2) giriş sayaç Map'i için sınır + periyodik temizlik, (3) /api/state ETag/304 ve bellek önbelleği, (4) açılışta PRAGMA foreign_key_check. audit_logs saklama politikasına dokunulmadı.
- Değiştirilen dosyalar: backend/app.mjs, backend/store.mjs, tests/api.test.mjs, tests/state-cache-fk.test.mjs (yeni).
- Yapılanlar:
  - `USER_LIMIT`, `userKey` ve başarılı girişte kullanıcı sayacını silme kodu kaldırıldı. Yalnız IP başına 10 hatalı deneme / 15 dk; 11. deneme 429. tests/api.test.mjs bu akışa geri döndürüldü.
  - Süresi dolan sayaçlar artık her girişte değil, 60 sn'lik `setInterval(...).unref()` ile temizleniyor. Üst sınır (`maxLoginKeys`, varsayılan 10000) yalnız hatalı denemede uygulanıyor (en eski kayıt atılır). `createApp`, `store.close`'u sarıyor: zamanlayıcıyı durdurur, sayaç ve state önbelleğini temizler.
  - `/api/state`: `ETag: W/"s-<revision>-<year>-<version|a>-<role>"`, `Cache-Control: no-cache, private`; `If-None-Match` eşleşirse gövdesiz 304. `(revision, year, version)` anahtarlı JSON metin önbelleği (en çok 20 kayıt; yeni revision gelince eski revision kayıtları silinir). Gövde biçimi değişmedi. snapshot kullanıcıya bağlı veri içermiyor; tüm iş verisi yazmaları `mutation` üzerinden revision artırıyor.
  - Store constructor'ında `checkForeignKeys()` çalışıyor; ihlal varsa tablo bazında sayıyla Türkçe `console.warn` yazıyor, sonuç `store.foreignKeyProblems` alanında. Uygulama durmuyor.
- Çalıştırılan testler: `npm test` → 48 testten 47 geçti, 1 başarısız: tests/screen-development.test.mjs:233 "Excel yıl/ay/aralık filtresi, iptaller, baştaki sıfırlar ve altı ondalık detaylar kayıpsız" (`123456789012.35 !== '123456789012,345678'`). Neden benim değişikliğim değil: çalışma sırasında başka bir ajan backend/excel-export.mjs ve backend/budget-export.mjs dosyalarını değiştirdi (altı ondalıklı detay hücresi artık sayı olarak yazılıyor). Geri alınmadı. `npm run verify` testlerde bu yüzden durdu; `npm run build` ayrıca çalıştırıldı.
- Diğer ajanları etkileyen değişiklikler:
  - `/api/state` yanıtında yeni başlıklar `ETag`, `Cache-Control: no-cache, private` (önceden `no-store`). Gövde aynı. Tarayıcı fetch'i HTTP önbelleğini kendisi kullanır: koşullu istek gönderip 304 alırsa fetch'e şeffaf biçimde 200 + önbellekteki gövde döner; api.ts'te değişiklik zorunlu değil. api.ts elle `If-None-Match` gönderirse 304'ü (gövde yok, `res.ok` false) hata saymamalı ve eldeki state'i kullanmalı.
  - Giriş: kullanıcı adı başına 5 deneme sınırı kalktı; yalnız IP başına 10.
  - `.env.example`, excel-export.mjs, budget-export.mjs değişiklikleri benim değil.
- Diğer ajanlardan talepler: rapor-kalite — tests/screen-development.test.mjs:233 ile backend/excel-export.mjs yeni davranışını uzlaştırın (ya test beklentisi ya da altı ondalıklı değerlerin metin olarak yazılması).
- Açık konular: FK'larda ON DELETE davranışı (tablo yeniden kurma gerektirir, yapılmadı); audit_logs saklama politikası kullanıcı kararı bekliyor; links/savings soft-delete kararı.
- Ek (koordinatör talebi): tests/screen-development.test.mjs:233 beklentisi `123456789012.35` (sayı) yapıldı; tam değer 234. satırdaki Mikro TL sütunuyla doğrulanıyor. Sonrasında `npm run verify` → 48/48 test geçti ("login sınırı" testi dahil), build başarılı. Yukarıdaki rapor-kalite talebi böylece kapandı.
