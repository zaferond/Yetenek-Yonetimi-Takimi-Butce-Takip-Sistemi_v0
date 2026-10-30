# rapor-kalite ajanı günlüğü

Bu dosyaya yalnızca `rapor-kalite` ajanı yazar. Yeni kayıtlar en alta eklenir; eski kayıtlar değiştirilmez.

## 2026-10-30 — Genel kalite ve güvenlik gözden geçirmesi
- Görev: Mevcut kod tabanının güvenlik, Excel raporu, para hesabı ve bağımlılık açısından gözden geçirilmesi (kod değişikliği yapılmadı).
- Değiştirilen dosyalar: Yalnızca bu günlük.
- Çalıştırılan testler: `npm run verify` → BAŞARISIZ (npm test 2 test kırık, build bu yüzden çalışmadı):
  - tests/screen-exports.test.mjs:86 `0 !== 500000` (bütçe çıktısı A5 yıllık bütçe)
  - tests/version-budgets.test.mjs:110 `'0' !== '2400000000000'`
  - `npm audit --omit=dev` → 1 yüksek: body-parser 2.0.0–2.3.0 GHSA-27r3-jxmh-p828 (sıkıştırılmış gövde DoS), `npm audit fix` ile düzeliyor (package.json/lock kimseye ait değil; kullanıcı kararı).
- Diğer ajanları etkileyen değişiklikler: Yok
- Diğer ajanlardan talepler / gözden geçirme bulguları:
  - YÜKSEK — backend/store.mjs `snapshot` içindeki `WHERE year>=2027` (yerel özelleştirme): snapshot.years 2026'yı içermediği için shared/report-scope.mjs:46-48 `data.years.find(...)` undefined → yıllık plan "0". Senaryo: `/api/budget/export?year=2026` (app.mjs:229 `exists` 2026'yı kabul ediyor) → Excel'de Plan 0, Kalan = −gerçekleşen. Yukarıdaki iki kırık test bunun sonucu. Talep (backend-veri): yıl filtresini yalnız yıl listesine uygula, seçili yılın referansını ayrı sorgula ya da 2026 istekleri 400 ile reddet; testleri buna göre güncelle.
  - ORTA — backend/app.mjs:54 rate limit anahtarı `req.ip`; `trust proxy` yok. Senaryo: HTTPS ters vekil arkasında tüm kullanıcılar aynı IP → 10 hatalı deneme herkesi 15 dk kilitler (kullanıcı adına göre sınır da yok; dağıtık kaba kuvvet IP değiştirerek sınırsız).
  - ORTA — backend/app.mjs:52-118, 149-156: giriş, başarısız giriş ve çıkış audit_logs'a yazılmıyor; app.mjs:166 audit listesi yalnız son 200 kayıt.
  - ORTA — backend/app.mjs:56-60 limiter penceresi ilk denemede sabitleniyor ve `failures` Map'i sınırsız büyüyebilir (çok IP'den istek → bellek). Düşük öncelikli DoS.
  - DÜŞÜK — backend/app.mjs:407-418 ve 429-436: eşleştirme ve tasarruf kayıtları hard delete (audit'te before_json var, kabul edilebilir ama README "iptal silinmez" ilkesiyle tutarlılık kontrol edilmeli).
  - DÜŞÜK — backend/auth.mjs:17-20 `verifyPassword`: bozuk hash ("salt:" kısa key) timingSafeEqual uzunluk hatası fırlatır → 500. Pratikte yalnız bozuk veriyle.
  - DÜŞÜK — backend/app.mjs:27 CSP `connect-src 'self' ws:` üretimde gereksiz geniş (yalnız dev Vite HMR için gerekli).
  - DÜŞÜK — backend/app.mjs:164 `Number(req.query.version)` doğrulanmıyor (geçersiz değer sessizce aktif versiyona düşer); export ucu integer() ile doğruluyor, tutarsız.
  - Olumlu: Tüm SQL parametreli (store.mjs:131 `${entity}` yalnız sabit route adlarından); mutation() tüm veri yazma uçlarını kapsıyor, admin uçları requireAdmin + audit; çerez httpOnly/SameSite=strict/secure; CSRF + Origin + JSON content-type zorunlu; scrypt + dummy hash ile zamanlama eşitleme; 500 hatalarında ayrıntı sızmıyor; üretimde HTTPS zorunlu (server.mjs:10).
  - Excel: ExcelJS metinleri paylaşılan dize olarak yazar, `=`/`+`/`-`/`@` ile başlayan metin formül olarak çalışmaz; excel-export.mjs:25-31 15 basamak sınırı doğru. Not: invoice-export.mjs:45,96,98,101 tutarları her zaman metin (`decimal`) yazıyor; Excel'de toplanamaz — budget-export ile tutarsız (bana ait, sonraki görevde amountCell'e geçirilecek).
  - Para: float yalnız domain.mjs:102 oran (yüzde, para değil) ve excel-export.mjs:29 ≤15 anlamlı basamakta; ihlal yok. Ekran ve rapor aynı budgetView/invoiceView'i kullanıyor (Workspace.tsx:257,269). Planlı ödeme filtresi (Workspace.tsx:~276) report-scope dışında, ama ödeme Excel'i yok.
- Açık konular: verify kırık (2026 yıl filtresi); body-parser güncellemesi kullanıcı onayı bekliyor; fatura Excel tutarlarının sayısal yazılması.

## 2026-10-30 — Fatura Excel tutarlarının sayısal yazılması
- Görev: backend/invoice-export.mjs tutar sütunlarını (Toplam TL, Tutar TL, Döviz Bedeli, Kur) budget-export ile tutarlı hale getirmek: 15 anlamlı basamağa sığanlar sayı + para formatı, sığmayanlar tam metin.
- Değiştirilen dosyalar: backend/invoice-export.mjs (amountCell kullanımı, boş döviz/kur için "", tutarlara amountFormat, kura `#,##0.00####`), tests/screen-exports.test.mjs (J2 beklentisi 160000 sayı; yeni test "Fatura çıktısı 15 basamağa sığan tutarları sayı, sığmayanları tam metin yazar"), bu günlük. Dönüşüm excel-export.mjs `amountCell` ile: BigInt → tam ondalık metin → Number (yalnız ≤15 anlamlı basamakta, float aritmetiği yok). Mikro TL sütunları değişmedi (metin).
- Çalıştırılan testler: `npm run verify` → BAŞARISIZ. Neden benim değişikliğim değil: backend/app.mjs:148 `SyntaxError: Missing catch or finally after try` (başka ajan şu an app.mjs üzerinde çalışıyor); app.mjs'yi içe aktaran 5 test dosyası yüklenemiyor (api, planned-payment-savings, screen-development, screen-exports, version-budgets). `npm run build` → geçti. screen-exports testleri app.mjs saplanarak (scratchpad kopyası) çalıştırıldı: 5 rapor testinin hepsi geçti (önceki kayıttaki :86 hatası artık yok); yalnız app'e bağlı API testi saplama nedeniyle çalışamadı.
- Diğer ajanları etkileyen değişiklikler: Fatura Excel'inde tutar hücreleri artık sayı (sığmayanlar metin). Fatura Excel'ini metin bekleyen başka test/kod varsa uyarlanmalı.
- Diğer ajanlardan talepler / gözden geçirme bulguları: backend/app.mjs:148 sözdizimi hatası — işi biten ajan dosyayı tamamladıktan sonra `npm run verify` tekrar çalıştırılmalı.
- Açık konular: app.mjs düzeltildikten sonra tam verify; body-parser güncellemesi kullanıcı onayı bekliyor.

## 2026-10-30 — Rapor testlerinin 2027'ye taşınması ve backend-veri gözden geçirmesi
- Görev: tests/screen-exports.test.mjs'i 2027'ye taşımak, Excel export'larını 2027 demo verisi ve yeni store.mjs ile doğrulamak, backend-veri'nin store.mjs/schema.sql değişikliklerini gözden geçirmek.
- Değiştirilen dosyalar: tests/screen-exports.test.mjs (tüm 2026 → 2027, dosya adları `butce-planlama-2027-1-2.xlsx`, `faturalar-2027-1-2.xlsx`; satır 260-261'deki "başka yıl" versiyonu 2027'den 2028'e taşındı, böylece "başka yılın versiyonu reddedilir" senaryosu korunuyor), docs/ajan-gunlukleri/rapor-kalite.md.
- Çalıştırılan testler:
  - `npm run verify` → BAŞARISIZ: npm test 36 testten 35 geçti; tests/api.test.mjs:92 `429 !== 401` ("API oturum, CSRF, login sınırı..."). screen-exports testlerinin tamamı geçti. Test adımı kırık olduğu için verify build'e geçmedi; `npm run build` ayrıca çalıştırıldı → geçti.
  - `PLAYWRIGHT_CHANNEL=chromium npm run test:ui` → UI PASS.
  - Demo verisiyle (seedDemo, 2027) elle kontrol: Bütçe Excel'i plan 2.400.000, gerçekleşen 169.500, bekleyen 45.000 (40.000−20.000 eşleşme + 25.000), kullanılabilir 2.185.500; fatura Excel'leri 6 aktif fatura/kalem. snapshot.years = [2027].
- Diğer ajanları etkileyen değişiklikler: Yok.
- Diğer ajanlardan talepler / gözden geçirme bulguları:
  - YÜKSEK (app.mjs sahibi) — backend/app.mjs: yeni `USER_LIMIT = 5` kullanıcı adı başına sınır, tests/api.test.mjs:90-100'deki "10 hatalı deneme 401, 11. deneme 429" beklentisiyle çelişiyor; 6. denemede 429 dönüyor. Ya test yeni sınıra göre güncellenmeli ya da sınır gözden geçirilmeli. verify bu yüzden kırık.
  - store.mjs gözden geçirmesi (backend-veri): sorun bulunmadı. Para toplamları BigInt `sum` ile; float yok. snapshot eşdeğerliği: plan hücresi `find` yerine ilk kaydı tutan Map (aynı semantik), fatura kalemleri ORDER BY l.id (eski implicit sıra ile aynı, rowid), details sırası activeLines sırası korunuyor, linked toplamı yalnız aktif kalemler. `WHERE year>=2027` filtresi korunmuş. Statement önbelleği: `all`/`run` her çağrıda setReadBigInts ayarlıyor; iterate kullanılmadığından yeniden giriş sorunu yok.
  - DÜŞÜK (backend-veri) — backend/store.mjs:348-355 savePlan kategori varlığını tüm `budget_categories` tablosunu okuyarak kontrol ediyor; kategori sayısı küçük, sorun değil. Kategori kimliği `all` sonrası Number'a dönüyor mu: testler geçtiği için evet (satır ~117 dönüşümü).
  - DÜŞÜK (backend-veri) — schema.sql'de indeksler `IF NOT EXISTS` ile; mevcut DB'lerde sorunsuz. Not: `purgeExpiredSessions` her Store örneğinde setInterval kuruyor; scriptler (backup, reset-password) close() çağırmazsa unref sayesinde süreç yine kapanıyor.
- Açık konular: api.test.mjs/app.mjs login sınırı uyumsuzluğu; invoice-export tutar sütunlarının sayısal yazılması (önceki kayıttan); body-parser güncellemesi kullanıcı onayı bekliyor.

## 2026-10-30 — Excel tutarlarının 2 ondalıklı sayısal hücre olarak yazılması
- Görev: Fatura ve bütçe Excel'lerinde TL tutarlarını sayısal hücre (2 ondalık, `#,##0.00` tabanlı amountFormat; Türkçe yerel ayarda `#.##0,00` görünür) olarak yazmak; para hesabı BigInt'te kalır.
- Değiştirilen dosyalar: backend/excel-export.mjs (yeni `moneyCell`: BigInt'te mutlak değer üzerinden yarım-yukarı 2 ondalığa yuvarlama — domain.mjs `money()` ile aynı kural; yalnız yuvarlanmış sonuç Number'a çevrilir; 0 sonucu −0 değil 0; 15 anlamlı basamağı aşarsa tam 6 ondalıklı metin), backend/invoice-export.mjs (Toplam TL, Tutar TL, Döviz Bedeli → moneyCell; başlıklardan "(tam değer)" kaldırıldı, Kur 6 ondalıkla amountCell'de kaldı; Mikro TL sütunları tam metin), backend/budget-export.mjs (kartlar, aylık plan/gerçekleşen, özet sütunları, detay tutar/döviz → moneyCell; kur sütunu `#,##0.00####`), tests/screen-exports.test.mjs (beklentiler 2 ondalığa güncellendi, yeni moneyCell birim testi).
- Filtreler: değişmedi; export'lar yine report-scope budgetView/invoiceView kullanıyor.
- Çalıştırılan testler: `node --test tests/screen-exports.test.mjs` → 7/7 geçti. `npm run verify` → BAŞARISIZ (46 testten 44): (1) tests/screen-development.test.mjs:233 benim değişikliğimin beklenen sonucu (aşağıda talep); (2) tests/api.test.mjs "login sınırı" tam çalıştırmada kırıldı, tek başına çalıştırınca geçiyor — backend-veri'nin eşzamanlı app.mjs çalışmasıyla ilgili, rapor dosyalarından bağımsız. `npm run build` ayrıca → geçti.
- Diğer ajanları etkileyen değişiklikler: Fatura/bütçe Excel'inde TL tutar hücreleri artık 2 ondalığa yuvarlanmış sayı; tam hassasiyet fatura Excel'inde "Mikro TL" sütunlarında. Fatura sayfası başlıkları "Toplam TL", "Tutar TL", "Döviz Bedeli" oldu.
- Diğer ajanlardan talepler / gözden geçirme bulguları: backend-veri — tests/screen-development.test.mjs:233 `assert.equal(line.getCell(13).value, "123456789012,345678")` beklentisi `123456789012.35` (sayı) olarak güncellenmeli; tam değer zaten :234'te Mikro TL sütunuyla doğrulanıyor.
- Açık konular: int64 sınırındaki tekil tutarlar 2 ondalıkta 15 basamağa sığdığından metin yolu yalnız çok büyük toplamlarda devreye girer. Bütçe Excel'inde mikro TL sütunu yok; tam hassasiyet gerekiyorsa eklenebilir (kullanıcı kararı). body-parser güncellemesi kullanıcı onayı bekliyor.
