import { MONTHS, sum } from "../shared/domain.mjs";
import { invoiceView } from "../shared/report-scope.mjs";
import {
  createWorkbook,
  amountCell,
  moneyCell,
  amountFormat,
  sheet,
} from "./excel-export.mjs";

const rateFormat = "#,##0.00####";
// Nullable amounts (döviz/kur) stay empty. Amounts are 2-decimal numbers
// (moneyCell); the rate keeps six decimals (amountCell).
const optionalMoney = (units) =>
  units === null || units === undefined ? "" : moneyCell(units);
const optionalRate = (units) =>
  units === null || units === undefined ? "" : amountCell(units);
function formatColumns(ws, columns, numFmt) {
  for (const column of columns) {
    ws.getColumn(column).eachCell((cell, row) => {
      if (row > 1 && typeof cell.value === "number") cell.numFmt = numFmt;
    });
  }
}

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
  const invoiceSheet = sheet(
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
      "Toplam TL",
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
        moneyCell(total),
        total,
      ];
    }),
  );
  formatColumns(invoiceSheet, [10], amountFormat);
  const detailSheet = sheet(
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
      "Tutar TL",
      "Tutar Mikro TL",
      "Döviz Bedeli",
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
        moneyCell(l.amount_units),
        l.amount_units,
        optionalMoney(l.foreign_units),
        l.foreign_units ?? "",
        l.currency,
        optionalRate(l.rate_units),
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
  formatColumns(detailSheet, [13, 15], amountFormat);
  formatColumns(detailSheet, [18], rateFormat);
  return workbook.xlsx.writeBuffer();
}
