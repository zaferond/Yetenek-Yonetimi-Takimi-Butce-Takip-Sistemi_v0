// Opt-in migration into an EMPTY schema. It does not switch the application runtime.
import sql from "mssql";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
if (process.env.ALLOW_MSSQL_IMPORT !== "YES")
  throw new Error("Aktarım için ALLOW_MSSQL_IMPORT=YES gereklidir.");
const source = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (
  source.schema_version !== 1 ||
  source.scale !== 1000000 ||
  createHash("sha256").update(JSON.stringify(source.data)).digest("hex") !==
    source.sha256
)
  throw new Error("Aktarım sürümü veya SHA-256 doğrulanamadı.");
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
const pool = await sql.connect({
  server: process.env.MSSQL_SERVER,
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  port: Number(process.env.MSSQL_PORT || 1433),
  options: {
    encrypt: true,
    trustServerCertificate: process.env.MSSQL_TRUST_CERTIFICATE === "true",
  },
});
const tx = new sql.Transaction(pool);
let begun = false;
try {
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  begun = true;
  for (const table of [...tables, "sessions"]) {
    const count = await new sql.Request(tx).query(
      `SELECT COUNT_BIG(*) AS n FROM dbo.[${table}] WITH (TABLOCKX,HOLDLOCK)`,
    );
    if (BigInt(count.recordset[0].n) !== 0n)
      throw new Error("Hedef şema boş olmalıdır.");
  }
  for (const table of tables) {
    const rows = source.data[table];
    if (!Array.isArray(rows)) throw new Error("Tablo eksik: " + table);
    const columns = (
      await new sql.Request(tx).query(
        `SELECT c.name,t.name AS type_name FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('dbo.${table}')`,
      )
    ).recordset;
    const identity = !["meta", "budget_years"].includes(table);
    if (identity)
      await new sql.Request(tx).query(`SET IDENTITY_INSERT dbo.[${table}] ON`);
    for (const row of rows) {
      const keys = Object.keys(row);
      if (keys.some((k) => !columns.some((c) => c.name === k)))
        throw new Error("Geçersiz sütun.");
      const request = new sql.Request(tx);
      keys.forEach((k, i) => {
        const type = columns.find((c) => c.name === k).type_name;
        request.input(
          "p" + i,
          type === "bigint"
            ? sql.BigInt
            : type === "int"
              ? sql.Int
              : sql.NVarChar(sql.MAX),
          row[k],
        );
      });
      await request.query(
        `INSERT INTO dbo.[${table}] (${keys.map((k) => "[" + k + "]").join(",")}) VALUES (${keys.map((_, i) => "@p" + i).join(",")})`,
      );
    }
    if (identity)
      await new sql.Request(tx).query(`SET IDENTITY_INSERT dbo.[${table}] OFF`);
    // Read each value back, converting integers to strings before the driver can lose precision.
    const order =
      table === "meta" ? "key" : table === "budget_years" ? "year" : "id";
    const query = columns
      .map((c) =>
        ["bigint", "int"].includes(c.type_name)
          ? `CONVERT(varchar(30),[${c.name}]) AS [${c.name}]`
          : `[${c.name}]`,
      )
      .join(",");
    const actual = (
      await new sql.Request(tx).query(
        `SELECT ${query} FROM dbo.[${table}] ORDER BY [${order}]`,
      )
    ).recordset;
    const canonical = (r) =>
      JSON.stringify(
        Object.fromEntries(
          Object.keys(r)
            .sort()
            .map((k) => [k, r[k]]),
        ),
      );
    if (
      actual.length !== rows.length ||
      actual.some((r, i) => canonical(r) !== canonical(rows[i]))
    )
      throw new Error(`Değer mutabakatı başarısız: ${table}`);
  }
  await tx.commit();
  begun = false;
  console.log(
    "Aktarım tamamlandı; her tablonun her değeri kaynağa karşı doğrulandı. MSSQL uygulama adaptörü ve kabul testleri ayrıca gereklidir.",
  );
} catch (error) {
  if (begun) await tx.rollback();
  throw error;
} finally {
  await pool.close();
}
