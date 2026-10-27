import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync } from "node:fs";
const database = new DatabaseSync(
  process.env.DB_PATH || "./data/budget.sqlite",
  { readOnly: true },
);
mkdirSync("./data/backups", { recursive: true });
const target = `./data/backups/budget-${new Date().toISOString().replaceAll(":", "-")}.sqlite`;
await backup(database, target);
database.close();
const check = new DatabaseSync(target, { readOnly: true });
if (check.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
  throw new Error("Yedek doğrulanamadı.");
check.close();
console.log(`Doğrulanan yedek: ${target}`);
