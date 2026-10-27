import { MONTHS, sum } from "../shared/domain.mjs";
import { invoiceView } from "../shared/report-scope.mjs";
import { createWorkbook, decimal, sheet } from "./excel-export.mjs";

export async function invoiceWorkbook(store, year, from, to, options = {}) {
  const workbook = createWorkbook();
  const invoices = invoiceView(store.snapshot(year), { ...options, from, to });
  const ids = new Set(invoices.map((i) => i.id));
  const details = store
    .all(
      "SELECT l.*,c.name AS category,t.name AS topic FROM invoice_lines l JOIN budget_categories c ON c.id=l.category_id LEFT JOIN training_topics t ON t.id=l.training_topic_id ORDER BY l.invoice_id,l.id",
    )
    .filter((l) => ids.has(l.invoice_id));
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));
  sheet(
    workbook,
    "Faturalar",
    [
      "Fatura ID",
      "Fatura Numarası",
      "Yıl",
      "Ay No",
      "Ay",
      "Durum",
      "Fatura Notu",
      "Oluşturma Tarihi",
      "Güncelleme Tarihi",
      "Toplam TL (tam değer)",
      "Toplam Mikro TL",
    ],
    invoices.map((i) => {
      const total = sum(
        details.filter((l) => l.invoice_id === i.id).map((l) => l.amount_units),
      );
      return [
        i.id,
        i.number,
        i.year,
        i.month,
        MONTHS[i.month - 1],
        i.status === "active" ? "Aktif" : "İptal",
        i.note,
        i.created_at,
        i.updated_at,
        decimal(total),
        total,
      ];
    }),
  );
  sheet(
    workbook,
    "Fatura Detayları",
    [
      "Fatura ID",
      "Fatura Numarası",
      "Yıl",
      "Ay No",
      "Ay",
      "Durum",
      "Detay ID",
      "Bütçe Kalemi ID",
      "Bütçe Kalemi",
      "Eğitim Başlığı ID",
      "Eğitim Başlığı",
      "Eğitim Adı",
      "Tutar TL (tam değer)",
      "Tutar Mikro TL",
      "Döviz Bedeli (tam değer)",
      "Döviz Mikro Birim",
      "Para Birimi",
      "Kur (tam değer)",
      "Kur Mikro Birim",
      "Katılımcı Sayısı",
      "Ar-Ge Katılımcı",
      "Diğer Katılımcı",
      "Detay Açıklaması",
      "Fatura Notu",
      "Oluşturma Tarihi",
      "Güncelleme Tarihi",
    ],
    details.map((l) => {
      const i = invoiceMap.get(l.invoice_id);
      return [
        i.id,
        i.number,
        i.year,
        i.month,
        MONTHS[i.month - 1],
        i.status === "active" ? "Aktif" : "İptal",
        l.id,
        l.category_id,
        l.category,
        l.training_topic_id ?? "",
        l.topic ?? "",
        l.training_name,
        decimal(l.amount_units),
        l.amount_units,
        decimal(l.foreign_units),
        l.foreign_units ?? "",
        l.currency,
        decimal(l.rate_units),
        l.rate_units ?? "",
        l.participant_count,
        l.rd_participant_count,
        l.other_participant_count,
        l.description,
        i.note,
        i.created_at,
        i.updated_at,
      ];
    }),
  );
  return workbook.xlsx.writeBuffer();
}
