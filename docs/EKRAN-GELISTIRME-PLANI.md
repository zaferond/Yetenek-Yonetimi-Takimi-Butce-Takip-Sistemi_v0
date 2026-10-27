# Ekran geliştirme uygulama planı

Tarih: 24 Ekim 2026
Kaynak: Kullanıcının `ekran-gelistirme-talepleri.md` belgesi. Belgedeki maddeler ürün gereksinimleri olarak değerlendirilmiştir.

## Uygulama sırası

1. **Ortak ekran sadeleştirmesi:** Birim adı `İnsan, Kültür ve Dönüşüm Liderliği > Yetenek Yönetimi`; ana sayfa filtrelerini, örnek alan etiketini, vergi rozetini, bölüm açıklamalarını ve küçük dekoratif kart simgelerini kaldır. Yeni fatura yalnız Faturalar ekranında olsun. Bütçe özetlerini küçült, kullanılabilir bütçe zeminini koyulaştır. Fatura detay başlığını güncelle.
2. **Admin ve yetkiler:** Ayrı Admin ekranında kullanıcı oluşturma, yönetici/düzenleyici/görüntüleyici rolleri ve işlem geçmişi. Yetki denetimi sunucuda yapılacak; yalnız düğmeleri gizlemek yeterli değil. Mevcut admin hesabını koru, diğer mevcut kullanıcıları düzenleyici olarak taşı. Son yönetici hesabının yetkisinin kaldırılmasını engelle. Yetki değişikliklerini kayıt altına al.
3. **Dönem ve Excel:** Tüm yıl, tek ay ve başlangıç/bitiş ayı seçimi. Bütçe ve Faturalar ekranlarından seçilen yıl/dönemdeki bütün faturaları, iptal durumları dahil tüm kalemleriyle `.xlsx` aktar. Kategori/arama filtreleri bu dönem raporunu daraltmayacak. Fatura numaraları metin olarak korunacak; döviz, kur, katılımcılar, not, tarihler ve eşleştirmeler aktarılacak.
4. **Bütçe yılı/versiyon:** Karşılaştırma alanını kaldır. Yıl bütçesi kartına Güncelleme ekle. Yeni yıl bütçesini yıl/planlama dönemi barının sağında satır içi form ile oluştur. Versiyona bütçe değişikliği alanı ekle; aylık tutarların dağıtım kuralını kullanıcı seçimine göre uygula.
5. **Eşleştirme:** Tutar girişini kaldır; otomatik tutar kuralını kullanıcı seçimine göre sunucuda uygula. Bakiyeyi aşmayı ve aynı eşleştirmenin tekrarıyla mükerrer düşümü engelle.
6. **Doğrulama:** Yetkisiz API erişimi, rol değişikliği, dönem sınırları, Excel içeriği ve sıfırlı numaralar, eşleştirme, versiyon/yıl akışları; üretim derlemesi ve masaüstü/mobil arayüz kontrolü. Yerel iş kayıtları testlerde kullanılmayacak.

## Kullanıcı yanıtları ve uygulanan iş kuralları

- Eşleştirme kullanıcı isteğiyle **fatura numarası üzerinden** yapılır. Tutar giriş alanı kaldırılmıştır. Seçilen faturanın aynı yıl/ay ve bütçe kalemindeki satırları sıra ile, ödeme ve fatura kullanılabilir bakiyesinin küçüğü kadar bağlanır. Mevcut bağlantının yeniden seçimi değiştirme işlemidir; mükerrer düşüm oluşmaz. Eşleştirme ödeme oluşturmak için zorunlu değildir.
- Versiyonda **bütçe değişikliği var/yok ve açıklama** saklanır. Aylık plan ayrıca düzenlenir, otomatik dağıtım yapılmaz. Eski versiyonların bilgisi bilinmediği için boş bırakılır.
- Rol matrisi: yönetici tüm işlemler ve kullanıcı/log yönetimi; düzenleyici iş kayıtlarında düzenleme ve rapor; görüntüleyici yalnız okuma ve rapor. Rol değişikliğinde etkilenen kullanıcının oturumları kapatılır.
- Excel raporu yıl ve dönem esaslıdır, kategori/arama filtresiyle daralmaz. İptal edilen faturalar durumlarıyla birlikte korunur. Fatura numarası, not ve parasal değerler metin olarak yazılır; sayı hassasiyeti kaybı ve formüle dönüşme önlenir. Hesaplama/aktarım için mikro birim sütunları bulunur.

## Uygulama durumu

| İş | Durum |
| --- | --- |
| Ortak adlandırma ve ekran sadeleştirmeleri | Uygulandı |
| Admin, kullanıcı oluşturma, rol yönetimi ve işlem geçmişi | Uygulandı; API yetki testleri geçti |
| Yıl/tek ay/ay aralığı ve Excel aktarımı | Uygulandı; dosya içeriği testleri geçti |
| Yıl bütçesini güncelleme, satır içi yeni yıl, versiyonda değişiklik var/yok | Uygulandı |
| Fatura numarasıyla otomatik eşleştirme | Uygulandı; bakiye, tekrar ve iptal testleri geçti |
| Derleme ve alan/API testleri | Derleme ve 14 test başarılı |
| Tarayıcı, mobil ve %200 yakınlaştırma | Genişletilmiş UI akışı başarılı; ekran görüntüleri incelendi |

## Teknik notlar

- Değişiklikten önce yerel SQLite veritabanının bütünlüğü doğrulanmış yedeği alındı. Testler bellek/geçici veritabanlarında çalışır.
- Şema geçişi rol ve bütçe değişikliği alanlarını mevcut kayıtlara dokunmadan ekler. Var olan admin hesabı ve parolası korunur.
- Excel üretimi sunucuda [ExcelJS](https://github.com/exceljs/exceljs) ile yapılır; istemci paketine eklenmez. ExcelJS'in UUID bağımlılığı 11.1.1 ile sabitlenmiştir.
- MSSQL aktarım şeması rol, versiyon değişikliği ve mevcut eğitim başlıkları alanlarıyla uyumlu tutuldu; gerçek SQL Server çalıştırması bu işte yapılmadı.
