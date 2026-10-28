import { requireAdmin, registerAdmin } from "./admin.mjs";
import { invoiceWorkbook } from "./invoice-export.mjs";
import { budgetWorkbook } from "./budget-export.mjs";
import express from "express";
import { ValidationError, integer } from "../shared/domain.mjs";
import {
  token,
  digest,
  verifyPassword,
  hashPassword,
  cookieValue,
} from "./auth.mjs";
export async function createApp(
  store,
  { origin = "http://127.0.0.1:3100", secure = false } = {},
) {
  const app = express(),
    failures = new Map(),
    dummyHash = await hashPassword(token());
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws:; frame-ancestors 'none'",
    });
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.headers.origin !== origin || !req.is("application/json"))
    )
      return res.status(403).json({
        error:
          "İstek kaynağı doğrulanamadı. Uygulamayı tanımlı adresinden açın.",
      });
    next();
  });
  app.use(express.json({ limit: "512kb" }));
  const cookie = (res, value, maxAge) =>
    res.cookie("budget_session", value, {
      httpOnly: true,
      sameSite: "strict",
      secure,
      path: "/",
      maxAge,
    });
  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const key = req.ip,
        time = Date.now();
      for (const [k, v] of failures) if (v.until < time) failures.delete(k);
      const limiter = failures.get(key) || {
        count: 0,
        until: time + 15 * 60000,
      };
      if (limiter.count >= 10) {
        res.set(
          "Retry-After",
          String(Math.ceil((limiter.until - time) / 1000)),
        );
        return res.status(429).json({
          error: "Çok fazla giriş denemesi. 15 dakika sonra yeniden deneyin.",
        });
      }
      limiter.count++;
      failures.set(key, limiter);
      const { username, password, remember } = req.body || {};
      if (
        typeof username !== "string" ||
        typeof password !== "string" ||
        password.length > 256 ||
        username.length > 100
      )
        return res
          .status(401)
          .json({ error: "Kullanıcı adı veya parola hatalı." });
      const user = store.get(
        "SELECT * FROM users WHERE username=?",
        username.trim().toLocaleLowerCase("tr-TR"),
      );
      const valid = await verifyPassword(
        password,
        user?.password_hash || dummyHash,
      );
      if (!user || !valid)
        return res
          .status(401)
          .json({ error: "Kullanıcı adı veya parola hatalı." });
      failures.delete(key);
      const value = token(),
        csrf = token(),
        ttl = remember === true ? 7 * 86400000 : 8 * 3600000;
      store.run(
        "DELETE FROM sessions WHERE expires_at<? OR token_hash=?",
        time,
        digest(cookieValue(req)),
      );
      store.run(
        "INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES (?,?,?,?)",
        digest(value),
        user.id,
        csrf,
        time + ttl,
      );
      cookie(res, value, ttl);
      res.json({
        user: { id: user.id, username: user.username, role: user.role },
        csrf,
      });
    } catch (e) {
      next(e);
    }
  });
  app.use("/api", (req, res, next) => {
    const session = store.get(
      "SELECT s.*,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
      digest(cookieValue(req)),
      Date.now(),
    );
    if (!session)
      return res
        .status(401)
        .json({ error: "Oturumunuz sona erdi. Yeniden giriş yapın." });
    req.session = session;
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-csrf-token"] !== session.csrf
    )
      return res
        .status(403)
        .json({ error: "Oturum doğrulaması başarısız. Sayfayı yenileyin." });
    next();
  });
  app.get("/api/auth/me", (req, res) =>
    res.json({
      user: {
        id: req.session.user_id,
        username: req.session.username,
        role: req.session.role,
      },
      csrf: req.session.csrf,
    }),
  );
  app.post("/api/auth/logout", (req, res) => {
    store.run(
      "DELETE FROM sessions WHERE token_hash=?",
      req.session.token_hash,
    );
    cookie(res, "", 0);
    res.json({ ok: true });
  });
  app.get("/api/state", (req, res) => {
    const year = integer(
      req.query.year || 2027,
      "year",
      2000,
      2100,
    );
    res.json(store.snapshot(year, Number(req.query.version) || undefined));
  });
  app.get("/api/audit", requireAdmin, (req, res) =>
    res.json(
      store.all(
        "SELECT a.*,u.username FROM audit_logs a JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200",
      ),
    ),
  );
  registerAdmin(app, store);
  const exportOptions = (query) => {
    const year = integer(query.year, "year", 2000, 2100);
    const from = integer(query.from || 1, "from", 1, 12),
      to = integer(query.to || 12, "to", 1, 12);
    if (from > to)
      throw new ValidationError(
        "Başlangıç ayı bitiş ayından sonra olamaz.",
        "from",
      );
    const flag = (key) => {
      if (query[key] === undefined) return false;
      if (!["true", "false"].includes(query[key]))
        throw new ValidationError("Geçersiz filtre seçimi.", key);
      return query[key] === "true";
    };
    const category = query.category
      ? integer(query.category, "category", 1)
      : 0;
    const search = query.search ?? "";
    if (typeof search !== "string" || search.length > 2000)
      throw new ValidationError(
        "Arama metni en fazla 2000 karakter olabilir.",
        "search",
      );
    if (category) store.exists("budget_categories", category);
    if (
      query.revision !== undefined &&
      integer(query.revision, "revision", 0, Number.MAX_SAFE_INTEGER) !==
        store.revision()
    )
      throw new ValidationError(
        "Veriler değişti. Ekranı yenileyip Excel'i tekrar indirin.",
        "",
        409,
      );
    return {
      year,
      options: {
        from,
        to,
        category,
        search,
        showCancelled: flag("showCancelled"),
        hideZero: flag("hideZero"),
        periodFiltered: flag("periodFiltered"),
      },
    };
  };
  for (const section of ["budget", "invoices"])
    app.get(`/api/${section}/export`, async (req, res, next) => {
      try {
        const { year, options } = exportOptions(req.query),
          { from, to } = options;
        let version;
        if (section === "budget") {
          store.exists("budget_years", year, "year");
          if (req.query.version) {
            version = integer(req.query.version, "version", 1);
            if (store.exists("budget_versions", version).year !== year)
              throw new ValidationError(
                "Versiyon seçilen yıla ait olmalıdır.",
                "version",
              );
          }
        }
        const workbook =
          section === "budget"
            ? await budgetWorkbook(store, year, version, options)
            : await invoiceWorkbook(store, year, from, to, options);
        res.set(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.set(
          "Content-Disposition",
          `attachment; filename="${section === "budget" ? "butce-planlama" : "faturalar"}-${year}-${from}-${to}.xlsx"`,
        );
        res.send(Buffer.from(workbook));
      } catch (e) {
        next(e);
      }
    });
  const mutation = (action, entity, fn) => (req, res, next) => {
    if (req.session.role === "viewer")
      return res
        .status(403)
        .json({ error: "Bu hesap yalnız görüntüleme yetkisine sahiptir." });
    try {
      const id = req.params.id
        ? integer(req.params.id, "id", 1, Number.MAX_SAFE_INTEGER)
        : null;
      res.json(
        store.mutate(
          req.session.user_id,
          req.body.revision,
          action,
          entity,
          id,
          () => fn(req.body, id),
        ),
      );
    } catch (e) {
      next(e);
    }
  };
  app.post(
    "/api/years",
    mutation("Yıl oluşturuldu", "budget_years", (b) => store.createYear(b)),
  );
  app.put(
    "/api/reference",
    mutation("Bütçe güncellendi", "budget_years", (b) =>
      store.updateReference(b),
    ),
  );
  app.post(
    "/api/versions",
    mutation("Versiyon oluşturuldu", "budget_versions", (b) =>
      store.createVersion(b),
    ),
  );
  app.post(
    "/api/versions/:id/activate",
    mutation("Aktif versiyon seçildi", "budget_versions", (_, id) =>
      store.activateVersion(id),
    ),
  );
  app.put(
    "/api/versions/:id",
    mutation("Versiyon güncellendi", "budget_versions", (b, id) =>
      store.updateVersion(b, id),
    ),
  );
  app.put(
    "/api/plan",
    mutation("Aylık plan kaydedildi", "budget_lines", (b) => store.savePlan(b)),
  );
  app.post(
    "/api/categories",
    mutation("Bütçe kalemi oluşturuldu", "budget_categories", (b) =>
      store.category(b),
    ),
  );
  app.put(
    "/api/categories/:id",
    mutation("Bütçe kalemi güncellendi", "budget_categories", (b, id) =>
      store.category(b, id),
    ),
  );
  app.delete(
    "/api/categories/:id",
    mutation("Bütçe kalemi silindi", "budget_categories", (_, id) =>
      store.deleteCategory(id),
    ),
  );
  app.post(
    "/api/training-topics",
    mutation("Eğitim ana başlığı oluşturuldu", "training_topics", (b) =>
      store.trainingTopic(b),
    ),
  );
  app.put(
    "/api/training-topics/:id",
    mutation("Eğitim ana başlığı güncellendi", "training_topics", (b, id) =>
      store.trainingTopic(b, id),
    ),
  );
  app.delete(
    "/api/training-topics/:id",
    mutation("Eğitim ana başlığı silindi", "training_topics", (_, id) =>
      store.deleteTrainingTopic(id),
    ),
  );
  app.post(
    "/api/invoices",
    mutation("Fatura oluşturuldu", "invoices", (b) => store.saveInvoice(b)),
  );
  app.put(
    "/api/invoices/:id",
    mutation("Fatura güncellendi", "invoices", (b, id) =>
      store.saveInvoice(b, id),
    ),
  );
  app.post(
    "/api/invoices/:id/cancel",
    mutation("Fatura iptal edildi", "invoices", (_, id) =>
      store.cancelInvoice(id),
    ),
  );
  app.post(
    "/api/payments",
    mutation("Planlı ödeme oluşturuldu", "planned_payments", (b) =>
      store.savePayment(b),
    ),
  );
  app.put(
    "/api/payments/:id",
    mutation("Planlı ödeme güncellendi", "planned_payments", (b, id) =>
      store.savePayment(b, id),
    ),
  );
  app.post(
    "/api/payments/:id/cancel",
    mutation("Planlı ödeme iptal edildi", "planned_payments", (_, id) => {
      store.exists("planned_payments", id);
      store.run(
        "UPDATE planned_payments SET status='cancelled' WHERE id=?",
        id,
      );
      return store.exists("planned_payments", id);
    }),
  );
  app.put(
    "/api/payments/:id/saving",
    mutation(
      "Planlı ödeme tasarrufu güncellendi",
      "planned_payments",
      (b, id) => store.savePaymentSaving(b, id),
    ),
  );
  app.post(
    "/api/links",
    mutation(
      "Fatura ödeme ile eşleştirildi",
      "planned_payment_invoice_links",
      (b) =>
        b.invoice_ids !== undefined
          ? store.linkInvoices(b)
          : b.invoice_id
            ? store.linkInvoice(b)
            : store.linkPayment(b),
    ),
  );
  app.delete(
    "/api/links/:id",
    mutation(
      "Ödeme eşleştirmesi kaldırıldı",
      "planned_payment_invoice_links",
      (_, id) => {
        store.exists("planned_payment_invoice_links", id);
        store.run("DELETE FROM planned_payment_invoice_links WHERE id=?", id);
        return { id };
      },
    ),
  );
  app.post(
    "/api/savings",
    mutation("Tasarruf eklendi", "savings_items", (b) => store.saveSaving(b)),
  );
  app.put(
    "/api/savings/:id",
    mutation("Tasarruf güncellendi", "savings_items", (b, id) =>
      store.saveSaving(b, id),
    ),
  );
  app.delete(
    "/api/savings/:id",
    mutation("Tasarruf silindi", "savings_items", (_, id) => {
      store.exists("savings_items", id);
      store.run("DELETE FROM savings_items WHERE id=?", id);
      return { id };
    }),
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "İşlem bulunamadı." }),
  );
  app.use((error, req, res, next) => {
    if (error instanceof ValidationError)
      return res
        .status(error.status)
        .json({ error: error.message, field: error.field });
    if (error instanceof SyntaxError || error.type === "entity.too.large")
      return res
        .status(400)
        .json({ error: "İstek içeriği geçersiz veya çok büyük." });
    console.error("İşlem başarısız:", error.code || error.name);
    res
      .status(500)
      .json({ error: "İşlem tamamlanamadı. Verileriniz kaydedilmedi." });
  });
  return app;
}
