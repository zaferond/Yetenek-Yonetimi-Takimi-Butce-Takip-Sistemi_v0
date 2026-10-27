# Yetenek Yönetimi · Arayüz Tasarım ve Geliştirme Planı

**İnceleme tarihi:** 24 Ekim 2026  
**Mevcut uygulama:** Yetenek Yönetimi Takımı Bütçe Takip Sistemi v0  
**Referans:** [AA Kaynak Yönetimi Sistemi 3.0.0](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0)  
**İncelenen referans commit:** `b0cb93bb332c24f4f7eb00251ff9b2a79a34c557`  
**Son durum güncellemesi:** 24 Ekim 2026  
**Durum:** T01–T11 tamamlandı. Açık işler T12 ve T13; ayrıca isteğe bağlı özel onay pencereleri var. Sonraki kullanıcı talepleriyle değişen tasarımlar eksik iş değildir.

## Kalan işler

| No | Öncelik | Yapılacak iş | Mevcut durum | Tamamlanma ölçütü |
| --- | --- | --- | --- | --- |
| T12 | P2 / isteğe bağlı | Ana sayfaya işlem kısayolları ve/veya gerçek veri grafikleri eklemek. | Ana sayfada dört modül kartı var. Kart çizimleri dekoratif; veri grafiği veya doğrudan işlem kısayolu yok. | Gösterilecek veriler ve kısayollar belirlenir; mevcut hesaplama kaynağı kullanılır, rol yetkileri ve mobil görünüm doğrulanır. Son sadeleştirme talebi gözetilir. |
| T13 | P2 | Eğitim Ana Başlıkları yönetimini menüye ve fatura formuna bağlamak. | `TrainingTopicsManager.tsx`, API ve veri alanları mevcut; yönetim ekranına erişim ve fatura formunda seçim bağlı değil. | Başlık ekleme/düzenleme/silme, faturada seçim ve kaydın yeniden açılması uçtan uca doğrulanır; rol yetkileri uygulanır. |
| O01 | İsteğe bağlı | Tarayıcı onay pencerelerini ortak tasarımlı onay pencereleriyle değiştirmek. | Kaydedilmemiş değişiklik ve silme/iptal onaylarında `confirm()` kullanılıyor. | Klavye odağı, Escape, iptal ve taslak koruma davranışı korunur. |

**Önerilen sonraki sıra:** T13 → kapsamı seçilirse T12 → ihtiyaç görülürse O01.

## Tamamlanan işler ve güncel davranış

| İş | Durum / uygulanan sonuç |
| --- | --- |
| T01 | Tamamlandı. Başlangıç ekranları `test-results/before/` altında ayrıldı. |
| T02–T03 | Tamamlandı. Ortak tema, yerel font ve lisansı, tek stil yükleme düzeni, araç görselsiz düz renk giriş ve oturum yenileme. |
| T04–T06 | Tamamlandı. Ortak navigasyon, dört kartlı Ana Sayfa, üst çubuk, masaüstü yan menüsü ve mobil çekmece. |
| T07–T09 | Tamamlandı. Bütçe/fatura/ödeme/tasarruf görünümleri, ortak filtreler ve özetler, form/pencere/hata durumları ve klavye odağı. |
| T10–T11 | Tamamlandı. Alan/API testleri, arayüz kabul senaryoları, görsel kontroller ve kullanım/kabul belgeleri güncellendi. |
| Sonraki ekran talepleri | Tamamlandı. Admin ve rol yönetimi, işlem geçmişi, dönem bazlı Excel, fatura numarasıyla eşleştirme, yıl bütçesi güncelleme ve versiyon değişikliği alanı. Ayrıntılar [ekran geliştirme planında](EKRAN-GELISTIRME-PLANI.md). |

Güncel birim adı **İnsan, Kültür ve Dönüşüm Liderliği > Yetenek Yönetimi**. Tema sıcak kırık beyaz ve mürdüm; giriş zemini düz açık lavanta-gri (`#F2EFF3`), tanıtım paneli düz koyu mürdüm (`#302A39`), form beyazdır.

Yıl, versiyon, dönem ve bütçe kalemi çalışma alanları arasında korunur; arama metni bölüm bazlıdır. **Ana Sayfa'da filtre, karşılama alanı ve kart açıklaması bulunmaz.** Kaydedilmemiş bütçeyle gezinirken vazgeçme onayı taslağı korur; oturum yenileme açık formu korur.

### Sonraki taleplerle değiştirilen ilk kararlar

Aşağıdaki alanlar önce uygulanmış veya ilk planda önerilmiş, ardından kullanıcı isteğiyle değiştirilmiştir. Yeniden yapılacak işler olarak değerlendirilmemelidir.

| İlk karar | Güncel uygulama |
| --- | --- |
| Ana sayfada karşılama, tarih, kart açıklamaları ve yıl/versiyon filtreleri | Kaldırıldı. Dört modül kartı korundu; küçük kart ikonları ve yön okları kaldırıldı. |
| Örnek çalışma alanı ve TL/KDV rozeti; bölüm açıklamaları ve kapsam özeti | İlgili üst alanlardan kaldırıldı. |
| Ortak başlıkta işlem geçmişi | Admin ekranına taşındı; yalnız yönetici erişebilir. |
| Birden fazla bölümden yeni fatura açma | Yeni fatura oluşturma yalnız Faturalar ekranında. Mevcut faturaya erişim/düzenleme bağlantıları korunur. |
| Fatura kalemi ve elle tutar seçerek eşleştirme | Fatura numarası seçilir; aynı dönem/kalemdeki uygun bakiye sunucuda hesaplanır. Eşleştirme isteğe bağlıdır. |
| Versiyon karşılaştırma seçimi ve ayrı yeni yıl penceresi | Kaldırıldı. Yeni yıl bütçesi filtre barında; yıl bütçesi kartında Güncelleme eylemi var. |
| Yeni versiyonda yalnız açıklama | Bütçe değişikliği var/yok ve açıklama saklanır; aylık plan ayrıca düzenlenir. |
| Roller ve Excel aktarımı ilk tasarım kapsamı dışında | Sonraki geliştirmede tamamlandı: Yönetici/Düzenleyici/Görüntüleyici ve yıl/ay/ay aralığına göre `.xlsx` aktarımı. |

**Doğrulama:** 14 alan/API testi, üretim derlemesi ve genişletilmiş tarayıcı akışı başarılı. 390/768/1366/1512/1920 px ve gerçek Chrome %200 yakınlaştırma kontrol edildi. Ayrıntılar [kabul notlarında](KABUL.md). Bu sonuçlar gerçek SQL Server veya diğer tarayıcı/işletim sistemi doğrulaması anlamına gelmez.

## İlk tasarımın dayanakları ve güncel uygulama ayrıntıları

Aşağıdaki başlangıç incelemesi tarihsel dayanak olarak korunur. Uygulama durumunu yukarıdaki tablolar, daha sonraki kapsamı [ekran geliştirme planı](EKRAN-GELISTIRME-PLANI.md) belirler.

## 1. Sonuç ve önerilen yaklaşım

Mevcut programı, referans projenin 3.0 sürümündeki tasarım diline benzer şekilde yenilemek mümkündür. İki uygulamanın da React, TypeScript ve Lucide ikonları kullanması uyarlamayı kolaylaştırır. Mevcut bütçe uygulamasının Vite yapısı korunabilir.

Öneri; referansın **sade tipografisini, ince çizgili kartlarını, kompakt üst çubuğunu ve açılır yan menüsünü** bütçe uygulamasına uyarlamaktır. Girişten sonra ayrı bir **Ana Sayfa** açılmalı; kullanıcı buradaki kartlardan mevcut bütçe, fatura, ödeme ve tasarruf ekranlarına ulaşmalıdır.

**Kullanıcının kesin isteği:** Giriş ekranında araç resimleri bulunmayacak; arka plan tek ve güzel bir renk olacak. Güncellenen tasarımda sayfanın tamamı düz `#F2EFF3`, iki sütunlu giriş kartındaki tanıtım paneli düz `#302A39` olarak uygulanmıştır. Fotoğraf, kolaj, rastgele değişen görsel, desen ve renk geçişi kullanılmayacaktır. Bunlar önerilen renk seçimleridir; araç görselinin kaldırılması kesin gereksinimdir.

## 2. İncelemenin kapsamı ve dayanakları

İnceleme, yerel uygulamanın kaynak kodu ve mevcut test ekran görüntüleri ile referans deponun yukarıdaki commit'indeki kaynak kodu ve v3 kullanıcı kılavuzu ekran görüntüleri üzerinden yapıldı. Referans uygulama çalıştırılmadı; ilk inceleme sırasında yeni işlevsel test yürütülmedi; uygulama sonrası doğrulamalar yukarıdaki güncel durum ve kabul notlarında kayıtlıdır. Ekran görüntülerindeki örnek tutarlar tasarım verisi olarak değerlendirilmiştir.

### Referans projede incelenen başlıca kaynaklar

| Konu | Kaynak |
| --- | --- |
| Etkin tema | [branding.ts](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/frontend/src/branding.ts): etkin tema `technical`; eski zeytin yeşili ve mavi temaların bırakıldığı belirtiliyor. |
| Renkler | [technical-theme.css](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/frontend/src/styles/workspace/technical-theme.css) |
| Yazı karakteri | [fonts.css](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/frontend/src/styles/shared/fonts.css): yerelden sunulan IBM Plex Sans ve eşit genişlikli rakamlar. |
| Giriş ekranı | [login.css](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/frontend/src/login.css) ve [giriş ekran görüntüsü](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/docs/kullanici-manueli/v3/shots/giris.jpg) |
| Ana sayfa | [HomePage.tsx](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/frontend/src/features/workspace/HomePage.tsx), [technical-home.css](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/frontend/src/styles/workspace/technical-home.css) ve [ana sayfa ekran görüntüsü](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/docs/kullanici-manueli/v3/shots/ana-sayfa.jpg) |
| Üst çubuk ve menü | [WorkspaceHeader.tsx](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/frontend/src/features/WorkspaceHeader.tsx), [sidebar.css](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/frontend/src/styles/workspace/sidebar.css) ve [menu-tabs.ts](https://github.com/zaferond/AA-Kaynak-Yonetimi-Sistemi_3.0.0/blob/b0cb93bb332c24f4f7eb00251ff9b2a79a34c557/frontend/src/features/workspace/menu-tabs.ts) |

Yerel inceleme dosyaları: [Login.tsx](../frontend/src/Login.tsx), [login.css](../frontend/src/login.css), [Workspace.tsx](../frontend/src/Workspace.tsx), [style.css](../frontend/src/style.css), [ui.tsx](../frontend/src/ui.tsx), [InvoiceEditor.tsx](../frontend/src/InvoiceEditor.tsx), [RecordEditor.tsx](../frontend/src/RecordEditor.tsx), [types.ts](../frontend/src/types.ts), [ui-check.mjs](../scripts/ui-check.mjs), [README](../README.md) ve [mevcut kabul raporu](KABUL.md).

## 3. İnceleme başlangıcındaki durum ve tasarım farkları

| Alan | Mevcut bütçe uygulaması | Referans 3.0 yaklaşımı | Yapılacak uyarlama |
| --- | --- | --- | --- |
| Genel kimlik | Yeşil tonları; HTML'de `data-theme="military"`. | Etkin `technical` tema; çelik mavisi, grafit ve açık yüzeyler. | Tek bir ortak renk ve ölçü sistemi oluşturmak. |
| Giriş | Sayfa zemininde `login-background.png`; sol panelde geçişli yeşil ve dekoratif çizgiler. | Açık gri sayfa, iki sütunlu kart; sol panelde araç fotoğrafı. | Kart oranlarını örnek almak, tüm araç görsellerini ve dekoratif arka planları kaldırmak. |
| Açılış | Girişten sonra doğrudan “Bütçe Planlama & Takip”. | Modül kartlarından oluşan ayrı “Ana Sayfa”. | Kullanıcıyı karşılayan yeni bir ana sayfa eklemek. |
| Navigasyon | Dört yatay bölüm düğmesi. | Açılır/sabitlenebilir yan menü; ana sayfa kartları ile aynı modüller. | Ana Sayfa + mevcut dört modülü ortak menü tanımından üretmek. |
| Üst çubuk | Yaklaşık 83 px yüksekliğinde yeşil bant, logo ve kullanıcı. | Daha kompakt, logo, bulunduğu ekran ve kullanıcı işlemleri. | Açık yüzeyli, yaklaşık 56–64 px üst çubuk hazırlamak. |
| Kartlar | Bütçe ekranında beş özet kartı mevcut. | İnce kenarlıklı, az gölgeli modül kartları; teknik çizim görselleri. | Özet kartlarını korumak; ana sayfaya bütçeye uygun modül kartları eklemek. |
| Veri tabloları | Aylık plan, gerçekleşen ve detay satırları; sabit sütun/başlık ve iç kaydırma mevcut. | Kontrollü çizgiler, sabit sütunlar, ortak tablo renkleri. | Mevcut davranışı koruyarak görsel kuralları birleştirmek. |
| Pencereler | Yerel `<dialog>`, ortak `Modal` ve `Field` bileşenleri. | Ortak stiller ve farklı UI bileşenleri. | Mevcut bileşenleri geliştirerek aynı tasarım dilini uygulamak. |

### İlk incelemede tespit edilen noktalar — tarihsel kayıt

- `Workspace.tsx` veri yükleme, hesaplama kapsamı, navigasyon, tablo ve pencereleri aynı bileşende topluyor. Ana sayfa eklenirken önce görünüm parçaları ayrılmalı; aynı anda iş kuralları yeniden yazılmamalı.
- `style.css`, `login.css` dosyasını içeri aktarıyor; `main.tsx` ayrıca her iki dosyayı da içeri aktarıyor. Giriş stilleri `style.css` içinde de tekrar tanımlanmış; örneğin düğme rengi ve başlık ölçüleri `!important` ile zorlanıyor. Stil sahipliği ve yükleme sırası tekleştirilmeli.
- Giriş CSS'inde kullanılan `--fs-2xl`, mevcut kök değişkenlerde tanımlı değil. Yazı ölçeği tamamlanmalı.
- `TrainingTopicsManager.tsx` bulunuyor ve `Snapshot` içinde `training_topics` var; ancak incelenen `Workspace.tsx` ve `InvoiceEditor.tsx` bu bileşeni kullanmıyor. Bu nedenle eğitim başlıkları için çalışan bir menü varmış gibi tasarım yapılmamalı; bağlama işi gerekirse ayrı iş olarak planlanmalı.
- İlk incelemede `User` tipi yalnızca `id` ve `username` içeriyordu. Sonraki geliştirmede `role` ve Admin yönetimi eklendi. Ad-soyad, bildirimler ve kullanıcı tercihleri uygulanmış değildir.

## 4. Önerilen ortak tasarım dili

Aşağıdaki renkler, geliştirme sırasında gelen İnsan Kaynakları odaklı farklılaşma isteğine göre güncellenmiştir. Uygulanan değerlerin tek kaynağı `frontend/src/styles/tokens.css` dosyasıdır.

| Kullanım | Değer |
| --- | --- |
| Ana eylem / seçili öğe | `#665078` — mürdüm |
| Ana eylem üzerine gelme | `#503D61` |
| Giriş tanıtım paneli | `#302A39` — koyu mürdüm |
| Ana metin | `#302C35` |
| İkincil metin | `#6B6472` |
| Uygulama zemini | `#F7F6F4` |
| Giriş sayfası zemini | `#F2EFF3` — tek, düz renk |
| Kart / form yüzeyi | `#FFFFFF` |
| İkincil yüzey | `#F1EDF4` |
| Seçili satır | `#EAE2EF` |
| Kenarlık | `#DED9E2` |
| Odak halkası | `#806093` |

- Yazı karakteri: referansla uyum için **IBM Plex Sans**; Türkçe karakterleri içeren font dosyaları yerelden sunulmalı ve OFL lisansı korunmalı. Font geçişi tablo genişlikleriyle birlikte kontrol edilmeli.
- Yazı ölçeği: yardımcı metin 12 px, ikincil metin 13 px, gövde 14 px, bölüm başlığı 16–18 px, sayfa başlığı 22–28 px.
- Tutarlar sağa hizalı ve `tabular-nums` olmalı; Türkçe sayı biçimi korunmalı.
- Boşluklar: 4 / 8 / 12 / 16 / 24 / 32 px. Kartlarda 6–8 px, giriş kartında 16–18 px köşe yarıçapı kullanılabilir.
- Durumlar yalnız renk ile anlatılmamalı: “İptal”, “Kısmi fatura”, “Kaydedilmemiş değişiklik” gibi metinler korunmalı.
- Hareketler kısa tutulmalı; mevcut azaltılmış hareket tercihi desteği korunmalı.
- Normal metinde en az 4,5:1 kontrast, görünür klavye odağı ve dokunmatik temel eylemlerde yaklaşık 44 px hedef alan kontrol edilmeli.

## 5. Giriş ekranı tasarımı

### Yerleşim

```text
                  Düz açık lavanta-gri sayfa zemini (#F2EFF3)
       ┌──────────────────────────┬──────────────────────────────┐
       │ Düz koyu mürdüm alanı │ Oturum Aç                    │
       │                          │ Kullanıcı adı ve parola…     │
       │ YETENEK YÖNETİMİ TAKIMI  │                              │
       │ Bütçe Takip Sistemi      │ Kullanıcı Adı                │
       │                          │ [                          ] │
       │ Kısa ürün açıklaması     │ Parola                       │
       │                          │ [                       ◉  ] │
       │                          │ □ Beni hatırla               │
       │ Planlama · Harcama ·     │ [       Giriş Yap →        ] │
       │ Fatura Takibi            │ Otokar logosu / ürün bilgisi │
       └──────────────────────────┴──────────────────────────────┘
```

### Yapılacak işler

- [x] Sayfa zemininin `background` değerini yalnızca `#F2EFF3` yapmak; `background-image`, karıştırma ve fotoğraf bağımlılığını kaldırmak.
- [x] Sol tanıtım panelini tek `#302A39` rengine geçirmek; geçişleri, daireleri, çizgileri ve `auth-brand-art` dekorunu kaldırmak.
- [x] Mevcut `login-background.png` dosyasının tüm kullanım noktalarını kontrol etmek; kullanılmıyorsa kaynak varlık listesinden çıkarmak. Referanstaki `login-vehicles` dosyalarını aktarmamak.
- [x] Kartı masaüstünde yaklaşık 880–920 px azami genişlikte, iki sütunlu ve dengeli boşluklarla düzenlemek. Küçük ekranlarda tek sütuna geçmek.
- [x] Başlık ve açıklamayı bütçe/eğitim operasyonlarına göre korumak; araç ve kaynak planlama metinlerini taşımamak.
- [x] Otokar logosunu form altındaki sade kurumsal alanda kullanmak. Referanstaki ikinci logonun eklenmesi ayrı marka tercihi olarak ele alınmalı.
- [x] Kullanıcı adı, parola, parola görünürlüğü, Beni hatırla, Caps Lock uyarısı ve giriş hatasını ortak renklerle düzenlemek.
- [x] Giriş sırasında düğmenin devre dışı kalmasını ve “Giriş yapılıyor…” durumunu korumak.
- [x] Oturum yenileme ekranını da aynı stile geçirmek; arka plandaki form taslaklarının korunmasını sağlamak.
- [x] 390 px genişlikte ve kısa ekranlarda formun tamamının kaydırılarak erişilebilir olduğunu doğrulamak.

**Kabul:** İlk giriş ve oturum yenilemede araç fotoğrafı veya dekoratif arka plan görünmez ve bu tür görseller için ağ isteği yapılmaz. Sayfa zemini her çözünürlükte aynı düz renktir. Klavye ile tüm alanlara ulaşılır ve giriş akışı çalışır.

## 6. Ana sayfa tasarımı

Yeni ana sayfa, mevcut dört çalışma ekranına giriş noktası olacaktır. İlk aşamada aşağıdaki dört kart yeterlidir; referansın proje, organizasyon, aktivite veya risk modülleri eklenmeyecektir.

| Kart | Açıklama | Eylem |
| --- | --- | --- |
| Bütçe Planlama & Takip | Aylık planı, gerçekleşen harcamayı ve kullanılabilir bütçeyi izleyin. | `budget` bölümünü açar. |
| Faturalar | Eğitim faturalarını ve fatura kalemlerini yönetin. | `invoices` bölümünü açar. |
| Planlı Ödemeler | Bekleyen ödemeleri izleyin, faturalarla eşleştirin. | `payments` bölümünü açar. |
| Versiyon & Tasarruf | Plan versiyonlarını ve yıl bütçesini yönetin, tasarrufları takip edin. | `savings` bölümünü açar. |

### Yerleşim ve davranış — güncel

- Üstte yalnız “Ana Sayfa” başlığı bulunur. Karşılama metni ve tarih alanı sonraki kullanıcı talebiyle kaldırıldı.
- Kartlar masaüstünde 2 × 2, telefonda tek sütundur. Kart açıklamaları, küçük ikonlar ve sağ oklar sonraki taleple kaldırıldı; ana çizim şeritleri ve modül başlıkları korundu.
- Referanstaki teknik çizim şeridi, bütçe tablosu/fatura/takvim/karşılaştırma çağrışımlı basit SVG çizimlerle uyarlanabilir. Bu şeritler ana sayfaya aittir; giriş ekranına desen eklenmez.
- Kart çizimleri dekoratif olmalı; gerçek veri grafiği gibi sunulmamalı. Uygulama için yeni çizilecek SVG/CSS öğeleri yeterlidir.
- Kart ve yan menü başlıkları aynı tanımdan üretilmeli. Tüm kart yüzeyi klavye ve fareyle çalışmalı.
- Yıl ve plan versiyonu Ana Sayfa'da gösterilmez; çalışma ekranları arasında bu seçimler korunur.
- Ana Sayfa'da filtre gösterilmez. Kategori/dönem seçimleri ve bölüme özel arama metinleri geri dönüşte korunur.
- Beş bütçe özet kartı, mevcut bütçe çalışma ekranında kalmalı. Ana sayfaya mali özet ekleme isteği daha sonra aynı hesaplama kaynağı üzerinden ele alınabilir.
- “Yeni fatura” ve “Planlı ödeme ekle” gibi doğrudan işlem kısayolları ikinci aşamada düşünülebilir; ilk sürümde modül kartları yeterlidir.

**Kabul:** Başarılı ilk girişte Ana Sayfa açılır. Dört kart doğru ekranı açar; Ana Sayfa'ya her bölümden dönülebilir. Geçişler sırasında yıl/versiyon bağlamı ve kaydedilmemiş çalışma korunur. Oturum yenileme kullanıcıyı Ana Sayfa'ya yönlendirmez; bulunduğu işleme döndürür.

## 7. Üst çubuk ve yan menü

- Üst çubukta Otokar logosu, kısa ürün adı/bulunulan ekran, kullanıcı adı ve “Çıkış yap” bulunmalı. Örnek çalışma alanı etiketi sonraki kullanıcı talebiyle üst çubuktan kaldırıldı.
- Referans ekran görüntüsüne yakın açık gri üst çubuk, ince alt kenarlık ve az gölge tercih edilmeli. Uzun ürün adı dar ekranlarda kontrollü kısalmalı.
- Menü sırası: **Ana Sayfa → Bütçe Planlama & Takip → Faturalar → Planlı Ödemeler → Versiyon & Tasarruf → Admin**. Admin yalnız yöneticilere görünür.
- Masaüstünde açılıp kapatılabilen, yaklaşık 240 px genişlikte yan menü; kapalı durumda erişilebilir bir Menü düğmesi kullanılmalı.
- Küçük ekranlarda menü içerik genişliğini azaltmayan bir çekmece olarak açılmalı. Escape ile kapanmalı, odağı yönetilmeli ve kapatınca tetikleyiciye geri dönmeli.
- Etkin menü öğesi renk, işaret ve `aria-current="page"` ile belirtilmeli. Kartlar ile menü aynı hedefleri kullanmalı.
- Dört bölümlü eski yatay navigasyon, yan menü devreye alındığında kaldırılmalı; aynı gezinme iki farklı yerde tekrarlanmamalı.
- İşlem geçmişi Admin ekranındadır; çalışma ekranlarındaki yardımcı eylem kaldırıldı.
- Rol yönetimi sonraki geliştirmede eklendi. Global arama, bildirim zili, varsayılan ekran tercihi ve arayüzden yedek yükleme bu tasarımın açık işleri değildir; ayrı kapsam kararı gerektirir.

**Kabul:** Menü ve sabit üst çubuk tablo başlıklarını veya form alanlarını örtmez. 390 px ekranda sayfanın tamamında yatay taşma olmaz; geniş tablolar kendi alanında kayar.

## 8. Mevcut çalışma ekranlarının uyarlanması

### Bütçe Planlama & Takip

- Beş özet kartında etiket/tutar/açıklama hiyerarşisi korunmalı; yeşil renkler ortak temaya geçirilmeli. Kullanılabilir bütçe kontrollü vurgulanmalı.
- Yıl, versiyon, dönem, bütçe kalemi ve arama tek bir filtre alanında düzenlenmeli; seçimler filtre alanlarında görünür olmalı. Tekrarlayan kapsam özeti sonraki kullanıcı talebiyle kaldırıldı.
- Plan ve gerçekleşen satırları açık tonlar ve metinlerle ayrılmalı; düzenlenebilir hücrelerin odağı ve hatası belirgin olmalı.
- Kaydedilmemiş değişiklik, kaydetme ve geri alma eylemleri görünür kalmalı. Menü geçişi taslakları sessizce silmemeli.
- Sabit ilk sütun/başlık ve tablo içi kaydırma korunmalı. Menü açıldığında kullanılabilir genişlik değişeceği için katmanlar ve sütun ölçüleri tekrar kontrol edilmeli.
- Ay filtresinin mevcut kuralı korunmalı: özet ve detay kapsamı daralır; Ocak–Aralık plan sütunları görünür kalır.

### Faturalar

- Liste başlığı, Yeni fatura eylemi, iptal edilenleri gösterme ve durum rozetleri ortak stile geçirilmeli.
- Fatura formunda genel bilgiler, eğitim kalemleri, tutar/döviz bilgileri ve katılımcı sayıları okunabilir gruplara ayrılmalı.
- Çok kalemli faturalar ve uzun açıklamalar küçük ekranda taşmamalı. Satır ekle/sil eylemleri belirgin olmalı.
- Mevcut zorunlu alanlar, alan hata mesajları, Türkçe tutar girişi ve döviz TL önerisi korunmalı.

### Planlı Ödemeler

- Planlanan, eşleşen ve bekleyen tutarlar net ayrılmalı. Kısmi/tam eşleştirme durumları metin ile görünmeli.
- Eşleştirme penceresinde ödeme özeti ve fatura numarası seçimi bulunur. Elle tutar alanı kaldırıldı; uygun tutar sunucuda hesaplanır.
- Fatura iptalinden sonra açılan bekleyen tutarın görünürlüğü korunmalı.

### Versiyon & Tasarruf

- Aktif takip versiyonu ve yeni versiyon oluşturma ortak kart/düğme stilindedir. Karşılaştırma seçimi sonraki taleple kaldırıldı.
- Yıl bütçesi, yıl bütçesi − seçili plan, tasarruf toplamı ve mutabakat farkı ayrı göstergelerdir. Yıl bütçesi kartında Güncelleme eylemi bulunur.
- Tasarruf kayıtları ve versiyon açıklamaları uzun metinde kırpılmadan erişilebilir olmalı.

### Ortak pencereler ve durumlar

- `Modal`, `Field` ve `Empty` üzerinden başlık, kenarlık, hata, boş durum ve alt eylem alanı standartlaştırılmalı.
- Yerel `<dialog>` ve mevcut odak geri dönüşü korunabilir; yalnız tasarım benzerliği için Radix veya başka bir UI kütüphanesine geçiş gerekmiyor.
- Bekleme, veri yükleme hatası, sonuç bulunamaması, kayıt başarısı ve oturum yenileme durumları aynı görsel dili kullanmalı.
- Tarayıcı onay pencerelerini özel onay bileşenine dönüştürmek isteğe bağlı sonraki iştir; yapılırsa mevcut kayıp önleme davranışı korunmalıdır.

## 9. Teknik uygulama planı ve dosya etkileri

**Önerilen yapı:** Mevcut React/Vite uygulamasında ortak stil değişkenleri ve küçük görünüm bileşenleri oluşturmak. İlk tasarım aşamasında API ve hesaplama kuralları korundu. Sonraki kullanıcı talepleriyle rol/versiyon alanları, Admin ve Excel API'leri ile fatura numarasıyla eşleştirme eklendi.

| Dosya / önerilen bileşen | İş |
| --- | --- |
| `frontend/index.html` | Tema işaretini ve `theme-color` değerini yeni kimlikle eşleştirmek. |
| `frontend/src/main.tsx` | Tek stil yükleme düzeni; ilk giriş ve oturum yenileme davranışını korumak. |
| `frontend/src/styles/tokens.css` — yeni | Renk, font, boşluk, köşe, odak, durum ve tablo değişkenlerini toplamak. |
| `frontend/src/style.css` | Sabit yeşil renkleri değişkenlere geçirmek; tekrar eden giriş kurallarını ve gereksiz `!important` kullanımını temizlemek. |
| `frontend/src/login.css`, `Login.tsx` | Görselsiz giriş tasarımı, logo yerleşimi, duyarlı düzen ve oturum yenileme. |
| `frontend/public/assets/fonts/` — yeni | IBM Plex Sans dosyaları ve lisansı; mevcut yapıdan yerel servis. |
| `frontend/src/Workspace.tsx` | Ortak veri ve taslak durumunun yaşamını korumak; `Section` kapsamına `home` eklemek; navigasyonu tek işleyicide toplamak. |
| `frontend/src/navigation.ts` — yeni | Kart ve menülerin kullanacağı tip güvenli başlık/ikon/hedef tanımları. |
| `frontend/src/components/WorkspaceHeader.tsx` — yeni | Kompakt üst çubuk. |
| `frontend/src/components/WorkspaceSidebar.tsx` — yeni | Masaüstü yan menüsü ve mobil çekmece. |
| `frontend/src/components/HomePage.tsx` — yeni | Dört modül kartı; karşılama satırı sonraki taleple kaldırıldı. |
| `frontend/src/components/BudgetMetrics.tsx`, `WorkspaceFilters.tsx` — yeni | Mevcut özet ve filtre görünümünü ortak durumdan beslemek. |
| `frontend/src/ui.tsx`, `InvoiceEditor.tsx`, `RecordEditor.tsx` | Ortak pencere/form görünümü. |
| `frontend/src/TrainingTopicsManager.tsx` | Tasarım uyumu; uygulamaya bağlanması ayrı kapsam kararı. |
| `scripts/ui-check.mjs` | Yeni açılış akışı, kartlar, yan menü, giriş görsel isteği ve dar ekran kontrolleri. |
| `README.md`, `docs/KABUL.md` | Yeni navigasyon, tasarım kaynağı/commit ve gerçek doğrulama sonuçları. |

Yeni dosya adları öneridir; uygulama sırasında mevcut kod düzenine göre sadeleştirilebilir. Referansın bütün CSS manifesti, proje erişim modeli veya uygulama kabuğu taşınmamalı; bütçe uygulamasında karşılığı olan stiller uyarlanmalıdır.

### Durum yönetiminde korunacak teknik kurallar

- Yeni Ana Sayfa, `Workspace` içindeki ortak veri/yıl/versiyon durumunu sıfırlamadan render edilmeli. Bölüm görünümü değişirken taslaklar bileşenin sökülmesi nedeniyle kaybolmamalı.
- Kart, menü ve Ana Sayfa düğmesi aynı gezinme işleyicisini kullanmalı. Kaydedilmemiş bütçe taslağı için mevcut kaydet/geri al kararını korumalı; açık fatura veya kayıt penceresi varken arka plan gezinmesi engellenmeli.
- Oturum süresi dolduğunda mevcut `main.tsx` akışındaki çalışma alanını koruma davranışı sürmeli; yeniden giriş yalnız kullanıcı ve CSRF bilgisini yenilemeli.
- Özetler yeni bileşenlere taşınsa bile `sum`, `subtract`, `money` ve mevcut `BigInt` tabanlı hesaplama kullanılmalı. Biçimlendirilmiş para metninden veya kayan noktalı sayılardan yeniden hesap yapılmamalı.
- Ana sayfa ilk aşamada ek API çağrısı gerektirmez. Bütçe yüklenemediğinde mevcut tekrar deneme/hata akışı korunmalı.

## 10. Önceliklendirilmiş iş listesi

**P0:** Temel geçiş için gerekli. **P1:** Tüm ekranlarda tutarlı tasarım ve kabul için gerekli. **P2:** Sonraki geliştirme önerileri.

| No | Öncelik | İş | Bağımlılık | Tamamlanma ölçütü | Durum |
| --- | --- | --- | --- | --- | --- |
| T01 | P0 | Mevcut giriş, dört bölüm ve pencerelerin başlangıç görüntülerini almak. | Yok | Kurgu verilerle masaüstü/mobil karşılaştırma seti hazır. | Tamamlandı |
| T02 | P0 | Ortak renk/ölçü/font sistemi ve stil yükleme düzenini kurmak. | T01 | Aynı bileşenin renkleri farklı dosyalardan çelişmiyor. | Tamamlandı |
| T03 | P0 | Araç görselsiz giriş ekranını hazırlamak. | T02 | Düz zemin, düz tanıtım paneli, giriş ve yenileme çalışıyor. | Tamamlandı |
| T04 | P0 | Ortak gezinme tanımı ve taslak koruma işleyicisini hazırlamak. | T01 | Tüm gezinme girişleri aynı durum kurallarını izliyor. | Tamamlandı |
| T05 | P0 | Ana Sayfa ve dört modül kartını eklemek. | T02, T04 | İlk giriş Ana Sayfa; kartlar doğru hedefe gidiyor. | Tamamlandı |
| T06 | P0 | Kompakt üst çubuk, yan menü ve mobil çekmeceyi eklemek. | T02, T04 | Aktif ekran doğru; dar ekranda odağı ve kapanışı çalışıyor. | Tamamlandı |
| T07 | P1 | Özetler, filtreler ve bütçe tablosunu yeni temaya geçirmek. | T02, T06 | Tutarlar ve filtre kapsamı aynı; sabit hücreler çakışmıyor. | Tamamlandı |
| T08 | P1 | Fatura, ödeme ve tasarruf ekranlarını uyarlamak. | T02, T06 | Ekleme/düzenleme/iptal/eşleştirme akışları korunuyor. | Tamamlandı |
| T09 | P1 | Form, pencere, hata/boş/yükleme durumlarını birleştirmek. | T03, T07, T08 | Klavye odağı, hata açıklamaları ve taşma kontrolü uygun. | Tamamlandı |
| T10 | P1 | İşlevsel, görsel ve duyarlı ekran kabulünü tamamlamak. | T03–T09 | Güncel kullanıcı kararlarına uyarlanmış doğrulama matrisi tamamlandı. | Tamamlandı |
| T11 | P1 | Kullanım ve kabul belgelerini güncellemek. | T10 | Sonuçlar, görüntüler ve kaynak bilgisi güncel. | Tamamlandı |
| T12 | P2 | Ana sayfa işlem kısayolları veya veri grafikleri. | T10 + kapsam kararı | Gerçek veriye bağlı; ek hesaplama tanımı net. | Açık |
| T13 | P2 | Eğitim Ana Başlıkları yönetimini menüye ve fatura formuna bağlamak. | Mevcut entegrasyonun ayrıca incelenmesi | Uçtan uca kayıt/seçim akışı tanımlı ve doğrulanmış. | Açık |

Önerilen sıra: **temel tasarım → giriş → ortak gezinme ve ana sayfa → çalışma ekranları → kabul**. İlk görsel değerlendirme T03, T05 ve T06 sonunda yapılabilir; çalışmanın tamamlanması T07–T11 işlerini de içerir. Süre tahmini, bu ilk ekranlar netleştikten sonra verilmeli.

## 11. Doğrulama ve kabul matrisi

Tasarım uygulanırken testler mevcut programdaki kurgu veri/bellek veritabanı yaklaşımıyla yürütülmeli. Kullanıcının çalışma verileri test için değiştirilmemeli.

| Kontrol | Beklenen sonuç |
| --- | --- |
| Başarılı/başarısız giriş | Ana Sayfa açılır; yanlış bilgide anlamlı hata görünür. |
| Giriş arka planı | İlk giriş ve oturum yenilemede düz zemin; araç/fotoğraf isteği yok. |
| Menü ve kartlar | Dört modülün tamamına ulaşılır; aktif konum ve Ana Sayfa dönüşü doğru. |
| Bağlam | Yıl/versiyon bölüm değişiminde korunur; ay/kategori/arama davranışı belirlenen kurala uyar. |
| Bütçe taslağı | Ana Sayfa/menü/çıkış geçişleri değişiklikleri sessizce silmez. |
| Oturum yenileme | Açık fatura/kayıt alanları korunur; girişten sonra işlem sürdürülebilir. |
| Tutarlar | Altı ondalık giriş hassasiyeti, iki ondalık görüntüleme ve Türkçe sayı biçimi aynı. |
| Bütçe denklemleri | Plan 100.000, harcama 30.000, bekleyen 20.000 → kalan 70.000, kullanılabilir 50.000. Eşleştirme aynı tutarı ikinci kez düşürmez. |
| Faturalar | Çok satırlı ekleme/düzenleme/iptal, zorunlu alanlar ve döviz önerisi çalışır. |
| Planlı ödeme | Kısmi/tam eşleştirme ve fatura iptalinde bekleyen bakiyenin açılması doğru. |
| Versiyon | Kopyalama çalışır; faturalar çoğaltılmaz. Bütçe değişikliği var/yok kaydedilir. Karşılaştırma alanı sonraki kullanıcı talebiyle kaldırıldı. |
| Klavye | Giriş, kartlar, menü ve pencerelerde odak görünür; pencere kapanınca uygun yere döner. |
| Mobil ve dar ekran | 390 × 844 ve 768 × 1024 ölçülerinde erişilebilir düzen; sayfa yatay taşmaz. |
| Masaüstü | 1366 × 768, 1512 × 982 ve 1920 × 1080 ölçülerinde kesilmeyen başlıklar, kartlar ve düğmeler. |
| Yakınlaştırma | %200 tarayıcı yakınlaştırmasında temel eylemler erişilebilir; tablolar kendi alanında kayar. |
| Yükleme/hata/boş veri | Başarısız istek yeniden denenebilir; boş liste çalışır; örnek veri gerçekmiş gibi gösterilmez. |

Uygulama sonrası komutlar:

```sh
npm test
npm run build
node scripts/ui-check.mjs
```

`npm run test:ui` derlemeyi de içerdiğinden, alternatif olarak `npm test` ardından `npm run test:ui` kullanılabilir. UI testi Ana Sayfa açılışı ve kart/menü gezinmesine güncellendi. Fatura, planlı ödeme, versiyon, oturum yenileme ve kalıcılık kontrolleri korundu; Admin, Excel, yıl bütçesi ve fatura numarasıyla eşleştirme kontrolleri eklendi.

Yeni giriş, ana sayfa, açık/kapalı menü, bütçe, fatura formu, ödeme ve mobil ekran görüntüleri karşılaştırılmalı. `docs/KABUL.md` içine yalnız gerçekten çalıştırılan testler ve incelenen görüntüler yazılmalı.

## 12. Kapsam sınırları ve kesin tasarım kararları

Bu planın teslimi, mevcut bütçe programının 3.0 tasarım diline uyarlanmasıdır. Admin/roller ve Excel aktarımı başlangıçta ayrı kapsamdaydı; sonraki taleple tamamlandı. **MSSQL çalışma zamanı, Active Directory, çok aşamalı EB onayı, 9+3 otomatik hesabı, global arama ve bildirim altyapısı uygulanmış değildir; bu tasarım planının açık T12/T13 işleri de değildir.** Bunlar ayrıca planlanacak ürün/altyapı işleridir. Mevcut MSSQL aktarım şeması güncellenmiş olsa da gerçek SQL Server doğrulaması yapılmadı.

Uygulama için bu belgede önerilen başlangıç kararları:

1. **Giriş:** Düz açık lavanta-gri sayfa + koyu mürdüm tanıtım paneli + beyaz form; araç görseli, desen ve geçiş yok.
2. **Kimlik:** Mürdüm eylemler, koyu metinler, sıcak kırık beyaz/beyaz yüzeyler; yerelden sunulan IBM Plex Sans.
3. **Açılış:** Ayrı Ana Sayfa ve mevcut dört modüle yönlendiren 2 × 2 kart düzeni.
4. **Gezinme:** Kompakt üst çubuk, masaüstünde açılır yan menü, mobilde çekmece.
5. **Uygulama:** Mevcut iş kuralları ve veri akışları korunarak bileşenlerin ve stillerin kademeli düzenlenmesi.

Araç resimlerinin kullanılmaması kullanıcı gereksinimidir. Renkler kullanıcının İnsan Kaynakları odaklı farklılaşma isteğine göre uygulanmıştır; font ve kart oranları bu uygulamada görsel olarak kontrol edilmiştir.
