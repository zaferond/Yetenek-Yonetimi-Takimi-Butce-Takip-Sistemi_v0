# Yerel kabul ve mevcut sınırlar


## 24 Ekim 2026 — Ekran talepleri ve Admin geliştirmesi

Kaynak ve kararlar: [Ekran geliştirme planı](EKRAN-GELISTIRME-PLANI.md).

- `npm test`: **14 test başarılı**. Yeni kapsam: eski veritabanında rol geçişi ve yeniden açılış; Admin erişim yasağı; görüntüleyicinin yazma yasağı; son yönetici koruması; rol değişikliğinde oturum iptali; parola içermeyen loglar; Excel dönem sınırları/sıfırlı numaralar/iptaller/altı ondalık; çok detaylı faturanın numarasıyla eşleştirilmesi; mükerrer düşümün engellenmesi; bütçe değişikliği var/yok bilgisi.
- `npm run build`: TypeScript ve üretim derlemesi başarılı.
- `node scripts/ui-check.mjs`: genişletilmiş tarayıcı akışı başarılı. Admin kullanıcı oluşturma, görüntüleyici hesabında kapalı yazma alanları, dönem aralığı seçimi ve indirilen `.xlsx` içeriği, yıl bütçesi Güncelleme ve satır içi yeni yıl kaydı da doğrulandı. Önceki fatura/plan/iptal/oturum senaryoları yeni arayüze uyarlandı.
- 390/768/1366/1512/1920 px görünüm ve gerçek Chrome %200 yakınlaştırma kontrol edildi. Mobil yeni yıl formundaki taşma giderildi.
- İşlem geçmişi yalnız Admin ekranında; ana sayfada karşılama/açıklama ve filtre alanları yok. Yeni fatura eylemi yalnız Faturalar ekranında. Birim adı **İnsan, Kültür ve Dönüşüm Liderliği**.
- Testler bellek/geçici veritabanlarında çalıştı. Mevcut yerel iş kayıtları korunarak şema geçişi uygulandı; öncesinde doğrulanan SQLite yedeği alındı. Admin giriş bilgileri değiştirilmedi.

Görseller: [Ana Sayfa](../test-results/home.png), [Admin](../test-results/admin.png), [Fatura numarasıyla eşleştirme](../test-results/payment-match.png), [Versiyon ve yıl bütçesi](../test-results/savings.png).

Excel'deki para değerleri hassasiyet kaybını önlemek için metin ve mikro birim sütunlarıyla aktarılır. MSSQL şema/aktarım dosyaları güncellendi; gerçek SQL Server testi yapılmadı. Aşağıdaki önceki tarihli kabuller, o aşamanın davranışını belgeler; güncel akış yukarıdadır.

## 24 Ekim 2026 — İnsan Kaynakları arayüzü

Tasarım planının P0/P1 işleri uygulanmıştır. Kullanıcının renk uyarlaması isteğiyle sıcak kırık beyaz/mürdüm teması, görselsiz düz giriş, dört kartlı Ana Sayfa, kompakt üst çubuk ve açılır yan menü kullanılır. Fontlar yereldir; araç arka planı kaynak varlıklardan kaldırılmıştır.

Doğrulama ortamı: macOS, Node.js 24.21.0 ve yerel Chrome. Testler yalnızca `:memory:` SQLite üzerinde kurgu kayıtlar kullanır. %200 yakınlaştırma senaryosu geçici bir Chrome profilinde çalışır; kullanıcının tarayıcı profiline dokunmaz.

### Sonuçlar

- `npm test`: 9 alan/API/kalıcılık testi başarılı.
- `npm run build`: TypeScript ve Vite üretim derlemesi başarılı.
- `node scripts/ui-check.mjs`: genişletilmiş uçtan uca kabul akışı başarılı.
- Giriş ve oturum yenilemede arka plan resminin bulunmadığı, araç görselleri için ağ isteği yapılmadığı doğrulandı.
- Dört ana sayfa kartı ve yan menü hedefleri; klavyeyle kart açma; aktif menü işareti; menüyü kapatma/açma doğrulandı.
- Yıl/versiyon ve ay/kategori bağlamının korunması, bölümlere özel arama metni, filtreleri temizleme ve ay filtresinde tüm ay sütunlarının görünmesi doğrulandı.
- Kaydedilmemiş bütçeyle gezinme onayını iptal etme taslağı korur. Fatura penceresini kapatma onayını iptal etme alanları korur.
- Altı ondalıklı plan kaydı ve sayfa yenileme sonrası kalıcılık; zorunlu/geçersiz tutar doğrulaması; oturum yenilenirken fatura taslağının korunması doğrulandı.
- İki eğitim kalemli faturada kayıt, EUR/kur üzerinden TL önerisini uygulama, ilk kalemi düzenleme ve toplamın güncellenmesi doğrulandı.
- Kısmi eşleştirme, aynı eşleştirmeyi tam tutara güncelleme, uygun bakiye göstergeleri ve fatura iptalinde bekleyen ödemenin yeniden açılması doğrulandı.
- Yeni plan versiyonu oluşturma faturaları çoğaltmaz; aktif versiyon ve tasarruf görünümü çalışır.
- Mobil menüde Tab döngüsü, Escape ile kapanış ve Menü düğmesine odak dönüşü doğrulandı. Ortak form ve oturum yenileme pencerelerinde de Tab sınırları uygulanır.
- 390 × 844, 768 × 1024, 1366 × 768, 1512 × 982 ve 1920 × 1080 ölçülerinde sayfa yatay taşması kontrol edildi. 390 × 550 kısa giriş ekranı ve mobil fatura penceresi ayrıca incelendi.
- **Gerçek Chrome %200 sayfa yakınlaştırması** ayarlar ekranından etkinleştirildi: 1366 px pencere yaklaşık 683 CSS px çalışma genişliğine dönüştü. Ana sayfa, bütçe, mobil menü ve fatura alanları/eylemleri kontrol edildi. Formlarda yalnız içerik gövdesi kayar; başlık ve işlem düğmeleri görünür kalır. Odaklanan alanın gövde sınırları içinde bütünüyle görünmesi ayrıca doğrulanır. Bu doğrulama CSS `zoom` benzetimi değildir.
- İlk veri yükleme hatasının ardından Tekrar dene ile toparlanma; boş versiyon/fatura/bütçe durumları ve sonuç bulunamaması kontrol edildi.
- Temel metin/yüzey çiftlerinde hesaplanan kontrastlar 4,5:1 üzerindedir: gövde 12,65:1, ikincil metin beyazda 5,69:1, ikincil yüzeyde 4,92:1, ana düğme 7,04:1, giriş tanıtım metni 9,60:1. Bu kontrol tam erişilebilirlik sertifikasyonu değildir.

### Görsel kanıtlar

Başlangıç görüntüleri `test-results/before/`, yeni ekranlar `test-results/` altında tutulur. Giriş, Ana Sayfa, açık/kapalı menülü bütçe, fatura formu, ödeme eşleştirme, versiyon/tasarruf, mobil ekranlar ve %200 görünüm kontrol edilmiştir.

- [Giriş](../test-results/login.png) · [Ana Sayfa](../test-results/home.png) · [Bütçe ve yan menü](../test-results/budget.png)
- [Faturalar](../test-results/invoices.png) · [Fatura formu](../test-results/invoice-form.png) · [Ödeme eşleştirme](../test-results/payment-match.png) · [Versiyon ve tasarruf](../test-results/savings.png)
- [Mobil Ana Sayfa](../test-results/mobile-home.png) · [Mobil menü](../test-results/mobile-menu.png) · [Mobil fatura](../test-results/mobile-invoice-form.png) · [Mobil tasarruf](../test-results/mobile-savings.png)
- [%200 Ana Sayfa](../test-results/home-zoom-200.png) · [%200 bütçe](../test-results/budget-zoom-200.png) · [%200 fatura](../test-results/invoice-zoom-200.png)

Ekran görüntüleri Git dışında tutulur ve UI testiyle yeniden üretilir. Tasarım testinde anlık başarı bildirimi yalnız ekran görüntüsü alınırken gizlenir; uygulamadaki bildirim davranışı korunur.

### Bu çalışmanın sınırı

P2 ana sayfa kısayolları/grafikleri ve eğitim başlığı entegrasyonu sonraki geliştirme önerileridir. Bu arayüz kabulü Safari/Firefox, Windows veya kurumun MSSQL ortamı doğrulaması değildir. Önceki iş kuralları ve aşağıdaki işletim sınırları geçerlidir.

## 18 Ekim 2026 — İlk sürüm kabulü

18 Ekim 2026 tarihinde Node.js 24.21.0 / macOS / Chrome üzerinde yerel doğrulama yapıldı. Bu rapor şirket MSSQL ortamı veya Windows doğrulaması değildir.

## Doğrulananlar

`npm test`: 9 test başarılı.

- Türkçe tutar ayrıştırma, altı ondalık korunması, boş/geçersiz/negatif/fazla hassas sayı reddi; BigInt toplamları ve görüntüleme yuvarlaması.
- Yedi fatura alanının zorunluluğu; boş/sıfır/negatif/kesirli katılımcı ayrımı; metin fatura numarası; döviz koşulları ve kur yönü.
- Plan 100.000, harcama 30.000, planlı ödeme 20.000 senaryosu; kısmi ve tam faturalama; fatura iptalinde bekleyen bakiye ve değişmeyen son kalan.
- Geçersiz kalemli çok satırlı faturanın tamamının rollback edilmesi; SQLite yabancı anahtarları.
- Eski revizyonun HTTP 409 ile reddedilmesi; fatura/ödeme tutarını aşan eşleştirme reddi; bağlantıyı bozacak fatura düzenlemesinin engellenmesi.
- Versiyon kopyasının eski planı ve ortak faturaları koruması; 11 kategorinin ve iki sıfır bütçeli kalemin veritabanı tekrar açıldığında korunması.
- Girişsiz API erişimi, yanlış Origin ve CSRF reddi; giriş denemesi sınırı; çıkış sonrası erişim reddi; audit kaydı.

`npm run build`: TypeScript kontrolü ve üretim derlemesi başarılı.

Chrome uçtan uca senaryosu: giriş → altı ondalıklı aylık plan düzenleme → sayfa yenileyerek kalıcılık → fatura ekleme → bütçe detayını açma → planlı ödeme ekleme → kısmi fatura eşleştirme → V3 kopyası → fatura düzeltme → iptal ve planlı bakiye kontrolü → 390 px mobil görünüm → çıkış. Kaynak Excel veya çalışma alanının yerel verileri yerine bellekte ayrı test veritabanı kullanılır. Masaüstü, giriş, fatura formu ve mobil görüntüler incelendi.

`npm run backup`: SQLite çevrimiçi yedekleme ve yedeğin bütünlük kontrolü başarılı. `npm run db:export:mssql`: kayıpsız tam sayılı, SHA-256 içeren aktarım paketi oluşturuldu. Paket oturumları içermez.

## Tamamlanmamış doğrulamalar / sonraki aşama

- Gerçek SQL Server bağlantısı, MSSQL çalışma zamanı adaptörü ve SQL Server üzerinde uçtan uca test.
- Windows başlatıcı gerçek Windows'ta çalıştırılmadı.
- Kurumsal HTTPS/proxy/servis, çok kullanıcılı yük ve yedekten kurum ortamına dönüş provası.
- Ayrıntılı kullanıcı rolleri, EB onay akışı, 9+3 hesaplama, negatif iade ve Excel içe/dışa aktarımı kesinleşmiş ilk sürüm kapsamı değildir.
- Kaynak Exceldeki şirket tutarları otomatik aktarılmadı; kaynak dosya değiştirilmedi. Demo kayıtlar kurgusaldır.

KDV hariç esası kullanıcı tarafından bu oturumda kesinleştirildi. Katılımcı toplam farkı uyarı, döviz TL önerisi ve altı ondalık giriş politikası README'de açıkça belirtilmiştir.
