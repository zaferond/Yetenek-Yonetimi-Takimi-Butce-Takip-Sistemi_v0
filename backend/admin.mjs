import { hashPassword } from "./auth.mjs";
import { ValidationError, integer, required } from "../shared/domain.mjs";

export function requireAdmin(req, res, next) {
  if (req.session.role !== "admin")
    return res
      .status(403)
      .json({ error: "Bu işlem için yönetici yetkisi gerekir." });
  next();
}
export function registerAdmin(app, store) {
  app.use("/api/admin", requireAdmin);
  app.get("/api/admin/users", (_req, res) =>
    res.json(
      store.all(
        "SELECT id,username,role,created_at FROM users ORDER BY username",
      ),
    ),
  );
  app.post("/api/admin/users", async (req, res, next) => {
    try {
      const username = required(
        req.body.username,
        "username",
        100,
      ).toLocaleLowerCase("tr-TR");
      const role = validRole(req.body.role);
      const password = req.body.password;
      if (
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 256
      )
        throw new ValidationError(
          "Yeni hesap parolası 12–256 karakter olmalıdır.",
          "password",
        );
      const hash = await hashPassword(password);
      const result = store.transaction(() => {
        if (store.get("SELECT id FROM users WHERE username=?", username))
          throw new ValidationError("Bu kullanıcı adı zaten var.", "username");
        const id = Number(
          store.run(
            "INSERT INTO users(username,password_hash,created_at,role) VALUES (?,?,?,?)",
            username,
            hash,
            new Date().toISOString(),
            role,
          ).lastInsertRowid,
        );
        const user = { id, username, role };
        log(
          store,
          req.session.user_id,
          "Kullanıcı oluşturuldu",
          id,
          null,
          user,
        );
        return user;
      });
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/admin/users/:id/role", (req, res, next) => {
    try {
      const id = integer(req.params.id, "id", 1),
        role = validRole(req.body.role);
      const result = store.transaction(() => {
        const user = store.get(
          "SELECT id,username,role FROM users WHERE id=?",
          id,
        );
        if (!user)
          throw new ValidationError("Kullanıcı bulunamadı.", "id", 404);
        if (
          user.role === "admin" &&
          role !== "admin" &&
          store.get("SELECT COUNT(*) AS n FROM users WHERE role='admin'").n <= 1
        )
          throw new ValidationError(
            "Son yöneticinin yetkisi kaldırılamaz.",
            "role",
          );
        if (user.role === role) return user;
        store.run("UPDATE users SET role=? WHERE id=?", role, id);
        // Reauthentication refreshes the affected client's controls; API reads roles on every request.
        store.run("DELETE FROM sessions WHERE user_id=?", id);
        const after = { ...user, role };
        log(
          store,
          req.session.user_id,
          "Kullanıcı yetkisi güncellendi",
          id,
          user,
          after,
        );
        return after;
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });
}
function validRole(value) {
  if (!["admin", "editor", "viewer"].includes(value))
    throw new ValidationError("Geçerli bir yetki seçin.", "role");
  return value;
}
function log(store, actor, action, id, before, after) {
  store.run(
    "INSERT INTO audit_logs(user_id,action,entity,entity_id,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?)",
    actor,
    action,
    "users",
    id,
    JSON.stringify(before),
    JSON.stringify(after),
    new Date().toISOString(),
  );
}
