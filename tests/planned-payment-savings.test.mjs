import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Store } from "../backend/store.mjs";
import { createApp } from "../backend/app.mjs";
import { hashPassword } from "../backend/auth.mjs";

const units = (tl) => (BigInt(tl) * 1000000n).toString();
function setup() {
  const s = new Store(":memory:");
  s.run(
    "INSERT INTO users(id,username,password_hash,created_at) VALUES (1,'test','hash','now')",
  );
  s.category({ name: "Eğitim" });
  s.createYear({ year: 2027, reference: "500000" });
  s.savePlan({
    version_id: 1,
    cells: [{ category_id: 1, month: 1, amount: "500000" }],
  });
  return s;
}
const payment = (s, amount = "500000") =>
  s.savePayment({
    year: 2027,
    month: 1,
    category_id: 1,
    description: "Toplu eğitim",
    amount,
  });
const invoice = (s, number, amount, month = 1) =>
  s.saveInvoice({
    number,
    year: 2027,
    month,
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
const write = (s, entity, id, fn) =>
  s.mutate(1, s.revision(), "test", entity, id, fn).result;
const match = (s, p, ids) =>
  write(s, "planned_payment_invoice_links", null, () =>
    s.linkInvoices({ payment_id: p.id, invoice_ids: ids }),
  );
const save = (s, p, amount, note = "") =>
  write(s, "planned_payments", p.id, () =>
    s.savePaymentSaving({ amount, note }, p.id),
  );

test("500.000 TL ödeme, üç fatura ve kısmi tasarruf: bakiye, kullanılabilir bütçe ve versiyonlar", () => {
  const s = setup();
  try {
    const p = payment(s),
      a = invoice(s, "0001", "150000"),
      b = invoice(s, "0002", "100000"),
      c = invoice(s, "0003", "100000");
    match(s, p, [a.id, b.id, a.id]);
    match(s, p, [c.id]); // An additional invoice must preserve earlier matches.
    save(s, p, "100000", "Gerçekleşmeyecek eğitim");
    let state = s.snapshot(2027),
      result = state.payments[0];
    assert.equal(state.links.length, 3);
    assert.equal(result.linked_units, units(350000));
    assert.equal(result.saving_units, units(100000));
    assert.equal(result.saving_note, "Gerçekleşmeyecek eğitim");
    assert.equal(result.remaining_units, units(50000));
    assert.equal(state.rows[0].pending, units(50000));
    assert.equal(state.rows[0].available, units(100000));
    assert.equal(state.rows[0].plan, units(500000));
    // Re-matching is idempotent and does not duplicate savings.
    match(s, p, [a.id, b.id, c.id]);
    assert.equal(s.snapshot(2027).payments[0].remaining_units, units(50000));
    const v = s.createVersion({
      year: 2027,
      name: "V2",
      description: "Yeni plan",
      source_id: 1,
    });
    assert.equal(
      s.snapshot(2027, v.id).payments[0].saving_units,
      units(100000),
    );
    assert.equal(s.snapshot(2027).savings.length, 0); // No duplicate manual saving record.
    save(s, p, "150000");
    assert.equal(s.snapshot(2027).payments[0].remaining_units, "0");
    save(s, p, "0");
    assert.equal(s.snapshot(2027).payments[0].remaining_units, units(150000));
  } finally {
    s.close();
  }
});

test("Tasarruf ve tüm fatura eşleştirme yolları aynı ödeme limitini korur", () => {
  const s = setup();
  try {
    const p = payment(s, "100"),
      a = invoice(s, "0001", "80"),
      b = invoice(s, "0002", "80");
    save(s, p, "30");
    match(s, p, [a.id, b.id]);
    let state = s.snapshot(2027);
    assert.equal(state.payments[0].linked_units, units(70));
    assert.equal(state.payments[0].remaining_units, "0");
    assert.equal(state.links.length, 1);
    const before = JSON.stringify(state.links),
      rev = s.revision();
    assert.throws(() => match(s, p, [b.id]), /bakiye/);
    assert.throws(
      () =>
        write(s, "planned_payment_invoice_links", null, () =>
          s.linkPayment({
            payment_id: p.id,
            line_id: b.lines[0].id,
            amount: "1",
          }),
        ),
      /aşıyor/,
    );
    assert.throws(() => save(s, p, "30,000001"), /aşamaz/);
    assert.throws(() => save(s, p, "-1"));
    assert.throws(() => save(s, p, "0,0000001"));
    assert.throws(
      () =>
        write(s, "planned_payments", p.id, () =>
          s.savePayment({ ...p, amount: "99" }, p.id),
        ),
      /toplamından/,
    );
    assert.throws(() =>
      write(s, "planned_payments", p.id, () =>
        s.savePayment({ ...p, month: 2, amount: "100" }, p.id),
      ),
    );
    assert.equal(s.revision(), rev);
    assert.equal(JSON.stringify(s.snapshot(2027).links), before);
    // Another payment may consume only the unused invoice balance.
    const other = payment(s, "100");
    match(s, other, [a.id]);
    assert.equal(
      s.snapshot(2027).payments.find((x) => x.id === other.id).linked_units,
      units(10),
    );
  } finally {
    s.close();
  }
});

test("Hatalı çoklu seçim tüm değişiklikleri geri alır, mevcut bağlantıları korur", () => {
  const s = setup();
  try {
    const p = payment(s),
      a = invoice(s, "0001", "100000"),
      b = invoice(s, "0002", "100000"),
      wrong = invoice(s, "Yanlış ay", "50000", 2);
    match(s, p, [a.id]);
    const before = JSON.stringify(s.snapshot(2027)),
      rev = s.revision();
    for (const ids of [[b.id, wrong.id], [a.id, 999999], [], ["x"]])
      assert.throws(() => match(s, p, ids));
    assert.equal(s.revision(), rev);
    assert.equal(JSON.stringify(s.snapshot(2027)), before);
  } finally {
    s.close();
  }
});

test("Fatura iptali ve eşleştirme kaldırma sadece fatura kısmını açar; ödeme iptali tasarrufu toplam dışına çıkarır", () => {
  const s = setup();
  try {
    const p = payment(s, "100"),
      a = invoice(s, "0001", "40"),
      b = invoice(s, "0002", "30");
    match(s, p, [a.id, b.id]);
    save(s, p, "30");
    s.cancelInvoice(a.id);
    let result = s.snapshot(2027).payments[0];
    assert.equal(result.remaining_units, units(40));
    assert.equal(result.saving_units, units(30));
    s.run("DELETE FROM planned_payment_invoice_links WHERE payment_id=?", p.id);
    assert.equal(s.snapshot(2027).payments[0].remaining_units, units(70));
    s.run("UPDATE planned_payments SET status='cancelled' WHERE id=?", p.id);
    const state = s.snapshot(2027);
    assert.equal(state.payments[0].remaining_units, "0");
    assert.equal(
      state.payments.filter(
        (x) => x.status === "active" && x.saving_units !== "0",
      ).length,
      0,
    );
    assert.throws(() => save(s, p, "10"), /İptal/);
  } finally {
    s.close();
  }
});

test("Mikro TL hassasiyetinde kalan ve tasarruf korunur", () => {
  const s = setup();
  try {
    const p = payment(s, "0,000003"),
      i = invoice(s, "MICRO", "0,000001");
    match(s, p, [i.id]);
    save(s, p, "0,000001");
    assert.equal(s.snapshot(2027).payments[0].remaining_units, "1");
    assert.equal(s.snapshot(2027).payments[0].saving_units, "1");
  } finally {
    s.close();
  }
});

test("Eski veritabanı mevcut kayıtlar korunarak taşınır; tasarruf yeniden açıldığında kalıcıdır", () => {
  const dir = mkdtempSync(join(tmpdir(), "payment-saving-migration-")),
    path = join(dir, "test.sqlite");
  try {
    const legacy = new DatabaseSync(path);
    const schema = readFileSync(
      new URL("../backend/schema.sql", import.meta.url),
      "utf8",
    ).replace(
      ", saving_units INTEGER NOT NULL DEFAULT 0 CHECK(saving_units>=0 AND saving_units<=amount_units), saving_note TEXT NOT NULL DEFAULT ''",
      "",
    );
    legacy.exec(schema);
    legacy.exec(
      "INSERT INTO budget_years(year,reference_units) VALUES (2027,100000000); INSERT INTO budget_categories(id,name,name_key,sort_order) VALUES (1,'Eğitim','eğitim',0); INSERT INTO planned_payments(id,category_id,year,month,description,amount_units) VALUES (1,1,2027,1,'Eski kayıt',100000000)",
    );
    legacy.close();
    let s = new Store(path);
    assert.equal(s.snapshot(2027).payments[0].saving_units, "0");
    s.savePaymentSaving({ amount: "40", note: "Korunan tasarruf" }, 1);
    s.close();
    s = new Store(path);
    assert.equal(s.snapshot(2027).payments[0].description, "Eski kayıt");
    assert.equal(s.snapshot(2027).payments[0].saving_units, units(40));
    assert.equal(s.snapshot(2027).payments[0].remaining_units, units(60));
    assert.equal(s.snapshot(2027).payments[0].saving_note, "Korunan tasarruf");
    s.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("API çoklu eşleştirme, tasarruf, revizyon kontrolü, audit ve görüntüleyici koruması", async () => {
  const s = setup(),
    password = "payment-test-password";
  const hash = await hashPassword(password);
  s.run("UPDATE users SET password_hash=?,role='editor' WHERE id=1", hash);
  s.run(
    "INSERT INTO users(id,username,password_hash,created_at,role) VALUES (2,'viewer',?,'now','viewer')",
    hash,
  );
  const p = payment(s),
    a = invoice(s, "0001", "100000"),
    b = invoice(s, "0002", "100000");
  const origin = "http://localhost:3199",
    server = (await createApp(s, { origin })).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = async (username) => {
    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const { csrf } = await response.json(),
      cookie = response.headers.get("set-cookie").split(";")[0];
    return (path, method, body) =>
      fetch(base + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: cookie,
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify(body),
      });
  };
  try {
    const editor = await login("test"),
      viewer = await login("viewer");
    assert.equal(
      (
        await viewer(`/payments/${p.id}/saving`, "PUT", {
          revision: s.revision(),
          amount: "1",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await viewer("/links", "POST", {
          revision: s.revision(),
          payment_id: p.id,
          invoice_ids: [a.id],
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await editor("/links", "POST", {
          revision: s.revision(),
          payment_id: p.id,
          invoice_ids: [a.id, b.id],
        })
      ).status,
      200,
    );
    const revision = s.revision();
    assert.equal(
      (
        await editor(`/payments/${p.id}/saving`, "PUT", {
          revision,
          amount: "250000",
          note: "İptal edilen bölüm",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await editor(`/payments/${p.id}/saving`, "PUT", {
          revision,
          amount: "1",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await editor(`/payments/${p.id}/saving`, "PUT", {
          revision: s.revision(),
          amount: "300001",
        })
      ).status,
      400,
    );
    assert.equal(s.snapshot(2027).payments[0].remaining_units, units(50000));
    const audit = s.get(
      "SELECT * FROM audit_logs WHERE entity='planned_payments' AND entity_id=? ORDER BY id DESC LIMIT 1",
      p.id,
    );
    assert.equal(JSON.parse(audit.before_json).record.saving_units, "0");
    assert.equal(JSON.parse(audit.after_json).saving_units, units(250000));
  } finally {
    await new Promise((r) => server.close(r));
    s.close();
  }
});
