import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ExcelJS from "exceljs";
import { Store } from "../backend/store.mjs";
import { createApp } from "../backend/app.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { invoiceWorkbook } from "../backend/invoice-export.mjs";

test("Eski veritabanı rollere taşınır; admin korunur, yeniden açılış yetkileri değiştirmez", () => {
  const dir = mkdtempSync(join(tmpdir(), "budget-migration-")),
    path = join(dir, "test.sqlite");
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(
      "CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password_hash TEXT,created_at TEXT);INSERT INTO users VALUES (1,'demo','hash','now'),(2,'admin','hash','now')",
    );
    legacy.close();
    let store = new Store(path);
    assert.equal(store.get("SELECT role FROM users WHERE id=2").role, "admin");
    assert.equal(store.get("SELECT role FROM users WHERE id=1").role, "editor");
    store.run("UPDATE users SET role='viewer' WHERE id=1");
    store.close();
    store = new Store(path);
    assert.equal(store.get("SELECT role FROM users WHERE id=1").role, "viewer");
    store.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Admin yetkisi, görüntüleyici yazma yasağı, son yönetici koruması, oturum iptali ve güvenli log", async () => {
  const s = new Store(":memory:");
  s.seedDemo();
  const password = "test-password-123",
    hash = await hashPassword(password);
  for (const [name, role] of [
    ["admin", "admin"],
    ["editor", "editor"],
    ["viewer", "viewer"],
  ])
    s.run(
      "INSERT INTO users(username,password_hash,created_at,role) VALUES (?,?,?,?)",
      name,
      hash,
      "now",
      role,
    );
  const origin = "http://localhost:3199",
    server = (await createApp(s, { origin })).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const raw = (path, method = "GET", body, cookie = "", csrf = "") =>
    fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrf,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const login = async (username) => {
    const response = await raw("/auth/login", "POST", { username, password });
    const data = await response.json();
    return {
      data,
      request: (path, method = "GET", body) =>
        raw(
          path,
          method,
          body,
          response.headers.get("set-cookie").split(";")[0],
          data.csrf,
        ),
    };
  };
  try {
    const admin = await login("admin"),
      editor = await login("editor"),
      viewer = await login("viewer");
    assert.equal(viewer.data.user.role, "viewer");
    for (const u of [editor, viewer]) {
      assert.equal((await u.request("/admin/users")).status, 403);
      assert.equal((await u.request("/audit")).status, 403);
      assert.equal(
        (
          await u.request("/admin/users", "POST", {
            username: "hack",
            password,
            role: "admin",
          })
        ).status,
        403,
      );
    }
    assert.equal((await viewer.request("/state?year=2026")).status, 200);
    assert.equal(
      (
        await viewer.request("/years", "POST", {
          year: 2030,
          reference: "100",
          revision: s.revision(),
        })
      ).status,
      403,
    );
    assert.equal(
      (await admin.request("/admin/users/1/role", "PUT", { role: "viewer" }))
        .status,
      400,
    );
    assert.equal(
      (await admin.request("/admin/users/2/role", "PUT", { role: "invalid" }))
        .status,
      400,
    );
    assert.equal(
      (
        await admin.request("/admin/users", "POST", {
          username: "newuser",
          password,
          role: "editor",
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await admin.request("/admin/users", "POST", {
          username: "newuser",
          password,
          role: "editor",
        })
      ).status,
      400,
    );
    assert.equal(
      (await admin.request("/admin/users/2/role", "PUT", { role: "viewer" }))
        .status,
      200,
    );
    assert.equal((await editor.request("/state?year=2026")).status, 401);
    const again = await login("editor");
    assert.equal(again.data.user.role, "viewer");
    assert.equal(
      (
        await again.request("/years", "POST", {
          year: 2030,
          reference: "100",
          revision: s.revision(),
        })
      ).status,
      403,
    );
    const users = await (await admin.request("/admin/users")).json();
    assert.equal(
      users.some((u) => "password_hash" in u),
      false,
    );
    const logs = await (await admin.request("/audit")).json();
    assert.equal(logs.length, 2);
    assert.ok(!JSON.stringify(logs).includes(password));
    assert.ok(!JSON.stringify(logs).includes(hash));
    assert.equal(
      (await viewer.request("/invoices/export?year=2026&from=3&to=1")).status,
      400,
    );
    assert.equal(
      (await viewer.request("/invoices/export?year=2026&from=1&to=2")).status,
      200,
    );
    assert.equal((await raw("/invoices/export?year=2026")).status, 401);
  } finally {
    await new Promise((r) => server.close(r));
    s.close();
  }
});

test("Excel yıl/ay/aralık filtresi, iptaller, baştaki sıfırlar ve altı ondalık detaylar kayıpsız", async () => {
  const s = new Store(":memory:");
  s.seedDemo();
  try {
    const first = s.get("SELECT id FROM invoices ORDER BY id LIMIT 1");
    s.run(
      "UPDATE invoices SET number='000001',month=1,status='cancelled',note='=1+1' WHERE id=?",
      first.id,
    );
    s.run(
      "UPDATE invoice_lines SET amount_units=123456789012345678,foreign_units=123456789,rate_units=45678901,currency='EUR',description='Ayrıntı' WHERE invoice_id=?",
      first.id,
    );
    for (const [from, to] of [
      [1, 12],
      [1, 1],
      [2, 4],
    ]) {
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(
        await invoiceWorkbook(s, 2026, from, to, { showCancelled: true }),
      );
      const expected = s.all(
        "SELECT * FROM invoices WHERE year=2026 AND month BETWEEN ? AND ?",
        from,
        to,
      );
      const sheet = book.getWorksheet("Faturalar");
      assert.equal(sheet.rowCount, expected.length + 1);
      const lines = book.getWorksheet("Fatura Detayları");
      for (let row = 2; row <= sheet.rowCount; row++) {
        assert.ok(
          sheet.getCell(row, 4).value >= from &&
            sheet.getCell(row, 4).value <= to,
        );
      }
      if (from === 1) {
        const row = sheet
          .getRows(2, sheet.rowCount - 1)
          .find((r) => r.getCell(2).value === "000001");
        assert.ok(row);
        assert.equal(row.getCell(7).value, "=1+1");
        assert.equal(row.getCell(7).type, ExcelJS.ValueType.String);
        assert.equal(row.getCell(6).value, "İptal");
        const line = lines
          .getRows(2, lines.rowCount - 1)
          .find((r) => r.getCell(2).value === "000001");
        assert.equal(line.getCell(13).value, "123456789012,345678");
        assert.equal(line.getCell(14).value, "123456789012345678");
        assert.equal(line.getCell(17).value, "EUR");
        assert.equal(line.getCell(23).value, "Ayrıntı");
      }
    }
    const empty = new ExcelJS.Workbook();
    await empty.xlsx.load(await invoiceWorkbook(s, 2099, 1, 12));
    assert.equal(empty.getWorksheet("Faturalar").rowCount, 1);
  } finally {
    s.close();
  }
});

test("Fatura numarası seçimi çok kalemli faturayı bakiyeyle sınırlar, tekrar mükerrer düşmez ve hata atomiktir", () => {
  const s = new Store(":memory:");
  s.seedDemo();
  try {
    const invoice = s.get(
        "SELECT * FROM invoices WHERE status='active' LIMIT 1",
      ),
      line = s.get(
        "SELECT * FROM invoice_lines WHERE invoice_id=? LIMIT 1",
        invoice.id,
      );
    s.run(
      "UPDATE invoice_lines SET amount_units=30000000000 WHERE id=?",
      line.id,
    );
    const p = s.savePayment({
      year: invoice.year,
      month: invoice.month,
      category_id: line.category_id,
      description: "Fatura no testi",
      amount: "50000",
    });
    const second = s.run(
      "INSERT INTO invoice_lines(invoice_id,category_id,training_name,amount_units,participant_count,rd_participant_count,other_participant_count) VALUES (?,?,?,40000000000,0,0,0)",
      invoice.id,
      line.category_id,
      "İkinci kalem",
    );
    const match = () =>
      s.transaction(() =>
        s.linkInvoice({ payment_id: p.id, invoice_id: invoice.id }),
      );
    assert.equal(match().amount_units, "50000000000");
    assert.equal(match().amount_units, "50000000000");
    const links = s.all(
      "SELECT * FROM planned_payment_invoice_links WHERE payment_id=?",
      p.id,
    );
    assert.equal(links.length, 2);
    assert.equal(
      links.find((l) => l.line_id === Number(second.lastInsertRowid))
        .amount_units,
      "20000000000",
    );
    const before = JSON.stringify(links);
    s.run("UPDATE invoices SET status='cancelled' WHERE id=?", invoice.id);
    assert.throws(match, /Aktif fatura/);
    assert.equal(
      JSON.stringify(
        s.all(
          "SELECT * FROM planned_payment_invoice_links WHERE payment_id=?",
          p.id,
        ),
      ),
      before,
    );
    assert.equal(
      s.snapshot(invoice.year).payments.find((x) => x.id === p.id)
        .remaining_units,
      "50000000000",
    );
  } finally {
    s.close();
  }
});

test("Versiyon değişikliği var/yok kaydı planı dağıtmaz; yıl bütçesi ayrı korunur", () => {
  const s = new Store(":memory:");
  s.seedDemo();
  try {
    const base = s.snapshot(2026).version;
    for (const changed of [true, false]) {
      const created = s.transaction(() =>
        s.createVersion({
          year: 2026,
          name: changed ? "Var" : "Yok",
          description: "Açıklama",
          source_id: base.id,
          budget_changed: changed,
          budget: changed ? "2300000" : undefined,
        }),
      );
      assert.equal(created.budget_changed, changed ? 1 : 0);
      const before = s.all(
        "SELECT category_id,month,amount_units FROM budget_lines WHERE version_id=? ORDER BY category_id,month",
        base.id,
      );
      assert.deepEqual(
        s.all(
          "SELECT category_id,month,amount_units FROM budget_lines WHERE version_id=? ORDER BY category_id,month",
          created.id,
        ),
        before,
      );
    }
    assert.throws(
      () =>
        s.transaction(() =>
          s.createVersion({
            year: 2026,
            name: "invalid",
            description: "x",
            budget_changed: "yes",
          }),
        ),
      /var\/yok/,
    );
    assert.equal(
      s.get("SELECT id FROM budget_versions WHERE name='invalid'"),
      undefined,
    );
  } finally {
    s.close();
  }
});
