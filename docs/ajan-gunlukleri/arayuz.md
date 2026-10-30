# arayuz ajanı günlüğü

Bu dosyaya yalnızca `arayuz` ajanı yazar. Yeni kayıtlar en alta eklenir; eski kayıtlar değiştirilmez.

## 2026-10-30 — Tasarım gözden geçirme ve okunabilirlik iyileştirmeleri
- Görev: frontend-design rehberiyle arayüzü gözden geçirmek; kullanıcının belirlediği yön (mürdüm tema, IBM Plex Sans, düz giriş zemini) korunarak okunabilirlik, sayı taraması, hiyerarşi ve erişilebilirliği iyileştirmek.
- Tasarım planı: Mevcut palet korundu (mürdüm #665078, koyu mürdüm #302A39, metin #302C35, ikincil #6B6472, zemin #F7F6F4, çizgi #DED9E2). Ölçülü cesaret tek yerde kullanıldı: "Kullanılabilir bütçe" kartı giriş panelindeki koyu mürdüm zemine geçti (EKRAN planındaki "kullanılabilir bütçe zeminini koyulaştır" talebi). Diğer her şey sakin tutuldu: tutarlar ve başlıkları sağa hizalı, uygulama genelinde tabular rakam, tablo metni 12 → 13 px, durum rozetleri duruma göre farklı tonda. Eşit aralıklı yazı tipi, gradyan, büyük harfli üst etiket gibi şablon kalıpları eklenmedi; modal üstündeki gereksiz "YETENEK YÖNETİMİ" etiketi kaldırıldı.
- Değiştirilen dosyalar:
  - frontend/src/styles/tokens.css: `--on-dark*`, `--shadow-hover`, ana sayfa çizim renkleri (`--art-*`), `--fs-metric`, `--fs-metric-hero`, `--duration-fast`; kökte `font-variant-numeric: tabular-nums`.
  - frontend/src/style.css: sabit `white` değerleri token'a geçti; h1/h2 token ölçüleri; bütçe tablosu 13 px, ay/özet başlıkları sağa hizalı, plan hücreleri beyaz zeminli ve ince kenarlı (salt okunurda düz rakam), hücre genişliği 6 ondalığı kesmeyecek kadar artırıldı; liste tablosu 13 px, satır dolgusu 17 → 12 px, `th/td.numeric` sağa hizalı, sayılar normal ağırlıkta; `.status.planned/.partial/.done` tonları; `.eyebrow` kaldırıldı; reduced-motion tüm geçiş/animasyonları kapatıyor.
  - frontend/src/styles/workspace.css: koyu "Kullanılabilir bütçe" kartı (negatif değer koyu zeminde okunur açık kırmızı), ana sayfa çizim renkleri token'dan, h1 odak göstergesi kutu yerine alt çizgi, modal başlığı `--fs-xl`, kenar menü etiketi harf aralıksız, `.add-line` boşluğu.
  - frontend/src/login.css: sabit `white` ve `#ded3e5` değerleri `--on-dark` / `--on-dark-muted` token'larına geçti (görünüm aynı).
  - frontend/src/Workspace.tsx: tutar/katılımcı başlıklarına `numeric` sınıfı; planlı ödeme rozetine durum sınıfı (Planlandı/Kısmi fatura/Tamamlandı/İptal); "TOPLAM" → "Toplam". İş mantığı ve hesaplar değişmedi.
  - frontend/src/ui.tsx: modal başlığındaki "YETENEK YÖNETİMİ" üst etiketi kaldırıldı.
  - frontend/src/components/WorkspaceSidebar.tsx: "ÇALIŞMA ALANI" → "Çalışma alanı".
  - frontend/src/InvoiceEditor.tsx: "Eğitim kalemi ekle" düğmesine `add-line` sınıfı (Not alanıyla yapışık duruyordu).
  - scripts/ui-check.mjs: backend-veri'nin `seedDemo()` verisini 2027'ye taşımasına uyum; 2027 → 2028 (yeni yıl), 2026 → 2027 (demo yılı) beklentileri.
- Çalıştırılan testler:
  - Başlangıçta `npm run test:ui` → BAŞARISIZ (ui-check.mjs:329 "Değişiklikler kaydedildi." beklenirken zaman aşımı). Neden: demo verisi 2026'da, yıl listesi 2027+ ile sınırlı; yıl seçimi boş kalıyordu. Tasarım değişikliğinden bağımsızdı.
  - Önce/sonra karşılaştırması için scratchpad'de demo verisini 2027'ye kaydıran geçici bir ui-check kopyası çalıştırıldı → önce ve sonra UI PASS.
  - Bir ara `backend/app.mjs` başka ajanın eşzamanlı düzenlemesi sırasında "Missing catch or finally after try" sözdizimi hatası verdi; dosya düzelince tekrar denendi.
  - Son durum: `npm run build` → geçti; `npm run test:ui` (yerel Chrome) → UI PASS.
- Diğer ajanları etkileyen değişiklikler: `scripts/ui-check.mjs` artık demo yılını 2027, yeni yıl denemesini 2028 olarak bekliyor. API/snapshot kullanımı değişmedi.
- Diğer ajanlardan talepler: Yok.
- Açık konular: Plan hücreleri düzenleme biçimini (`12700`, binlik ayırıcı yok) gösteriyor; gerçekleşen satırı `17.000,00` biçiminde. Ayrımı korumak için değiştirilmedi; istenirse odak dışı biçimli gösterim ayrı iş olarak ele alınabilir. Mobilde bütçe paneli araç çubuğu (Boş kalemleri gizle / Detaylar / Kalemler) iki satıra düzensiz kırılıyor ve detay başlığı kesiliyor; bu turda ele alınmadı. Giriş ekranındaki büyük harfli etiketler kullanıcının tasarım planında yer aldığı için korundu. Programatik odak sonrası h1 altındaki çizgi fare kullanıcılarında da görünebilir (Chrome :focus-visible sezgisi).

## 2026-10-30 — İşlem geçmişi: oturum süzgeci ve sayfalama
- Görev: AdminPage audit listesini yeni `/api/audit?limit&before` API'sine uyarlamak; oturum kayıtları (entity='sessions') için göster/gizle süzgeci.
- Değiştirilen dosyalar: frontend/src/components/AdminPage.tsx (CSS değişmedi; mevcut sınıflar kullanıldı).
- Ayrıntılar: Sayfa boyutu 200; "Daha fazla yükle" son kaydın id'si ile `before` gönderir, dönen kayıt sayısı 200'den azsa düğme gizlenir. "Oturum kayıtlarını göster (giriş/çıkış)" onay kutusu varsayılan açık (önceki UX'te tüm kayıtlar görünüyordu); süzme yüklenen kayıtlar üzerinde istemcide yapılır. Başlıkta gösterilen/yüklenen kayıt sayısı.
- Çalıştırılan testler: npm test → 48/48 geçti; npm run build → başarılı; PLAYWRIGHT_CHANNEL=chromium npm run test:ui → BAŞARISIZ: plan hücresi "LEAD Liderlik & Agile Eğitimler Ocak planı" beklenmeyen değer "12700100.000,123456" (tutar girişi biçimlendirme adımı). AdminPage ile ilgisi yok; çalışma klasöründeki commit edilmemiş başka değişikliklerden kaynaklanıyor olabilir, incelenmedi.
- Diğer ajanları etkileyen değişiklikler: Yok
- Diğer ajanlardan talepler: Yok (ileride çok sayıda oturum kaydı olursa sunucu tarafı `entity` süzgeci faydalı olur — backend-veri, isteğe bağlı).
- Açık konular: test:ui'deki plan tutarı hatası; ui-check'e audit süzgeci/sayfalama senaryosu eklenmedi.

## 2026-10-30 — Açık arayüz konuları: mobil araç çubuğu, biçimli plan hücreleri, kenar çubuğu, başlık odağı
- Görev: İlk turdan açık kalan dört konu (koordinatör talebi).
- Değiştirilen dosyalar:
  - frontend/src/Workspace.tsx: Plan hücreleri odak dışındayken `money(units, max(2, ondalık sayısı))` ile Türkçe biçimli görünüyor (12700 → 12.700,00; 6 ondalıklı değer yuvarlanmadan 100.000,123456). Odaklanınca `editAmount` biçimine dönüyor. Değişiklik yalnız gösterimde: taslak, gönderilen değer ve doğrulama aynı. Odak anında değer `flushSync` ile eşzamanlı değişip `select()` ile seçiliyor; aksi halde tarayıcı seçimi sıfırlanıyor ve yazılan metin eski değerin sonuna ekleniyordu (test sırasında bulundu: "12700100.000,123456"). Ayrıca belgeye son giriş yöntemi (`data-input="pointer"|"keyboard"`) işaretleniyor.
  - frontend/src/styles/workspace.css: `html[data-input="pointer"]` durumunda h1 odak alt çizgisi gizleniyor; çizgi yalnız klavyeyle gezinmede görünüyor. ≤600 px'te panel araç çubuğu esnek kutu düzenine geçti: onay kutusu tek satırda, düğmeler eşit paylaşıyor; tek düğme tam genişlikte. Detay başlığı (`.detail-inner h3`) artık satır kırıyor.
  - scripts/ui-check.mjs: Yeniden yükleme sonrası hücre önce biçimli ("100.000,123456"), odakta düzenleme biçiminde ("100000,123456"), odaktan çıkınca yine biçimli bekleniyor; yalnız odaklanmak taslak oluşturmuyor ("Bütçeyi kaydet" görünmüyor). Rapor-kalite ajanının Excel TL tutarlarını 2 ondalıklı sayıya çevirmesine uyum: A5/E5 beklentileri `money()` metninden üretiliyor; float hesap yok.
- Kenar çubuğu: Gerçek yerleşim hatası değil. `.workspace-sidebar` `position: fixed; top: 64px; bottom: 0`; sayfa sonuna kaydırıldığında da görünür alanın altına (982/982 px) kadar uzanıyor. Önceki görüntüdeki kısa zemin Playwright'ın tam sayfa yakalamasından kaynaklanıyor; CSS değiştirilmedi.
- Çalıştırılan testler:
  - Hedefli doğrulama betiği (scratchpad): 1512/768/390 px'te yatay taşma yok (detay açıkken ve ödemelerde de); hücre "12.700,00" → odakta "12700"; h1 tıklamayla gezinmede `text-decoration: none`, klavyeyle (menü + Enter) `underline`.
  - `npm run test:ui` ilk denemede iki kez BAŞARISIZ oldu: (1) ui-check.mjs:318, yukarıdaki seçim sıfırlanması hatası, düzeltildi; (2) ui-check.mjs:802, Excel A5 beklentisi 113700.123456, gelen 113700.12 (rapor-kalite değişikliği), ui-check uyarlandı.
  - Son durum: `npm run build` → geçti; `npm run test:ui` (yerel Chrome) → UI PASS.
- Diğer ajanları etkileyen değişiklikler: Yok. API ve snapshot kullanımı değişmedi.
- Diğer ajanlardan talepler: Yok.
- Açık konular: Fareyle tıklamada imleç tıklanan noktada kalabilir; tümünü seçme garanti değil, Tab ile ve programatik odakta garanti. frontend/src/components/AdminPage.tsx bu oturumda başka bir kaynak tarafından değiştirilmiş (60+ satır); dokunulmadı. Mobilde detay tablosu kendi alanında yatay kayıyor (kabul edilen davranış).
