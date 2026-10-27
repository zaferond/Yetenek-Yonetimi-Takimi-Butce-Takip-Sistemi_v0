import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../backend/store.mjs";
const invoice = (amount = "30000") => ({
  number: "0001",
  year: 2026,
  month: 1,
  lines: [
    {
      category_id: 1,
      training_name: "Eğitim",
      amount,
      participant_count: "0",
      rd_participant_count: "0",
      other_participant_count: "0",
    },
  ],
});
function setup() {
  const s = new Store(":memory:");
  s.run("INSERT INTO users(id,username,password_hash,created_at) VALUES (1,'test','hash','now')");
  s.category({ name: "Teknik Eğitimler" });
  s.createYear({ year: 2026, reference: "100000" });
  return s;
}
const write = (s, entity, fn, id = null) =>
  s.mutate(1, s.revision(), "test", entity, id, fn).result;
test("100.000 plan / 30.000 harcama / 20.000 ödeme; kısmi, tam eşleme ve iptal", () => {
  const s = setup();
  try {
    write(s, "budget_lines", () =>
      s.savePlan({
        version_id: 1,
        cells: [{ category_id: 1, month: 1, amount: "100000" }],
      }),
    );
    write(s, "invoices", () => s.saveInvoice(invoice()));
    const p = write(s, "planned_payments", () =>
      s.savePayment({
        year: 2026,
        month: 1,
        category_id: 1,
        description: "Plan",
        amount: "20000",
      }),
    );
    let row = s.snapshot(2026).rows[0];
    assert.equal(row.remaining, "70000000000");
    assert.equal(row.available, "50000000000");
    const i = write(s, "invoices", () => s.saveInvoice(invoice("10000")));
    write(s, "planned_payment_invoice_links", () =>
      s.linkPayment({
        payment_id: p.id,
        line_id: i.lines[0].id,
        amount: "10000",
      }),
    );
    row = s.snapshot(2026).rows[0];
    assert.equal(row.actual, "40000000000");
    assert.equal(row.pending, "10000000000");
    assert.equal(row.available, "50000000000");
    const i2 = write(s, "invoices", () => s.saveInvoice(invoice("10000")));
    write(s, "planned_payment_invoice_links", () =>
      s.linkPayment({
        payment_id: p.id,
        line_id: i2.lines[0].id,
        amount: "10000",
      }),
    );
    row = s.snapshot(2026).rows[0];
    assert.equal(row.actual, "50000000000");
    assert.equal(row.pending, "0");
    assert.equal(row.available, "50000000000");
    write(s, "invoices", () => s.cancelInvoice(i.id), i.id);
    row = s.snapshot(2026).rows[0];
    assert.equal(row.actual, "40000000000");
    assert.equal(row.pending, "10000000000");
    assert.equal(row.available, "50000000000");
  } finally {
    s.close();
  }
});
test("Fatura atomik kayıt, yabancı anahtar, eski revizyon ve aşan eşleme reddi", () => {
  const s = setup();
  try {
    const bad = invoice();
    bad.lines.push({ ...bad.lines[0], category_id: 999 });
    assert.throws(() => write(s, "invoices", () => s.saveInvoice(bad)));
    assert.equal(s.get("SELECT count(*) AS n FROM invoices").n, 0);
    assert.equal(s.revision(), 0);
    assert.throws(() =>
      s.run(
        "INSERT INTO invoices(number,year,month,note,created_at,updated_at) VALUES ('a',2027,1,'','','')",
      ),
    );
    const i = write(s, "invoices", () => s.saveInvoice(invoice("100")));
    assert.throws(
      () =>
        s.mutate(1, 0, "x", "invoices", null, () => s.saveInvoice(invoice())),
      /başka bir işlem/,
    );
    const p = write(s, "planned_payments", () =>
      s.savePayment({
        year: 2026,
        month: 1,
        category_id: 1,
        description: "Plan",
        amount: "200",
      }),
    );
    assert.throws(
      () =>
        write(s, "planned_payment_invoice_links", () =>
          s.linkPayment({
            payment_id: p.id,
            line_id: i.lines[0].id,
            amount: "101",
          }),
        ),
      /aşıyor/,
    );
    assert.throws(() => s.deleteCategory(1), /silinemez/);
    assert.throws(() => s.category({ name: "TEKNİK EĞİTİMLER" }), /zaten/);
  } finally {
    s.close();
  }
});
test("Versiyon kopyalama faturaları çoğaltmaz; plan güncellemesi önceki versiyonu ezmez", () => {
  const s = setup();
  try {
    write(s, "budget_lines", () =>
      s.savePlan({
        version_id: 1,
        cells: [{ category_id: 1, month: 1, amount: "0,000001" }],
      }),
    );
    write(s, "invoices", () => s.saveInvoice(invoice("50")));
    const v = write(s, "budget_versions", () =>
      s.createVersion({
        year: 2026,
        name: "V2",
        description: "Revizyon",
        source_id: 1,
      }),
    );
    write(s, "budget_lines", () =>
      s.savePlan({
        version_id: v.id,
        cells: [{ category_id: 1, month: 1, amount: "200" }],
      }),
    );
    assert.equal(s.snapshot(2026, 1).rows[0].plan, "1");
    assert.equal(s.snapshot(2026, v.id).rows[0].plan, "200000000");
    assert.equal(
      s.snapshot(2026, v.id).rows[0].actual,
      s.snapshot(2026, 1).rows[0].actual,
    );
    assert.equal(s.snapshot(2026).invoices.length, 1);
  } finally {
    s.close();
  }
});
test("Bağlı fatura düzenlemesi eşleştirme tutarını ve dönemini bozmaz", () => {
  const s = setup();
  try {
    const i = write(s, "invoices", () => s.saveInvoice(invoice("100")));
    const p = write(s, "planned_payments", () =>
      s.savePayment({
        year: 2026,
        month: 1,
        category_id: 1,
        description: "Plan",
        amount: "200",
      }),
    );
    write(s, "planned_payment_invoice_links", () =>
      s.linkPayment({
        payment_id: p.id,
        line_id: i.lines[0].id,
        amount: "100",
      }),
    );
    const edit = invoice("50");
    edit.lines[0].id = i.lines[0].id;
    assert.throws(
      () => write(s, "invoices", () => s.saveInvoice(edit, i.id), i.id),
      /eşleştirmelerini/,
    );
    assert.equal(s.invoice(i.id).lines[0].amount_units, "100000000");
    edit.lines[0].amount = "150";
    write(s, "invoices", () => s.saveInvoice(edit, i.id), i.id);
    assert.equal(s.snapshot(2026).rows[0].actual, "150000000");
    edit.month = 2;
    assert.throws(
      () => write(s, "invoices", () => s.saveInvoice(edit, i.id), i.id),
      /eşleştirmelerini/,
    );
  } finally {
    s.close();
  }
});
test("Yerel veri yeniden açıldığında korunur; seed 11 kategoriyi saklar", () => {
  const dir = mkdtempSync(join(tmpdir(), "budget-test-"));
  try {
    const file = join(dir, "budget.sqlite");
    const s = new Store(file);
    s.seedDemo();
    assert.equal(s.snapshot(2026).rows.length, 11);
    s.close();
    const next = new Store(file);
    assert.equal(next.snapshot(2026).rows.length, 11);
    assert.equal(
      next.snapshot(2026).rows.filter((r) => r.plan === "0").length,
      2,
    );
    assert.equal(next.db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
    next.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
