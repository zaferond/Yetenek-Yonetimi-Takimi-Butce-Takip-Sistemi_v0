import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { Store } from "../backend/store.mjs";
import { budgetWorkbook } from "../backend/budget-export.mjs";
import { invoiceWorkbook } from "../backend/invoice-export.mjs";
import { createApp } from "../backend/app.mjs";
import { hashPassword } from "../backend/auth.mjs";

function setup() {
  const s = new Store(":memory:");
  for (const name of ["Teknik Eğitim", "Davranışsal Eğitim", "Boş kalem"])
    s.category({ name });
  s.createYear({ year: 2026, reference: "500000" });
  s.savePlan({
    version_id: 1,
    cells: [
      { category_id: 1, month: 1, amount: "200000" },
      { category_id: 1, month: 2, amount: "100000" },
      { category_id: 1, month: 3, amount: "1000000" },
      { category_id: 2, month: 1, amount: "50000" },
    ],
  });
  const line = (category_id, amount) => ({
    category_id,
    amount,
    training_name: "Gelişim",
    participant_count: "2",
    rd_participant_count: "1",
    other_participant_count: "1",
    description: "=1+1",
  });
  const first = s.saveInvoice({
    number: "000001",
    year: 2026,
    month: 1,
    note: "=2+2",
    lines: [line(1, "150000"), line(2, "10000")],
  });
  s.saveInvoice({
    number: "000002",
    year: 2026,
    month: 2,
    lines: [line(1, "100000")],
  });
  s.saveInvoice({
    number: "000003",
    year: 2026,
    month: 3,
    lines: [line(2, "5000")],
  });
  const cancelled = s.saveInvoice({
    number: "İPTAL",
    year: 2026,
    month: 1,
    lines: [line(1, "999")],
  });
  s.cancelInvoice(cancelled.id);
  const p = s.savePayment({
    category_id: 1,
    year: 2026,
    month: 1,
    amount: "300000",
    description: "Toplu ödeme",
  });
  s.linkInvoice({ payment_id: p.id, invoice_id: first.id });
  s.savePaymentSaving({ amount: "50000", note: "Gerçekleşmeyecek" }, p.id);
  return s;
}
async function load(buffer) {
  const b = new ExcelJS.Workbook();
  await b.xlsx.load(buffer);
  return b;
}
const cell = (book, address) =>
  book.getWorksheet("Bütçe Planlama").getCell(address).value;

test("Bütçe çıktısı beş ekran kartını, aylık plan/gerçekleşeni ve yalnız harcama detaylarını içerir", async () => {
  const s = setup();
  try {
    const book = await load(await budgetWorkbook(s, 2026, 1));
    assert.deepEqual(
      book.worksheets.map((w) => w.name),
      ["Bütçe Planlama", "Gerçekleşen Detayları"],
    );
    assert.equal(cell(book, "A5"), 500000); // Annual budget is independent of monthly allocations.
    assert.equal(cell(book, "E5"), 265000);
    assert.equal(cell(book, "I5"), 235000);
    assert.equal(cell(book, "M5"), 100000);
    assert.equal(cell(book, "Q5"), 135000);
    assert.equal(cell(book, "A9"), "Teknik Eğitim");
    assert.equal(cell(book, "B9"), "Planlanan");
    assert.equal(cell(book, "C9"), 200000);
    assert.equal(cell(book, "D9"), 100000);
    assert.equal(cell(book, "B10"), "Gerçekleşen");
    assert.equal(cell(book, "C10"), 150000);
    assert.equal(cell(book, "D10"), 100000);
    assert.equal(cell(book, "O9"), 1300000);
    const detail = book.getWorksheet("Gerçekleşen Detayları");
    assert.equal(detail.rowCount, 5);
    const firstDetail = detail
      .getRows(2, detail.rowCount - 1)
      .find((row) => row.getCell(5).value === "000001");
    assert.ok(firstDetail);
    assert.equal(firstDetail.getCell(10).value, "=1+1");
    assert.equal(firstDetail.getCell(10).type, ExcelJS.ValueType.String);
    assert.equal(firstDetail.getCell(11).value, "=2+2");
    assert.equal(book.getWorksheet("Bütçe Planlama").views[0].ySplit, 8);
  } finally {
    s.close();
  }
});

test("Bütçe seçili versiyon, dönem, kategori, arama ve boş kalem filtreleriyle aynı hesabı verir", async () => {
  const s = setup();
  try {
    const v = s.createVersion({
      year: 2026,
      name: "Revize",
      description: "Yeni bütçe",
      source_id: 1,
      budget_changed: true,
      budget: "600000",
    });
    let book = await load(await budgetWorkbook(s, 2026, v.id));
    assert.equal(cell(book, "A5"), 600000);
    book = await load(
      await budgetWorkbook(s, 2026, 1, {
        from: 1,
        to: 2,
        category: 1,
        search: "teknİk",
        periodFiltered: true,
        hideZero: true,
      }),
    );
    assert.equal(cell(book, "A5"), 300000);
    assert.equal(cell(book, "E5"), 250000);
    assert.equal(cell(book, "I5"), 50000);
    assert.equal(cell(book, "Q5"), -50000);
    assert.equal(book.getWorksheet("Bütçe Planlama").rowCount, 12); // One category and two total rows.
    assert.equal(cell(book, "E9"), 1000000); // All visible months are retained; summary excludes March.
    assert.equal(cell(book, "O9"), 300000);
    assert.equal(book.getWorksheet("Gerçekleşen Detayları").rowCount, 3);
    assert.equal(
      book.getWorksheet("Bütçe Planlama").getCell("E9").font.color.argb,
      "FF96909C",
    );
    book = await load(await budgetWorkbook(s, 2026, 1, { hideZero: true }));
    assert.equal(book.getWorksheet("Bütçe Planlama").rowCount, 14);
    book = await load(
      await budgetWorkbook(s, 2026, 1, { search: "bulunmayan" }),
    );
    assert.equal(cell(book, "A5"), 0);
    assert.equal(book.getWorksheet("Gerçekleşen Detayları").rowCount, 1);
    book = await load(
      await budgetWorkbook(s, 2026, 1, { periodFiltered: true }),
    );
    assert.equal(cell(book, "A5"), 1350000); // Explicit all-month range follows monthly totals, like the screen.
  } finally {
    s.close();
  }
});

test("Fatura çıktısı yalnız listelenen faturaları ve bütün kalemlerini içerir; ödeme/bütçe sayfası eklenmez", async () => {
  const s = setup();
  try {
    let book = await load(
      await invoiceWorkbook(s, 2026, 1, 1, { category: 1, search: "000001" }),
    );
    assert.deepEqual(
      book.worksheets.map((w) => w.name),
      ["Faturalar", "Fatura Detayları"],
    );
    assert.equal(book.getWorksheet("Faturalar").rowCount, 2);
    assert.equal(book.getWorksheet("Faturalar").getCell("B2").value, "000001");
    assert.equal(
      book.getWorksheet("Faturalar").getCell("J2").value,
      "160000,000000",
    );
    assert.equal(book.getWorksheet("Fatura Detayları").rowCount, 3); // Complete invoice, including its other category.
    book = await load(await invoiceWorkbook(s, 2026, 1, 1));
    assert.equal(book.getWorksheet("Faturalar").rowCount, 2);
    book = await load(
      await invoiceWorkbook(s, 2026, 1, 1, { showCancelled: true }),
    );
    assert.equal(book.getWorksheet("Faturalar").rowCount, 3);
    book = await load(
      await invoiceWorkbook(s, 2026, 1, 1, { search: "bulunmayan" }),
    );
    assert.equal(book.getWorksheet("Faturalar").rowCount, 1);
    assert.equal(book.getWorksheet("Fatura Detayları").rowCount, 1);
  } finally {
    s.close();
  }
});

test("Bütçe çıktısında altı ondalık hassasiyet, yüksek tutarlar, negatif kalan ve mikro TL korunur", async () => {
  const s = setup();
  try {
    s.run(
      "UPDATE budget_lines SET amount_units=123456789012345678 WHERE version_id=1 AND category_id=1 AND month=1",
    );
    s.run(
      "UPDATE invoice_lines SET amount_units=123456789012345679 WHERE id=1",
    );
    const book = await load(
      await budgetWorkbook(s, 2026, 1, { from: 1, to: 1, category: 1 }),
    );
    assert.equal(cell(book, "C9"), "123456789012,345678");
    assert.equal(cell(book, "C10"), "123456789012,345679");
    assert.equal(cell(book, "I5"), -0.000001);
    assert.equal(
      book.getWorksheet("Gerçekleşen Detayları").getCell("F2").value,
      "123456789012,345679",
    );
  } finally {
    s.close();
  }
});

test("İki Excel API'si yetki, kapsam doğrulama, eski revizyon ve ayrı dosya adlarını korur", async () => {
  const s = setup(),
    password = "export-test-password";
  s.run(
    "INSERT INTO users(id,username,password_hash,created_at,role) VALUES (1,'viewer',?,'now','viewer')",
    await hashPassword(password),
  );
  s.createYear({ year: 2027, reference: "1000000" });
  const other = s.snapshot(2027).version.id;
  const origin = "http://localhost:3199",
    server = (await createApp(s, { origin })).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    for (const path of ["budget", "invoices"])
      assert.equal(
        (await fetch(`${base}/${path}/export?year=2026`)).status,
        401,
      );
    const response = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username: "viewer", password }),
    });
    const cookie = response.headers.get("set-cookie").split(";")[0];
    const get = (path) => fetch(base + path, { headers: { Cookie: cookie } });
    for (const section of ["budget", "invoices"]) {
      assert.equal(
        (await get(`/${section}/export?year=2026&from=3&to=1`)).status,
        400,
      );
      assert.equal(
        (await get(`/${section}/export?year=2026&showCancelled=wat`)).status,
        400,
      );
      assert.equal(
        (await get(`/${section}/export?year=2026&revision=1`)).status,
        409,
      );
      const exported = await get(
        `/${section}/export?year=2026&from=1&to=2&version=1&category=1&search=Teknik`,
      );
      assert.equal(exported.status, 200);
      assert.match(
        exported.headers.get("content-disposition"),
        new RegExp(
          section === "budget"
            ? "butce-planlama-2026-1-2.xlsx"
            : "faturalar-2026-1-2.xlsx",
        ),
      );
      const book = await load(await exported.arrayBuffer());
      assert.equal(book.worksheets.length, 2);
    }
    assert.equal(
      (await get(`/budget/export?year=2026&version=${other}`)).status,
      400,
    );
    assert.equal(
      (await get("/budget/export?year=2026&version=99999")).status,
      404,
    );
    // Search spaces are passed unchanged, matching the current screen rather than a trimmed scope.
    const empty = await get("/invoices/export?year=2026&search=%20%20");
    assert.equal(empty.status, 200);
    assert.equal(
      (await load(await empty.arrayBuffer())).getWorksheet("Faturalar")
        .rowCount,
      1,
    );
  } finally {
    await new Promise((r) => server.close(r));
    s.close();
  }
});
