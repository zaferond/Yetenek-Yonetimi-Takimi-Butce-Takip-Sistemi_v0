import { Store } from "./store.mjs";
import { hashPassword } from "./auth.mjs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
const store = new Store();
try {
  if (process.argv.includes("--reset-demo")) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.ALLOW_DEMO_RESET !== "YES" ||
      store.get("SELECT value FROM meta WHERE key='demo'").value !== "true" ||
      resolve(process.env.DB_PATH || "./data/budget.sqlite") !==
        resolve("./data/budget.sqlite")
    )
      throw new Error(
        "Sıfırlama reddedildi. Yalnızca varsayılan yerel demo için ALLOW_DEMO_RESET=YES kullanın.",
      );
    store.transaction(() => {
      for (const table of [
        "audit_logs",
        "planned_payment_invoice_links",
        "planned_payments",
        "invoice_lines",
        "invoices",
        "savings_items",
        "budget_lines",
        "budget_versions",
        "budget_years",
        "budget_categories",
        "training_topics",
        "sessions",
      ])
        store.run(`DELETE FROM ${table}`);
      store.seedDemo();
      store.run(
        "UPDATE meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'",
      );
    });
    console.log(
      "Kurgusal demo verileri sıfırlandı. Kullanıcı parolası korundu; oturumlar kapatıldı.",
    );
  } else if (store.get("SELECT id FROM users LIMIT 1"))
    console.log("Kurulum zaten tamamlanmış. Veriler ve parola değiştirilmedi.");
  else {
    const username = (process.env.ADMIN_USERNAME || "demo")
        .trim()
        .toLocaleLowerCase("tr-TR"),
      password =
        process.env.ADMIN_PASSWORD || randomBytes(15).toString("base64url");
    if (
      !username ||
      username.length > 100 ||
      password.length < 12 ||
      password.length > 256
    )
      throw new Error(
        "Geçerli kullanıcı adı ve 12–256 karakterlik parola gerekir.",
      );
    const hash = await hashPassword(password);
    store.transaction(() => {
      store.run(
        "INSERT INTO users(username,password_hash,created_at,role) VALUES (?,?,?,'admin')",
        username,
        hash,
        new Date().toISOString(),
      );
      if (
        process.env.SEED_DEMO !== "false" &&
        process.env.NODE_ENV !== "production"
      )
        store.seedDemo();
      else {
        for (const [i, name] of CATEGORIES.entries())
          store.run(
            "INSERT INTO budget_categories(name,name_key,sort_order) VALUES (?,?,?)",
            name,
            normalizeName(name),
            i,
          );
        store.createYear({ year: new Date().getFullYear(), reference: "0" });
      }
    });
    console.log(`Kurulum tamamlandı. Kullanıcı: ${username}`);
    if (!process.env.ADMIN_PASSWORD)
      console.log(`Tek seferlik gösterilen parola: ${password}`);
  }
} finally {
  store.close();
}
import { CATEGORIES, normalizeName } from "../shared/domain.mjs";
