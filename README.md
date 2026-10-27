# Yetenek Yönetimi Takımı Bütçe Takip Sistemi

React / TypeScript arayüzü ve Node.js API ile çalışan yerel bütçe uygulaması. Veriler SQLite dosyasında kalıcı tutulur. Plan ve fatura bedelleri **KDV hariç TL** esasındadır.

## Başlatma

Node.js **24 veya üzeri** gereklidir. Proje klasöründe:

```sh
npm ci
npm run setup
npm run build
npm start
```

Tarayıcı adresi: **http://127.0.0.1:3100**

İlk kurulum `demo` kullanıcısı için rastgele bir parola oluşturur ve terminalde **bir kez** gösterir. Parola veritabanında yalnızca scrypt özetiyle saklanır. Sonraki `setup` çağrıları mevcut kayıtları veya parolayı değiştirmez. Sabit bir giriş parolası kaynak kodunda bulunmaz.

Mac için `baslat-mac.command` dosyasını çift tıklayabilir veya `bash baslat-mac.command` çalıştırabilirsiniz. Windows için `baslat-windows.cmd` dosyasını kullanın. Başlatıcılar ilk açılışta kurulum ve derleme yapar; kaynak değiştiğinde yeniden derler.

Kendi kullanıcı adınızı ve parolanızı belirlemek için ilk kurulumdan önce `.env.example` dosyasını `.env` olarak kopyalayın; `ADMIN_USERNAME` ve en az 12 karakterlik `ADMIN_PASSWORD` girin. Kurulumdan sonra `ADMIN_PASSWORD` satırını kaldırın. `.env` Git dışında tutulur. Parola sıfırlamak için `node --env-file-if-exists=.env scripts/reset-password.mjs` komutunu çalıştırın; bu işlem yeni parolayı terminalde gösterir ve mevcut oturumları kapatır.

## Kullanım

Girişten sonra **Ana Sayfa** açılır. Dört karttan bütçe, faturalar, planlı ödemeler veya versiyon/tasarruf çalışma alanına geçebilirsiniz. Sol üstteki **Menü** düğmesi masaüstünde yan menüyü, telefonda çekmeceyi açar. Mobil menü Escape ile kapanır.

Yıl ve versiyon bölümler arasında korunur. Dönem ve bütçe kalemi ortak filtrelerdir; arama metni her bölüm için ayrı tutulur. Ana Sayfa filtreleri sıfırlamaz. Bütçede kaydedilmemiş değişiklik varken başka bölüme geçişte vazgeçme onayı istenir; iptal ederseniz taslağınız açık kalır. Oturum yenileme, düzenlediğiniz formu korur.

Arayüz İnsan, Kültür ve Dönüşüm Liderliği için sıcak kırık beyaz, yumuşak mürdüm ve sade beyaz yüzeylerle düzenlendi. Giriş zemini tek ve düz renktir; araç görselleri kullanılmaz. Tasarım ve yapılan işler [tasarım planında](docs/TASARIM-GELISTIRME-PLANI.md); son talepler [ekran geliştirme planında](docs/EKRAN-GELISTIRME-PLANI.md).

1. **Bütçe Planlama & Takip:** yıl ve plan versiyonunu seçin. Ocak–Aralık plan hücrelerini düzenleyip **Bütçeyi kaydet** düğmesine basın. Özetler son kaydedilmiş tutarları gösterir. Ay filtresi özet ve detay kapsamını daraltır; tüm ay sütunları görünür kalır.
2. **Faturalar:** yeni fatura ekleyin. Aynı faturaya birden fazla eğitim kalemi eklenebilir. Yedi zorunlu Excel alanına ek olarak yıl ve bütçe kalemi seçilir. Fatura numarası metin olarak saklanır. Fatura düzenlenebilir veya iptal edilebilir.
3. **Harcama detayları:** bütçe satırının okunu kullanın. Eğitim adı, dönem, fatura numarası, TL bedeli, katılımcılar ve açıklama alt kayıtlarda gösterilir. Fatura numarasından düzenleme ekranı açılır.
4. **Planlı Ödemeler:** yıl, ay, kategori ve tutar girin. **Eşleştir** ile fatura numarasını yazarak arayın veya listeden seçin; aynı ödemeye birden fazla faturayı tek seferde ya da sonradan bağlayabilirsiniz. Aynı dönem ve kategorideki fatura detayları, ödeme ve fatura bakiyelerini aşmadan otomatik eşleştirilir. Bir faturayı yeniden seçmek önceki bağlantıyı günceller; ikinci kez düşüm yapmaz. Eşleştirme isteğe bağlıdır. Eşleşen miktar bekleyen ödemeden çıkar. Fatura iptalinde bekleyen miktar yeniden açılır. **Tasarrufa ayır** ile faturalanmamış tutarın gerçekleşmeyecek bölümünü ve açıklamasını kaydedin. Bekleyen = planlanan − aktif fatura eşleştirmeleri − tasarruf. Örneğin 500.000 TL plan, 350.000 TL fatura ve 100.000 TL tasarruf için 50.000 TL bekler. Tasarruf, ilgili yılın Versiyon & Tasarruf ekranındaki detaylara ve toplamına tüm versiyonlarda yansır; plandan ayrıca düşülmez. Tasarrufu düzenleyebilir veya 0 kaydederek kaldırabilirsiniz; tutar tekrar bekleyen olur. Ödeme iptalinde o ödemenin tasarrufu toplamdan çıkarılır.
5. **Versiyon & Tasarruf:** yeni versiyona eski planın aylık tutarlarını kopyalayın ve aktif takip versiyonunu seçin. Her versiyonun **Düzenle** düğmesinden adını, açıklamasını ve bütçe değişikliği seçimini sonradan güncelleyebilirsiniz. **Bütçede değişiklik var mı? → Var** seçilince **Güncel bütçe · TL** alanı zorunludur; tutar o versiyona kaydedilir. Önceki versiyonların güncel bütçeleri ve aylık dağılımları korunur. Yeni yılı filtre barındaki **Yeni yıl bütçesi** alanından oluşturun. Yıl bütçesi seçili versiyona otomatik yansır; ayrı güncel bütçesi olan versiyon kendi tutarını kullanır. Bütçe kartındaki **Güncelleme**, bu versiyonun güncel bütçesini veya ayrı bütçesi yoksa yıl bütçesini günceller. Planlama ekranında **Planlanan bütçe** kartı tüm yıl görünümünde bu tutarı gösterir; kalan ve kullanılabilir bütçe de aynı tutardan hesaplanır. Ay, kategori veya arama filtresi uygulanınca kartlar ilgili aylık dağılımı gösterir. Aylık plan hücreleri ayrıca düzenlenir. Tasarruf ekranında üç kart bulunur: yıl bütçesi, tasarruf detay toplamı ve **Tasarruflu bütçe = bütçe − tasarruf detay toplamı**.
6. **Admin:** yalnız yönetici hesabıyla yan menüden açılır. Kullanıcı oluşturma ve Yönetici/Düzenleyici/Görüntüleyici yetkilerini yönetme burada yapılır. İşlem geçmişi son 200 kaydı gösterir; eski kayıtlar veritabanında tutulur. Son yönetici yetkisi kaldırılamaz. Yetki değişikliği kullanıcının açık oturumlarını kapatır.
7. **Excel aktarımı:** her ekran kendi raporunu indirir; seçili yıl, dönem ve ekran filtreleri korunur. **Bütçe Planlama & Takip** çıktısında beş özet kartı, seçili versiyonun aylık planlanan/gerçekleşen tutarları ve harcama detayları bulunur. Tablodaki tüm aylar korunur; seçili dönem dışındaki aylar soluk gösterilir ve toplamlar seçili döneme göre hesaplanır. Kaydedilmemiş bütçe değişikliklerini aktarımdan önce kaydedin. **Faturalar** çıktısı yalnızca listelenen faturaları ve bu faturaların bütün detaylarını içerir; planlı ödeme eşleştirmeleri bu rapora eklenmez. İptal faturaları yalnız **İptalleri göster** açıkken indirilir. Baştaki sıfırlar, formül benzeri not metinleri ve altı ondalıklı tutarlar korunur. Fatura raporunda tam tutar ve mikro birim sütunları bulunur; bütçe raporunda Excel'in 15 anlamlı basamak sınırını aşan tutarlar tam metin olarak saklanır.

11 başlangıç bütçe kalemi korunur; sıfır tutarlı iki kalem de listelenir. Yeni kalem ekleme, yeniden adlandırma ve bağlı kayıt bulunmayan boş kalemleri silme desteklenir. Plan, fatura veya planlı ödeme içeren kalem silinemez.

## Hesaplama kararları

- Gerçekleşen: aktif fatura kalemlerinin TL toplamı. Gerçekleşme dönemi fatura yılı + ayıdır. Negatif tutarlı iade girişi bu sürümde yoktur; iptal kullanılabilir.
- Kalan = plan − gerçekleşen. Kullanılabilir = kalan − henüz faturalanmamış planlı ödeme. Aynı tutar iki kez düşülmez.
- Tutar, döviz bedeli ve kur 6 ondalık ölçeğinde tam sayı olarak saklanır; hesaplamalar JavaScript `BigInt` kullanır. Girişte 6'dan fazla ondalık **reddedilir**, sessiz yuvarlama yapılmaz. Kaynak Excel değerleri otomatik aktarılmamıştır.
- Görüntüleme iki ondalığa yarım-yukarı yuvarlanır; plan giriş kutuları tüm kayıt hassasiyetini korur. En yüksek tek tutar 9.000.000.000.000 TL'dir. Toplamlar tam sayıyla hesaplanır.
- Türkçe tutar örneği: `1.250,50`. Nokta yalnızca binlik gruplarda kullanılır. `1.25`, `1,234.56`, boş değer ve negatif tutar reddedilir.
- Katılımcı sayısı alanları sıfır veya pozitif tam sayıdır. Ar-Ge + Diğer farkı uyarıdır; kayıt engellenmez. Otomatik maliyet dağıtımı yoktur.
- Dövizli bedel girildiğinde USD/EUR/GBP/CHF ve pozitif kur gerekir. Kur yönü `1 döviz = X TL`dir. Çarpım TL önerisi sunar; kullanıcı TL alanına uygulayabilir. Manuel TL farkı korunur; bütçeye yalnızca kaydedilen TL yansır.
- `9+3` için özel hesap yoktur; istenirse bu isimle plan versiyonu açılır. `EB Onay` etiketi bu sürümde planlı ödeme takibidir; çok aşamalı onay veya rol ayrımı içermez.
- Yönetici tüm iş kayıtlarını ve kullanıcı yetkilerini yönetir; düzenleyici iş kayıtlarını değiştirir; görüntüleyici yalnız okur ve rapor alır. Yetkiler API katmanında denetlenir. Herkese açık üyelik yoktur. Mevcut veritabanı geçişinde `admin` hesabı (yoksa ilk hesap) yönetici, diğer hesaplar düzenleyici olur.

## Ortam ayarları

| Değişken | Varsayılan / anlamı |
| --- | --- |
| `HOST` | `127.0.0.1`; yerel dinleme |
| `PORT` | `3100` |
| `APP_ORIGIN` | `http://127.0.0.1:3100`; tarayıcı adresiyle birebir eşleşmeli |
| `DB_PATH` | `./data/budget.sqlite` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Yalnızca ilk kurulumda kullanılır |
| `SEED_DEMO` | Varsayılan `true`; `false` ile boş bütçe ve 11 kategori oluşturulur |
| `NODE_ENV` | `production` ise demo oluşturulmaz, HTTPS zorunludur |
| `COOKIE_SECURE` | Yerelde `false`; HTTPS ortamında `true` |

Geliştirme: `npm run dev`. API ve Vite tek adreste çalışır. Çalışma dizini proje kökü olmalıdır.

## Testler

```sh
npm test
npm run build
npm run test:ui
```

Tarayıcı testi yerel Chrome kullanır, 3198 portunda yalnızca bellekte yaşayan kurgusal veritabanı açar. Gerçek uygulama kayıtlarını değiştirmez. Chrome yoksa `npx playwright install chromium` sonrasında `PLAYWRIGHT_CHANNEL=chromium node scripts/ui-check.mjs` kullanın. Görseller `test-results/` altında oluşur ve Git'e girmez. Test kapsamı [kabul notlarında](docs/KABUL.md).

## Yedekleme, sıfırlama ve MSSQL

`npm run backup` tutarlı bir SQLite yedeği oluşturup bütünlük kontrolünü yapar. Yedekler `data/backups/` içindedir. Geri yükleme ve HTTPS hazırlığı [işletim kılavuzunda](docs/ISLETIM.md).

Demo sıfırlama yalnızca varsayılan yerel demo veritabanında, üretim modu dışında ve `ALLOW_DEMO_RESET=YES npm run demo:reset` ile çalışır. Kullanıcı hesabı korunur, oturumlar kapatılır. Bu işlem yerelde eklediğiniz demo çalışma kayıtlarını da siler; önce yedek alın.

**Bu sürümün çalışan veritabanı SQLite'tır.** MSSQL için şema, aktarım paketi üretimi ve atomik aktarım aracı hazırlandı. MSSQL çalışma zamanı adaptörü ve gerçek sunucu kabul testleri henüz tamamlanmadı; yalnızca bağlantı adresi değiştirilerek MSSQL'e geçilemez. Adımlar: [MSSQL hazırlığı](docs/MSSQL.md).

## Kaynak ve GitHub

İlk sürümün arayüzü ve Otokar logosu [AA Kaynak Planlama Sistemi 2.0](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi_2.0.0) temel alınarak hazırlanmıştı (`a0bea507d9f79c1713e6cfdc4c59783e62f0a600`). 24 Ekim 2026 arayüz geliştirmesinde [AA Kaynak Yönetimi Sistemi 3.0](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/tree/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557) menü/kart düzeni referans alınmış, renkler kullanıcının isteğiyle İnsan Kaynakları için özelleştirilmiştir. Eski giriş arka planı kaldırılmıştır. Bütçe/fatura işlevleri ve yeni modül çizimleri bu uygulama için yazılmıştır.

IBM Plex Sans fontları yerelden sunulur; lisans [OFL.txt](frontend/public/assets/fonts/OFL.txt) dosyasındadır. Ortak renkler ve ölçüler `frontend/src/styles/tokens.css` içindedir.

Hedef depo: [Yetenek Yönetimi Takımı Bütçe Takip Sistemi v0](https://github.com/zaferond/Yetenek-Yonetimi-Takimi-Butce-Takip-Sistemi_v0). Yerel veritabanları, yedekler, parolalar ve kullanıcıya ait kaynak Excel depoya eklenmez.
