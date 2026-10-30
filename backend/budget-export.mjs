import { MONTHS, sum, rate } from "../shared/domain.mjs";
import { budgetView } from "../shared/report-scope.mjs";
import {
  createWorkbook,
  amountCell,
  moneyCell,
  amountFormat,
  sheet,
  styleHeader,
} from "./excel-export.mjs";

export async function budgetWorkbook(store, year, versionId, options = {}) {
  const data = store.snapshot(year, versionId);
  const { rows, totals, annual } = budgetView(data, options);
  const {
    from = 1,
    to = 12,
    category = 0,
    search = "",
    hideZero = false,
  } = options;
  const workbook = createWorkbook();
  const ws = workbook.addWorksheet("Bütçe Planlama", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 8 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 8,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "1:8",
    },
  });
  ws.columns = [
    { width: 38 },
    { width: 18 },
    ...Array.from({ length: 12 }, () => ({
      width: 19,
      style: { numFmt: amountFormat },
    })),
    ...Array.from({ length: 5 }, () => ({
      width: 22,
      style: { numFmt: amountFormat },
    })),
    { width: 16, style: { numFmt: '0.0"%"' } },
  ];
  ws.mergeCells("A1:T1");
  ws.getCell("A1").value = "Bütçe Planlama & Takip";
  ws.getCell("A1").font = {
    name: "Calibri",
    size: 20,
    bold: true,
    color: { argb: "FF665078" },
  };
  ws.getRow(1).height = 34;
  ws.mergeCells("A2:T2");
  ws.getCell("A2").value = [
    String(year),
    data.version?.name || "Plan yok",
    `${MONTHS[from - 1]} – ${MONTHS[to - 1]}`,
    category
      ? data.categories.find((c) => c.id === category)?.name
      : "Tüm bütçe kalemleri",
    search ? `Arama: ${search}` : "",
    hideZero ? "Boş kalemler gizli" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  ws.getRow(2).height = 30;
  const metrics = [
    ["Planlanan bütçe", totals.plan],
    ["Gerçekleşen harcama", totals.actual],
    ["Kalan bütçe", totals.remaining],
    ["Bekleyen planlı ödeme", totals.pending],
    ["Kullanılabilir bütçe", totals.available],
  ];
  metrics.forEach(([label, value], index) => {
    const first = index * 4 + 1,
      last = first + 3;
    ws.mergeCells(4, first, 4, last);
    const title = ws.getCell(4, first);
    title.value = `${label} · TL`;
    title.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1EDF4" },
    };
    title.font = { name: "Calibri", bold: true, color: { argb: "FF665078" } };
    ws.mergeCells(5, first, 5, last);
    const amount = ws.getCell(5, first);
    amount.value = moneyCell(value);
    amount.numFmt = amountFormat;
    amount.font = { name: "Calibri", bold: true, size: 18 };
  });
  ws.getRow(4).height = 24;
  ws.getRow(5).height = 32;
  ws.mergeCells("A6:T6");
  ws.getCell("A6").value =
    `${annual ? "Özet kartları seçili versiyonun yıllık bütçesini gösterir." : "Özet kartları seçili kapsamdaki aylık dağılımı gösterir."} Tüm tutarlar KDV hariç TL; Excel sayı hassasiyetini aşan değerler tam metin olarak korunur.`;
  ws.getRow(6).height = 28;
  ws.mergeCells("A7:T7");
  ws.getCell("A7").value =
    "Aylık Bütçe Planı · Dönem dışındaki aylar soluk gösterilir; toplamlar seçili döneme aittir.";
  ws.getCell("A7").font = { bold: true, name: "Calibri", size: 12 };
  const headers = [
    "Bütçe kalemi",
    "Tür",
    ...MONTHS,
    "Plan toplamı",
    "Harcanan",
    "Kalan",
    "Bekleyen planlı ödeme",
    "Kullanılabilir",
    "Kullanım (%)",
  ];
  ws.getRow(8).values = headers;
  styleHeader(ws.getRow(8));
  ws.getRow(8).height = 44;

  const addBudgetRows = (name, months, summary, total = false) => {
    const plan = ws.addRow([
      name,
      "Planlanan",
      ...months.map((m) => moneyCell(m.plan)),
      ...["plan", "actual", "remaining", "pending", "available"].map((key) =>
        moneyCell(summary[key]),
      ),
      summary.usage ?? "—",
    ]);
    const actual = ws.addRow([
      name,
      "Gerçekleşen",
      ...months.map((m) => moneyCell(m.actual)),
    ]);
    for (const row of [plan, actual]) {
      row.height = 34;
      row.font = { name: "Calibri", size: 11, bold: total };
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: total ? "FFEAE2EF" : row === actual ? "FFFAF9FB" : "FFFFFFFF",
        },
      };
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        cell.border = {
          bottom: { style: "hair", color: { argb: "FFDED9E2" } },
        };
        if (
          column >= 3 &&
          column <= 14 &&
          (column - 2 < from || column - 2 > to)
        )
          cell.font = { ...row.font, color: { argb: "FF96909C" } };
      });
    }
  };
  rows.forEach((r) => addBudgetRows(r.name, r.months, r));
  const tableTotals = Object.fromEntries(
    ["plan", "actual", "remaining", "pending", "available"].map((key) => [
      key,
      sum(rows.map((r) => r[key])),
    ]),
  );
  addBudgetRows(
    "TOPLAM",
    MONTHS.map((_, i) => ({
      plan: sum(rows.map((r) => r.months[i].plan)),
      actual: sum(rows.map((r) => r.months[i].actual)),
    })),
    { ...tableTotals, usage: rate(tableTotals.actual, tableTotals.plan) },
    true,
  );
  ws.eachRow((row) => {
    row.alignment = { vertical: "middle", wrapText: true };
  });

  const details = sheet(
    workbook,
    "Gerçekleşen Detayları",
    [
      "Bütçe kalemi",
      "Eğitim adı",
      "Yıl",
      "Ay",
      "Fatura numarası",
      "Tutar · TL",
      "Katılımcı sayısı",
      "Ar-Ge katılımcı",
      "Diğer katılımcı",
      "Açıklama",
      "Fatura notu",
      "Döviz bedeli",
      "Para birimi",
      "Kur",
      "Fatura detay ID",
    ],
    rows.flatMap((r) =>
      r.details.map((l) => [
        r.name,
        l.training_name,
        l.year,
        MONTHS[l.month - 1],
        l.number,
        moneyCell(l.amount_units),
        l.participant_count,
        l.rd_participant_count,
        l.other_participant_count,
        l.description,
        l.note,
        l.foreign_units === null ? "" : moneyCell(l.foreign_units),
        l.currency,
        l.rate_units === null ? "" : amountCell(l.rate_units),
        l.id,
      ]),
    ),
  );
  for (const index of [6, 12])
    details.getColumn(index).numFmt = amountFormat;
  details.getColumn(14).numFmt = "#,##0.00####";
  details.getColumn(1).width = 38;
  details.getColumn(2).width = 38;
  details.getColumn(10).width = 42;
  return workbook.xlsx.writeBuffer();
}
