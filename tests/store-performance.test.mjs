import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Store } from "../backend/store.mjs";
import { sum, subtract, rate } from "../shared/domain.mjs";

// Optimizasyon öncesi snapshot algoritmasının (N+1 sorgu, O(n²) filtre) birebir kopyası.
function referenceSnapshot(s, year, versionId) {
  const years = s.all(
      "SELECT * FROM budget_years WHERE year>=2027 ORDER BY year DESC",
    ),
    categories = s.all("SELECT * FROM budget_categories ORDER BY sort_order,id");
  const versions = s
    .all("SELECT * FROM budget_versions WHERE year=? ORDER BY id", year)
    .map((v) => ({
      ...v,
      effective_budget_units:
        v.budget_units ??
        years.find((y) => y.year === year)?.reference_units ??
        "0",
    }));
  const version =
    versions.find((v) => v.id === versionId) ||
    versions.find((v) => v.active) ||
    versions[0];
  const invoices = s
    .all("SELECT * FROM invoices WHERE year=? ORDER BY id DESC", year)
    .map((i) => ({
      ...i,
      lines: s.all("SELECT * FROM invoice_lines WHERE invoice_id=?", i.id),
    }));
  const links = s.all(
    "SELECT l.* FROM planned_payment_invoice_links l JOIN planned_payments p ON p.id=l.payment_id WHERE p.year=?",
    year,
  );
  const activeLines = invoices
    .filter((i) => i.status === "active")
    .flatMap((i) =>
      i.lines.map((l) => ({
        ...l,
        month: i.month,
        number: i.number,
        year: i.year,
        note: i.note,
      })),
    );
  const payments = s
    .all("SELECT * FROM planned_payments WHERE year=? ORDER BY id DESC", year)
    .map((p) => {
      const linked = sum(
        links
          .filter(
            (l) =>
              l.payment_id === p.id &&
              activeLines.some((il) => il.id === l.line_id),
          )
          .map((l) => l.amount_units),
      );
      return {
        ...p,
        linked_units: linked,
        remaining_units:
          p.status === "active"
            ? subtract(subtract(p.amount_units, linked), p.saving_units)
            : "0",
      };
    });
  const plans = version
    ? s.all("SELECT * FROM budget_lines WHERE version_id=?", version.id)
    : [];
  const rows = categories.map((c) => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const plan =
        plans.find((p) => p.category_id === c.id && p.month === i + 1)
          ?.amount_units || "0";
      const actual = sum(
        activeLines
          .filter((l) => l.category_id === c.id && l.month === i + 1)
          .map((l) => l.amount_units),
      );
      const pending = sum(
        payments
          .filter((p) => p.category_id === c.id && p.month === i + 1)
          .map((p) => p.remaining_units),
      );
      return { plan, actual, pending };
    });
    const plan = sum(months.map((m) => m.plan)),
      actual = sum(months.map((m) => m.actual)),
      pending = sum(months.map((m) => m.pending)),
      remaining = subtract(plan, actual);
    return {
      ...c,
      months,
      plan,
      actual,
      pending,
      remaining,
      available: subtract(remaining, pending),
      usage: rate(actual, plan),
      details: activeLines.filter((l) => l.category_id === c.id),
    };
  });
  const versionTotals = versions.map((v) => ({
    ...v,
    total_units: sum(
      s
        .all("SELECT amount_units FROM budget_lines WHERE version_id=?", v.id)
        .map((l) => l.amount_units),
    ),
  }));
  return {
    revision: s.revision(),
    demo: s.get("SELECT value FROM meta WHERE key='demo'").value === "true",
    tax_basis: "excluded",
    years,
    year,
    versions: versionTotals,
    version,
    categories,
    training_topics: s.all("SELECT * FROM training_topics ORDER BY name_key,id"),
    rows,
    invoices,
    payments,
    links,
    savings: version
      ? s.all("SELECT * FROM savings_items WHERE version_id=?", version.id)
      : [],
  };
}

test("Optimize snapshot demo verisinde eski algoritmayla biçim, sıra ve değer olarak birebir aynıdır", () => {
  const s = new Store(":memory:");
  try {
    s.seedDemo();
    // İptal edilmiş fatura ve eşlemeleri de kapsamak için birini iptal et.
    const inv = s.get(
      "SELECT i.id FROM invoices i JOIN invoice_lines l ON l.invoice_id=i.id JOIN planned_payment_invoice_links k ON k.line_id=l.id WHERE i.status='active' LIMIT 1",
    );
    if (inv) s.cancelInvoice(inv.id);
    const ids = [undefined, ...s.snapshot(2027).versions.map((v) => v.id), 999];
    for (const id of ids)
      assert.equal(
        JSON.stringify(s.snapshot(2027, id)),
        JSON.stringify(referenceSnapshot(s, 2027, id)),
      );
    assert.equal(
      JSON.stringify(s.snapshot(2030)),
      JSON.stringify(referenceSnapshot(s, 2030)),
    );
  } finally {
    s.close();
  }
});

test("Performans indeksleri yeni ve eski veritabanlarında bulunur", () => {
  const expected = {
    invoice_lines_invoice: ["invoice_lines", "invoice_id"],
    link_line: ["planned_payment_invoice_links", "line_id"],
    budget_line_category: ["budget_lines", "category_id"],
    payment_category: ["planned_payments", "category_id"],
    invoice_line_topic: ["invoice_lines", "training_topic_id"],
    saving_version: ["savings_items", "version_id"],
    version_year: ["budget_versions", "year"],
    session_expiry: ["sessions", "expires_at"],
    session_user: ["sessions", "user_id"],
    audit_user: ["audit_logs", "user_id"],
  };
  const check = (s) => {
    for (const [name, [table, column]] of Object.entries(expected)) {
      const idx = s
        .all(`PRAGMA index_list(${table})`)
        .find((i) => i.name === name);
      assert.ok(idx, name);
      assert.deepEqual(
        s.all(`PRAGMA index_info(${name})`).map((c) => c.name),
        [column],
      );
    }
  };
  const mem = new Store(":memory:");
  try {
    check(mem);
    assert.equal(mem.get("PRAGMA synchronous").synchronous, 1);
    assert.equal(mem.get("PRAGMA temp_store").temp_store, 2);
    assert.equal(mem.get("PRAGMA busy_timeout").timeout, 5000);
  } finally {
    mem.close();
  }
  // training_topic_id sütunu olmayan eski şema: göç sonrası indeks eklenmeli.
  const dir = mkdtempSync(join(tmpdir(), "budget-idx-"));
  try {
    const path = join(dir, "old.sqlite"),
      raw = new DatabaseSync(path);
    raw.exec(
      "CREATE TABLE invoice_lines (id INTEGER PRIMARY KEY, invoice_id INTEGER NOT NULL, category_id INTEGER NOT NULL, training_name TEXT NOT NULL, amount_units INTEGER NOT NULL, foreign_units INTEGER, currency TEXT NOT NULL DEFAULT '', rate_units INTEGER, participant_count INTEGER NOT NULL, rd_participant_count INTEGER NOT NULL, other_participant_count INTEGER NOT NULL, description TEXT NOT NULL DEFAULT '') STRICT",
    );
    raw.close();
    const s = new Store(path);
    try {
      check(s);
    } finally {
      s.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Süresi dolmuş oturumlar açılışta ve istek üzerine temizlenir; kapanış zamanlayıcıyı durdurur", () => {
  const dir = mkdtempSync(join(tmpdir(), "budget-sess-"));
  try {
    const path = join(dir, "db.sqlite");
    let s = new Store(path);
    const now = Date.now();
    s.run(
      "INSERT INTO users(id,username,password_hash,created_at) VALUES (1,'u','h','now')",
    );
    s.run(
      "INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES ('old',1,'c',?),('new',1,'c',?)",
      now - 1000,
      now + 3600000,
    );
    s.close();
    assert.equal(s.db.isOpen, false);
    s.close(); // İkinci kapanış hata vermez.
    s = new Store(path);
    try {
      assert.deepEqual(
        s.all("SELECT token_hash FROM sessions").map((r) => r.token_hash),
        ["new"],
      );
      assert.equal(s.purgeExpiredSessions(now + 7200000), 1);
      assert.equal(s.get("SELECT count(*) AS n FROM sessions").n, 0);
      assert.equal(s.sessionTimer.hasRef(), false);
    } finally {
      s.close();
    }
    assert.equal(s.purgeExpiredSessions(), 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Plan kaydı bilinmeyen kategoride atomik olarak 404 döner", () => {
  const s = new Store(":memory:");
  try {
    s.seedDemo();
    const v = s.snapshot(2027).version.id;
    const before = JSON.stringify(s.all("SELECT * FROM budget_lines"));
    assert.throws(
      () =>
        s.transaction(() =>
          s.savePlan({
            version_id: v,
            cells: [
              { category_id: 1, month: 1, amount: "5" },
              { category_id: 9999, month: 1, amount: "5" },
            ],
          }),
        ),
      (e) => e.status === 404,
    );
    assert.equal(JSON.stringify(s.all("SELECT * FROM budget_lines")), before);
  } finally {
    s.close();
  }
});
