import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  CATEGORIES,
  ValidationError,
  required,
  optional,
  integer,
  parseAmount,
  normalizeName,
  validateInvoice,
  sum,
  subtract,
  rate,
} from "../shared/domain.mjs";
const now = () => new Date().toISOString();
export class Store {
  constructor(path = process.env.DB_PATH || "./data/budget.sqlite") {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
    );
    this.transaction(() => {
      if (
        !this.all("PRAGMA table_info(invoice_lines)").some(
          (c) => c.name === "training_topic_id",
        )
      ) {
        this.db.exec(
          "ALTER TABLE invoice_lines ADD COLUMN training_topic_id INTEGER REFERENCES training_topics(id)",
        );
      }
      if (
        !this.all("PRAGMA table_info(users)").some((c) => c.name === "role")
      ) {
        this.db.exec(
          "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('admin','editor','viewer'))",
        );
        const admin = this.get(
          "SELECT id FROM users ORDER BY CASE WHEN username='admin' THEN 0 ELSE 1 END,id LIMIT 1",
        );
        if (admin)
          this.run("UPDATE users SET role='admin' WHERE id=?", admin.id);
      }
      if (
        !this.all("PRAGMA table_info(budget_versions)").some(
          (c) => c.name === "budget_changed",
        )
      ) {
        this.db.exec(
          "ALTER TABLE budget_versions ADD COLUMN budget_changed INTEGER CHECK(budget_changed IN (0,1))",
        );
      }
      const paymentColumns = this.all("PRAGMA table_info(planned_payments)");
      if (!paymentColumns.some((c) => c.name === "saving_units"))
        this.db.exec(
          "ALTER TABLE planned_payments ADD COLUMN saving_units INTEGER NOT NULL DEFAULT 0 CHECK(saving_units>=0 AND saving_units<=amount_units)",
        );
      if (!paymentColumns.some((c) => c.name === "saving_note"))
        this.db.exec(
          "ALTER TABLE planned_payments ADD COLUMN saving_note TEXT NOT NULL DEFAULT ''",
        );
      if (
        !this.all("PRAGMA table_info(budget_versions)").some(
          (c) => c.name === "budget_units",
        )
      )
        this.db.exec(
          "ALTER TABLE budget_versions ADD COLUMN budget_units INTEGER CHECK(budget_units>=0)",
        );
      this.run("UPDATE meta SET value='5' WHERE key='schema_version'");
    });
  }
  all(sql, ...args) {
    const stmt = this.db.prepare(sql);
    stmt.setReadBigInts(true);
    return stmt
      .all(...args)
      .map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            typeof v === "bigint"
              ? k.endsWith("_units")
                ? String(v)
                : Number(v)
              : v,
          ]),
        ),
      );
  }
  get(sql, ...args) {
    return this.all(sql, ...args)[0];
  }
  run(sql, ...args) {
    return this.db.prepare(sql).run(...args);
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  exists(table, id, field = "id") {
    const row = this.get(`SELECT * FROM ${table} WHERE ${field}=?`, id);
    if (!row) throw new ValidationError("İlgili kayıt bulunamadı.", field, 404);
    return row;
  }
  revision() {
    return Number(
      this.get("SELECT value FROM meta WHERE key='revision'").value,
    );
  }
  mutate(userId, revision, action, entity, id, fn) {
    return this.transaction(() => {
      if (revision !== this.revision())
        throw new ValidationError(
          "Veriler başka bir işlemde değişti. Yenileyip değişikliğinizi tekrar uygulayın.",
          "",
          409,
        );
      const before = id
        ? this.get(`SELECT * FROM ${entity} WHERE id=?`, id)
        : null;
      const beforeLines =
        entity === "invoices" && id
          ? this.all("SELECT * FROM invoice_lines WHERE invoice_id=?", id)
          : undefined;
      const result = fn();
      this.run(
        "UPDATE meta SET value=? WHERE key='revision'",
        String(revision + 1),
      );
      this.run(
        "INSERT INTO audit_logs(user_id,action,entity,entity_id,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?)",
        userId,
        action,
        entity,
        id || result?.id || null,
        JSON.stringify({ record: before, lines: beforeLines }),
        JSON.stringify(result ?? null),
        now(),
      );
      return { result, revision: revision + 1 };
    });
  }
  createYear(input) {
    const year = integer(input.year, "year", 2000, 2100);
    if (this.get("SELECT year FROM budget_years WHERE year=?", year))
      throw new ValidationError("Bu yıl zaten mevcut.", "year");
    this.run(
      "INSERT INTO budget_years(year,reference_units) VALUES (?,?)",
      year,
      BigInt(parseAmount(input.reference, "reference")),
    );
    const id = Number(
      this.run(
        "INSERT INTO budget_versions(year,name,description,active,created_at) VALUES (?,?,?,?,?)",
        year,
        "V1",
        "İlk plan",
        1,
        now(),
      ).lastInsertRowid,
    );
    return { id, year };
  }
  versionFields(input) {
    const name = required(input.name, "name", 80),
      description = required(input.description, "description");
    if (
      input.budget_changed !== undefined &&
      ![true, false].includes(input.budget_changed)
    )
      throw new ValidationError(
        "Bütçe değişikliği var/yok seçilmelidir.",
        "budget_changed",
      );
    const budget =
      input.budget_changed === true
        ? parseAmount(input.budget, "budget")
        : null;
    return { name, description, budget };
  }
  createVersion(input) {
    const year = integer(input.year, "year", 2000, 2100);
    this.exists("budget_years", year, "year");
    const { name, description, budget } = this.versionFields(input);
    if (
      this.get(
        "SELECT id FROM budget_versions WHERE year=? AND name=?",
        year,
        name,
      )
    )
      throw new ValidationError("Bu yılda aynı isimli versiyon var.", "name");
    const source = input.source_id
      ? this.exists("budget_versions", integer(input.source_id, "source_id", 1))
      : null;
    if (source && source.year !== year)
      throw new ValidationError("Kopyalanan versiyon aynı yıla ait olmalıdır.");
    const inheritedBudget = source?.budget_units ?? null;
    const versionBudget =
      input.budget_changed === true ? budget : inheritedBudget;
    const id = Number(
      this.run(
        "INSERT INTO budget_versions(year,name,description,created_at,budget_changed,budget_units) VALUES (?,?,?,?,?,?)",
        year,
        name,
        description,
        now(),
        input.budget_changed === undefined
          ? null
          : input.budget_changed
            ? 1
            : 0,
        versionBudget === null ? null : BigInt(versionBudget),
      ).lastInsertRowid,
    );
    if (source) {
      this.run(
        "INSERT INTO budget_lines(version_id,category_id,month,amount_units) SELECT ?,category_id,month,amount_units FROM budget_lines WHERE version_id=?",
        id,
        source.id,
      );
    }
    return this.exists("budget_versions", id);
  }
  updateVersion(input, id) {
    const old = this.exists("budget_versions", id),
      { name, description, budget } = this.versionFields(input);
    if (![true, false].includes(input.budget_changed))
      throw new ValidationError(
        "Bütçe değişikliği var/yok seçilmelidir.",
        "budget_changed",
      );
    if (
      this.get(
        "SELECT id FROM budget_versions WHERE year=? AND name=? AND id<>?",
        old.year,
        name,
        id,
      )
    )
      throw new ValidationError("Bu yılda aynı isimli versiyon var.", "name");
    // An unchanged inherited budget is preserved when only metadata is edited.
    const versionBudget = input.budget_changed
      ? budget
      : old.budget_changed === 1
        ? null
        : old.budget_units;
    this.run(
      "UPDATE budget_versions SET name=?,description=?,budget_changed=?,budget_units=? WHERE id=?",
      name,
      description,
      input.budget_changed ? 1 : 0,
      versionBudget === null ? null : BigInt(versionBudget),
      id,
    );
    return this.exists("budget_versions", id);
  }
  updateReference(input) {
    const year = integer(input.year, "year", 2000, 2100);
    this.exists("budget_years", year, "year");
    const amount = parseAmount(input.reference, "reference");
    if (input.version_id) {
      const version = this.exists(
        "budget_versions",
        integer(input.version_id, "version_id", 1),
      );
      if (version.year !== year)
        throw new ValidationError("Versiyon seçilen yıla ait olmalıdır.");
      if (version.budget_units !== null) {
        this.run(
          "UPDATE budget_versions SET budget_units=?,budget_changed=1 WHERE id=?",
          BigInt(amount),
          version.id,
        );
        return { year, version_id: version.id, reference_units: amount };
      }
    }
    this.run(
      "UPDATE budget_years SET reference_units=? WHERE year=?",
      BigInt(amount),
      year,
    );
    return { year, reference_units: amount };
  }
  activateVersion(id) {
    const v = this.exists("budget_versions", id);
    this.run("UPDATE budget_versions SET active=0 WHERE year=?", v.year);
    this.run("UPDATE budget_versions SET active=1 WHERE id=?", id);
    return this.exists("budget_versions", id);
  }
  savePlan(input) {
    const version = this.exists(
      "budget_versions",
      integer(input.version_id, "version_id", 1),
    );
    const beforeCells = this.all(
      "SELECT category_id,month,amount_units FROM budget_lines WHERE version_id=?",
      version.id,
    );
    if (
      !Array.isArray(input.cells) ||
      input.cells.length > 2400 ||
      !input.cells.length
    )
      throw new ValidationError("Kaydedilecek bütçe hücresi bulunamadı.");
    const seen = new Set();
    for (const cell of input.cells) {
      const category = integer(cell.category_id, "category_id", 1),
        month = integer(cell.month, "month", 1, 12);
      this.exists("budget_categories", category);
      const key = `${category}:${month}`;
      if (seen.has(key))
        throw new ValidationError("Aynı hücre iki kez gönderilemez.");
      seen.add(key);
      this.run(
        "INSERT INTO budget_lines(version_id,category_id,month,amount_units) VALUES (?,?,?,?) ON CONFLICT(version_id,category_id,month) DO UPDATE SET amount_units=excluded.amount_units",
        version.id,
        category,
        month,
        BigInt(parseAmount(cell.amount, key)),
      );
    }
    return {
      version_id: version.id,
      beforeCells: beforeCells.filter((c) =>
        seen.has(`${c.category_id}:${c.month}`),
      ),
      cells: input.cells,
    };
  }
  category(input, id) {
    const name = required(input.name, "name"),
      key = normalizeName(name);
    if (
      this.get(
        "SELECT id FROM budget_categories WHERE name_key=? AND id<>?",
        key,
        id || 0,
      )
    )
      throw new ValidationError("Bu bütçe kalemi zaten var.", "name");
    if (id) {
      this.exists("budget_categories", id);
      this.run(
        "UPDATE budget_categories SET name=?,name_key=? WHERE id=?",
        name,
        key,
        id,
      );
    } else
      id = Number(
        this.run(
          "INSERT INTO budget_categories(name,name_key,sort_order) VALUES (?,?,?)",
          name,
          key,
          Date.now(),
        ).lastInsertRowid,
      );
    return this.exists("budget_categories", id);
  }
  deleteCategory(id) {
    this.exists("budget_categories", id);
    if (
      this.get(
        "SELECT id FROM invoice_lines WHERE category_id=? LIMIT 1",
        id,
      ) ||
      this.get(
        "SELECT id FROM planned_payments WHERE category_id=? LIMIT 1",
        id,
      ) ||
      this.get(
        "SELECT id FROM budget_lines WHERE category_id=? AND amount_units>0 LIMIT 1",
        id,
      )
    )
      throw new ValidationError(
        "Bu kalemde plan, fatura veya planlı ödeme var. Geçmiş kayıtları korumak için silinemez.",
      );
    this.run("DELETE FROM budget_lines WHERE category_id=?", id);
    this.run("DELETE FROM budget_categories WHERE id=?", id);
    return { id };
  }
  trainingTopic(input, id) {
    const name = required(input.name, "name"),
      key = normalizeName(name);
    if (
      this.get(
        "SELECT id FROM training_topics WHERE name_key=? AND id<>?",
        key,
        id || 0,
      )
    )
      throw new ValidationError("Bu eğitim ana başlığı zaten var.", "name");
    if (id) {
      this.exists("training_topics", id);
      this.run(
        "UPDATE training_topics SET name=?,name_key=? WHERE id=?",
        name,
        key,
        id,
      );
    } else {
      id = Number(
        this.run(
          "INSERT INTO training_topics(name,name_key) VALUES (?,?)",
          name,
          key,
        ).lastInsertRowid,
      );
    }
    return this.exists("training_topics", id);
  }
  deleteTrainingTopic(id) {
    this.exists("training_topics", id);
    if (
      this.get(
        "SELECT id FROM invoice_lines WHERE training_topic_id=? LIMIT 1",
        id,
      )
    )
      throw new ValidationError(
        "Bu başlık fatura kayıtlarında kullanılıyor. Silmek için önce ilgili faturaların eğitim ana başlığını değiştirin. İptal faturalarının bağlantıları da korunur.",
      );
    this.run("DELETE FROM training_topics WHERE id=?", id);
    return { id };
  }
  invoice(id) {
    const invoice = this.exists("invoices", id);
    return {
      ...invoice,
      lines: this.all("SELECT * FROM invoice_lines WHERE invoice_id=?", id),
    };
  }
  saveInvoice(input, id) {
    const v = validateInvoice(input);
    this.exists("budget_years", v.year, "year");
    if (id) {
      const old = this.invoice(id);
      if (old.status !== "active")
        throw new ValidationError("İptal edilmiş fatura düzenlenemez.");
      // Preserve line IDs for links; edits cannot invalidate any live allocation.
      for (const line of old.lines) {
        const links = this.all(
          "SELECT l.*,p.year,p.month,p.category_id FROM planned_payment_invoice_links l JOIN planned_payments p ON p.id=l.payment_id WHERE l.line_id=?",
          line.id,
        );
        if (!links.length) continue;
        const next = v.lines.find((x) => x.id === line.id);
        if (
          !next ||
          BigInt(next.amount_units) <
            BigInt(sum(links.map((l) => l.amount_units))) ||
          links.some(
            (l) =>
              l.year !== v.year ||
              l.month !== v.month ||
              l.category_id !== next.category_id,
          )
        )
          throw new ValidationError(
            "Önce bu faturanın planlı ödeme eşleştirmelerini kaldırın; değişiklik bağlantıları geçersiz kılıyor.",
          );
      }
      if (v.lines.some((l) => l.id && !old.lines.some((o) => o.id === l.id)))
        throw new ValidationError("Geçersiz fatura kalemi.");
      this.run(
        "UPDATE invoices SET number=?,year=?,month=?,note=?,updated_at=? WHERE id=?",
        v.number,
        v.year,
        v.month,
        v.note,
        now(),
        id,
      );
      for (const l of old.lines)
        if (!v.lines.some((n) => n.id === l.id))
          this.run("DELETE FROM invoice_lines WHERE id=?", l.id);
    } else {
      if (v.lines.some((l) => l.id))
        throw new ValidationError("Yeni fatura mevcut kalem kimliği içeremez.");
      id = Number(
        this.run(
          "INSERT INTO invoices(number,year,month,note,created_at,updated_at) VALUES (?,?,?,?,?,?)",
          v.number,
          v.year,
          v.month,
          v.note,
          now(),
          now(),
        ).lastInsertRowid,
      );
    }
    const ids = new Set();
    for (const l of v.lines) {
      this.exists("budget_categories", l.category_id);
      if (
        l.training_topic_id !== null &&
        !this.get(
          "SELECT id FROM training_topics WHERE id=?",
          l.training_topic_id,
        )
      )
        throw new ValidationError(
          "Seçilen eğitim ana başlığı bulunamadı.",
          `lines.${v.lines.indexOf(l)}.training_topic_id`,
        );
      if (l.id && ids.has(l.id))
        throw new ValidationError("Fatura kalemi tekrarlanamaz.");
      ids.add(l.id);
      const vals = [
        l.training_topic_id,
        l.category_id,
        l.training_name,
        BigInt(l.amount_units),
        l.foreign_units === null ? null : BigInt(l.foreign_units),
        l.currency,
        l.rate_units === null ? null : BigInt(l.rate_units),
        l.participant_count,
        l.rd_participant_count,
        l.other_participant_count,
        l.description,
      ];
      if (l.id)
        this.run(
          "UPDATE invoice_lines SET training_topic_id=?,category_id=?,training_name=?,amount_units=?,foreign_units=?,currency=?,rate_units=?,participant_count=?,rd_participant_count=?,other_participant_count=?,description=? WHERE id=?",
          ...vals,
          l.id,
        );
      else
        this.run(
          "INSERT INTO invoice_lines(training_topic_id,category_id,training_name,amount_units,foreign_units,currency,rate_units,participant_count,rd_participant_count,other_participant_count,description,invoice_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          ...vals,
          id,
        );
    }
    return this.invoice(id);
  }
  cancelInvoice(id) {
    this.exists("invoices", id);
    this.run(
      "UPDATE invoices SET status='cancelled',updated_at=? WHERE id=?",
      now(),
      id,
    );
    return this.invoice(id);
  }
  savePayment(input, id) {
    const category = integer(input.category_id, "category_id", 1),
      year = integer(input.year, "year", 2000, 2100),
      month = integer(input.month, "month", 1, 12),
      description = required(input.description, "description"),
      amount = parseAmount(input.amount, "amount", true);
    this.exists("budget_categories", category);
    this.exists("budget_years", year, "year");
    if (id) {
      const old = this.exists("planned_payments", id);
      if (old.status !== "active")
        throw new ValidationError("İptal edilmiş ödeme düzenlenemez.");
      const links = this.all(
        "SELECT * FROM planned_payment_invoice_links WHERE payment_id=?",
        id,
      );
      if (
        links.length &&
        (category !== old.category_id ||
          year !== old.year ||
          month !== old.month ||
          BigInt(amount) < BigInt(sum(links.map((l) => l.amount_units))))
      )
        throw new ValidationError("Önce ödeme eşleştirmelerini kaldırın.");
      if (
        BigInt(old.saving_units) > 0n &&
        (category !== old.category_id ||
          year !== old.year ||
          month !== old.month)
      )
        throw new ValidationError(
          "Dönem veya bütçe kalemini değiştirmeden önce ödeme tasarrufunu kaldırın.",
        );
      const linked = this.paymentLinkedUnits(id);
      if (BigInt(amount) < BigInt(linked) + BigInt(old.saving_units))
        throw new ValidationError(
          "Planlanan tutar, faturalanan ve tasarrufa ayrılan tutarın toplamından az olamaz.",
          "amount",
        );
      this.run(
        "UPDATE planned_payments SET category_id=?,year=?,month=?,description=?,amount_units=? WHERE id=?",
        category,
        year,
        month,
        description,
        BigInt(amount),
        id,
      );
    } else
      id = Number(
        this.run(
          "INSERT INTO planned_payments(category_id,year,month,description,amount_units) VALUES (?,?,?,?,?)",
          category,
          year,
          month,
          description,
          BigInt(amount),
        ).lastInsertRowid,
      );
    return this.exists("planned_payments", id);
  }
  paymentLinkedUnits(id) {
    return sum(
      this.all(
        "SELECT l.amount_units FROM planned_payment_invoice_links l JOIN invoice_lines il ON il.id=l.line_id JOIN invoices i ON i.id=il.invoice_id WHERE l.payment_id=? AND i.status='active'",
        id,
      ).map((l) => l.amount_units),
    );
  }
  savePaymentSaving(input, id) {
    const payment = this.exists("planned_payments", id);
    if (payment.status !== "active")
      throw new ValidationError(
        "İptal edilmiş ödeme için tasarruf kaydedilemez.",
      );
    const amount = parseAmount(input.amount, "amount"),
      note = optional(input.note, "note");
    if (
      BigInt(amount) + BigInt(this.paymentLinkedUnits(id)) >
      BigInt(payment.amount_units)
    )
      throw new ValidationError(
        "Tasarruf tutarı, ödemenin faturalanmamış tutarını aşamaz.",
        "amount",
      );
    this.run(
      "UPDATE planned_payments SET saving_units=?,saving_note=? WHERE id=?",
      BigInt(amount),
      note,
      id,
    );
    return this.exists("planned_payments", id);
  }
  linkPayment(input) {
    const payment = this.exists(
        "planned_payments",
        integer(input.payment_id, "payment_id", 1),
      ),
      line = this.exists("invoice_lines", integer(input.line_id, "line_id", 1)),
      inv = this.exists("invoices", line.invoice_id),
      amount = parseAmount(input.amount, "amount", true);
    if (
      payment.status !== "active" ||
      inv.status !== "active" ||
      payment.year !== inv.year ||
      payment.month !== inv.month ||
      payment.category_id !== line.category_id
    )
      throw new ValidationError(
        "Aktif fatura ve ödeme aynı yıl, ay ve bütçe kaleminde olmalıdır.",
      );
    const links = this.all(
      "SELECT l.* FROM planned_payment_invoice_links l JOIN invoice_lines il ON il.id=l.line_id JOIN invoices i ON i.id=il.invoice_id JOIN planned_payments p ON p.id=l.payment_id WHERE i.status='active' AND p.status='active'",
    );
    const linkedPayment = BigInt(
        sum(
          links
            .filter((l) => l.payment_id === payment.id && l.line_id !== line.id)
            .map((l) => l.amount_units),
        ),
      ),
      linkedLine = BigInt(
        sum(
          links
            .filter((l) => l.line_id === line.id && l.payment_id !== payment.id)
            .map((l) => l.amount_units),
        ),
      );
    if (
      linkedPayment + BigInt(amount) + BigInt(payment.saving_units) >
        BigInt(payment.amount_units) ||
      linkedLine + BigInt(amount) > BigInt(line.amount_units)
    )
      throw new ValidationError(
        "Eşleşen tutar ödeme veya fatura kaleminin kullanılabilir tutarını aşıyor.",
        "amount",
      );
    this.run(
      "INSERT INTO planned_payment_invoice_links(payment_id,line_id,amount_units) VALUES (?,?,?) ON CONFLICT(payment_id,line_id) DO UPDATE SET amount_units=excluded.amount_units",
      payment.id,
      line.id,
      BigInt(amount),
    );
    return { payment_id: payment.id, line_id: line.id, amount_units: amount };
  }
  linkInvoice(input, allowEmpty = false) {
    const payment = this.exists(
      "planned_payments",
      integer(input.payment_id, "payment_id", 1),
    );
    const invoice = this.exists(
      "invoices",
      integer(input.invoice_id, "invoice_id", 1),
    );
    if (
      payment.status !== "active" ||
      invoice.status !== "active" ||
      payment.year !== invoice.year ||
      payment.month !== invoice.month
    )
      throw new ValidationError(
        "Aktif fatura ve ödeme aynı yıl ve ayda olmalıdır.",
      );
    const lines = this.all(
      "SELECT * FROM invoice_lines WHERE invoice_id=? AND category_id=? ORDER BY id",
      invoice.id,
      payment.category_id,
    );
    if (!lines.length)
      throw new ValidationError(
        "Faturada bu bütçe kalemine ait detay yok.",
        "invoice_id",
      );
    // Replace this payment/invoice association atomically. Other invoice links stay intact.
    this.run(
      "DELETE FROM planned_payment_invoice_links WHERE payment_id=? AND line_id IN (SELECT id FROM invoice_lines WHERE invoice_id=?)",
      payment.id,
      invoice.id,
    );
    const other = this.all(
      "SELECT l.amount_units FROM planned_payment_invoice_links l JOIN invoice_lines il ON il.id=l.line_id JOIN invoices i ON i.id=il.invoice_id WHERE l.payment_id=? AND i.status='active'",
      payment.id,
    );
    let remaining =
      BigInt(payment.amount_units) -
      BigInt(payment.saving_units) -
      BigInt(sum(other.map((l) => l.amount_units)));
    let matched = 0n;
    for (const line of lines) {
      const used = this.all(
        "SELECT l.amount_units FROM planned_payment_invoice_links l JOIN planned_payments p ON p.id=l.payment_id WHERE l.line_id=? AND p.status='active'",
        line.id,
      );
      const available =
        BigInt(line.amount_units) -
        BigInt(sum(used.map((l) => l.amount_units)));
      const amount = remaining < available ? remaining : available;
      if (amount <= 0n) continue;
      this.run(
        "INSERT INTO planned_payment_invoice_links(payment_id,line_id,amount_units) VALUES (?,?,?)",
        payment.id,
        line.id,
        amount,
      );
      remaining -= amount;
      matched += amount;
    }
    if (matched === 0n && !allowEmpty)
      throw new ValidationError(
        "Bu fatura için eşleştirilebilir bakiye yok.",
        "invoice_id",
      );
    return {
      payment_id: payment.id,
      invoice_id: invoice.id,
      amount_units: matched.toString(),
    };
  }
  linkInvoices(input) {
    if (!Array.isArray(input.invoice_ids) || !input.invoice_ids.length)
      throw new ValidationError("En az bir fatura seçin.", "invoice_ids");
    const ids = [
      ...new Set(input.invoice_ids.map((id) => integer(id, "invoice_ids", 1))),
    ];
    // The API mutation wraps the whole batch in a transaction, including replacements.
    const matches = ids.map((invoice_id) =>
      this.linkInvoice(
        {
          payment_id: input.payment_id,
          invoice_id,
        },
        true,
      ),
    );
    if (matches.every((m) => m.amount_units === "0"))
      throw new ValidationError(
        "Seçilen faturalar için eşleştirilebilir bakiye yok.",
        "invoice_ids",
      );
    return { payment_id: matches[0].payment_id, matches };
  }
  saveSaving(input, id) {
    const version = integer(input.version_id, "version_id", 1);
    this.exists("budget_versions", version);
    const title = required(input.title, "title"),
      amount = parseAmount(input.amount, "amount");
    if (id) {
      this.exists("savings_items", id);
      this.run(
        "UPDATE savings_items SET title=?,amount_units=? WHERE id=?",
        title,
        BigInt(amount),
        id,
      );
    } else
      id = Number(
        this.run(
          "INSERT INTO savings_items(version_id,title,amount_units) VALUES (?,?,?)",
          version,
          title,
          BigInt(amount),
        ).lastInsertRowid,
      );
    return this.exists("savings_items", id);
  }
  snapshot(year, versionId) {
    const years = this.all("SELECT * FROM budget_years WHERE year>=2027 ORDER BY year DESC"),
      categories = this.all(
        "SELECT * FROM budget_categories ORDER BY sort_order,id",
      );
    const versions = this.all(
      "SELECT * FROM budget_versions WHERE year=? ORDER BY id",
      year,
    ).map((v) => ({
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
    const invoices = this.all(
      "SELECT * FROM invoices WHERE year=? ORDER BY id DESC",
      year,
    ).map((i) => ({
      ...i,
      lines: this.all("SELECT * FROM invoice_lines WHERE invoice_id=?", i.id),
    }));
    const links = this.all(
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
    const payments = this.all(
      "SELECT * FROM planned_payments WHERE year=? ORDER BY id DESC",
      year,
    ).map((p) => {
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
      ? this.all("SELECT * FROM budget_lines WHERE version_id=?", version.id)
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
        this.all(
          "SELECT amount_units FROM budget_lines WHERE version_id=?",
          v.id,
        ).map((l) => l.amount_units),
      ),
    }));
    return {
      revision: this.revision(),
      demo:
        this.get("SELECT value FROM meta WHERE key='demo'").value === "true",
      tax_basis: "excluded",
      years,
      year,
      versions: versionTotals,
      version,
      categories,
      training_topics: this.all(
        "SELECT * FROM training_topics ORDER BY name_key,id",
      ),
      rows,
      invoices,
      payments,
      links,
      savings: version
        ? this.all("SELECT * FROM savings_items WHERE version_id=?", version.id)
        : [],
    };
  }
  seedDemo() {
    this.run("UPDATE meta SET value='true' WHERE key='demo'");
    CATEGORIES.forEach((name, i) =>
      this.run(
        "INSERT INTO budget_categories(name,name_key,sort_order) VALUES (?,?,?)",
        name,
        normalizeName(name),
        i,
      ),
    );
    const { id: v1 } = this.createYear({ year: 2026, reference: "2400000" });
    for (let c = 1; c <= 11; c++)
      for (let m = 1; m <= 12; m++)
        this.run(
          "INSERT INTO budget_lines(version_id,category_id,month,amount_units) VALUES (?,?,?,?)",
          v1,
          c,
          m,
          BigInt(
            [2, 10].includes(c)
              ? 0
              : (c === 5 ? 36000 : 11000 + c * 700) + (m % 3) * 1000,
          ) * 1000000n,
        );
    const v2 = this.createVersion({
      year: 2026,
      name: "V2",
      description: "Örnek tasarruf revizyonu",
      source_id: v1,
    });
    this.run(
      "UPDATE budget_lines SET amount_units=amount_units-3000000000 WHERE version_id=? AND category_id=5",
      v2.id,
    );
    this.activateVersion(v2.id);
    this.saveSaving({
      version_id: v2.id,
      title: "Örnek: teknik eğitimlerin toplu satın alımı",
      amount: "36000",
    });
    const training = [
      "Liderlik Atölyesi",
      "Agile Takım Çalışması",
      "İleri Excel Eğitimi",
      "Teknik Yetkinlik Programı",
      "İş Güvenliği Farkındalığı",
      "Online Öğrenme Paketi",
    ];
    [1, 1, 4, 5, 8, 6].forEach((c, i) =>
      this.saveInvoice({
        number: `000${i + 1}-DEMO`,
        year: 2026,
        month: i + 1,
        note: "Kurgusal örnek kayıt",
        lines: [
          {
            category_id: c,
            training_name: training[i],
            amount: String(17000 + i * 4500),
            participant_count: "20",
            rd_participant_count: "12",
            other_participant_count: "8",
            description: "Örnek eğitim kaydı",
          },
        ],
      }),
    );
    this.savePayment({
      category_id: 5,
      year: 2026,
      month: 4,
      description: "Örnek teknik eğitim planı",
      amount: "40000",
    });
    this.linkPayment({ payment_id: 1, line_id: 4, amount: "20000" });
    this.savePayment({
      category_id: 4,
      year: 2026,
      month: 11,
      description: "İletişim ve geri bildirim atölyesi",
      amount: "25000",
    });
  }
  close() {
    this.db.close();
  }
}
