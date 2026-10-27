import { Store } from "../backend/store.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { randomBytes } from "node:crypto";
const store = new Store();
try {
  const username = (process.env.ADMIN_USERNAME || "demo")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const user = store.get("SELECT id FROM users WHERE username=?", username);
  if (!user) throw new Error("Kullanıcı bulunamadı.");
  const password = randomBytes(15).toString("base64url"),
    hash = await hashPassword(password);
  store.transaction(() => {
    store.run("UPDATE users SET password_hash=? WHERE id=?", hash, user.id);
    store.run("DELETE FROM sessions WHERE user_id=?", user.id);
    store.run(
      "INSERT INTO audit_logs(user_id,action,entity,entity_id,created_at) VALUES (?,?,?,?,?)",
      user.id,
      "Yerel yönetici parola sıfırladı",
      "users",
      user.id,
      new Date().toISOString(),
    );
  });
  console.log(
    `Kullanıcı: ${username}\nYeni parola (bir kez gösterilir): ${password}`,
  );
} finally {
  store.close();
}
