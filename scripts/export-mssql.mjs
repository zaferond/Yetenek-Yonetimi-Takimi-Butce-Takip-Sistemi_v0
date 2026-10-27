import { DatabaseSync } from "node:sqlite";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
const tables = [
  "meta",
  "users",
  "budget_years",
  "budget_versions",
  "budget_categories",
  "training_topics",
  "budget_lines",
  "savings_items",
  "invoices",
  "invoice_lines",
  "planned_payments",
  "planned_payment_invoice_links",
  "audit_logs",
];
const target = resolve(process.argv[2] || "./data/mssql-export.json");
const db = new DatabaseSync(process.env.DB_PATH || "./data/budget.sqlite", {
  readOnly: true,
});
db.exec("BEGIN");
try {
  if (
    db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok" ||
    db.prepare("PRAGMA foreign_key_check").all().length
  )
    throw new Error("SQLite bütünlük kontrolü başarısız.");
  const data = {};
  for (const table of tables) {
    const stmt = db.prepare(
      `SELECT * FROM ${table} ORDER BY ${table === "meta" ? "key" : table === "budget_years" ? "year" : "id"}`,
    );
    stmt.setReadBigInts(true);
    data[table] = stmt
      .all()
      .map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            typeof v === "bigint" ? v.toString() : v,
          ]),
        ),
      );
  }
  db.exec("COMMIT");
  const payload = JSON.stringify(data),
    checksum = createHash("sha256").update(payload).digest("hex");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    JSON.stringify(
      {
        schema_version: 1,
        scale: 1000000,
        tax_basis: "excluded",
        created_at: new Date().toISOString(),
        sha256: checksum,
        data,
      },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    `Aktarım paketi hazır: ${target}. Oturumlar hariç; ${tables.length} tablo. Parola özetleri içerir, Git'e eklemeyin.`,
  );
} finally {
  db.close();
}
