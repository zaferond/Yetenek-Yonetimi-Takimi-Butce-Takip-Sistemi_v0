import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Store } from "../backend/store.mjs";
import { createApp } from "../backend/app.mjs";
import { hashPassword } from "../backend/auth.mjs";

const units = (tl) => (BigInt(tl) * 1000000n).toString();
function setup(path = ":memory:") {
  const s = new Store(path);
  s.seedDemo();
  s.run(
    "INSERT INTO users(id,username,password_hash,created_at,role) VALUES (1,'test','hash','now','editor')",
  );
  return s;
}
const write = (s, id, fn) =>
  s.mutate(1, s.revision(), "Versiyon güncellendi", "budget_versions", id, fn)
    .result;
const fields = {
  name: "Güncel plan",
  description: "Revizyon açıklaması",
  budget_changed: true,
  budget: "2100000",
};

test("Yeni yılın bütçesi boş aylık plana rağmen tüm versiyonlara otomatik yansır", () => {
  const s = setup();
  try {
    const first = s.createYear({ year: 2028, reference: "1000000,123456" });
    let state = s.snapshot(2028, first.id);
    assert.equal(state.version.effective_budget_units, "1000000123456");
    assert.equal(state.versions[0].total_units, "0");
    const second = s.createVersion({
      year: 2028,
      name: "V2",
      description: "Değişiklik yok",
      source_id: first.id,
      budget_changed: false,
    });
    assert.equal(
      s.snapshot(2028, second.id).version.effective_budget_units,
      "1000000123456",
    );
    s.updateReference({
      year: 2028,
      version_id: second.id,
      reference: "2000000",
    });
    assert.equal(
      s.snapshot(2028, first.id).version.effective_budget_units,
      units(2000000),
    );
    assert.equal(
      s.snapshot(2028, second.id).version.effective_budget_units,
      units(2000000),
    );
    assert.ok(s.snapshot(2028).rows.every((r) => r.plan === "0"));
  } finally {
    s.close();
  }
});

test("Güncel bütçe ve versiyon düzenleme aylık dağılımı, faturaları, tasarrufları ve aktifliği korur", () => {
  const s = setup();
  try {
    const source = s.snapshot(2027).version;
    const version = write(s, null, () =>
      s.createVersion({ ...fields, year: 2027, source_id: source.id }),
    );
    s.activateVersion(version.id);
    s.saveSaving({
      version_id: version.id,
      title: "İndirim",
      amount: "100000",
    });
    const lines = s.all(
      "SELECT category_id,month,amount_units FROM budget_lines WHERE version_id=? ORDER BY category_id,month",
      version.id,
    );
    const invoices = s.snapshot(2027).invoices;
    write(s, version.id, () =>
      s.updateVersion(
        {
          ...fields,
          name: "Güncellenen plan",
          description: "Yeni açıklama",
          budget: "1950000,000001",
        },
        version.id,
      ),
    );
    let state = s.snapshot(2027, version.id);
    assert.equal(state.version.effective_budget_units, "1950000000001");
    assert.equal(state.version.name, "Güncellenen plan");
    assert.equal(state.version.description, "Yeni açıklama");
    assert.equal(state.version.active, 1);
    assert.equal(state.savings[0].amount_units, units(100000));
    assert.deepEqual(state.invoices, invoices);
    assert.deepEqual(
      s.all(
        "SELECT category_id,month,amount_units FROM budget_lines WHERE version_id=? ORDER BY category_id,month",
        version.id,
      ),
      lines,
    );
    assert.equal(
      s.snapshot(2027, source.id).version.effective_budget_units,
      units(2400000),
    );
    assert.equal(
      state.years.find((y) => y.year === 2027).reference_units,
      units(2400000),
    );
    // The budget card updates the selected revision while preserving earlier revisions.
    s.updateReference({
      year: 2027,
      version_id: version.id,
      reference: "1800000",
    });
    assert.equal(
      s.snapshot(2027, version.id).version.effective_budget_units,
      units(1800000),
    );
    assert.equal(
      s.snapshot(2027, source.id).version.effective_budget_units,
      units(2400000),
    );
    // Copying without a budget change inherits a revised annual budget as well as its monthly plan.
    const copy = s.createVersion({
      year: 2027,
      name: "Devam",
      description: "Aynı bütçe",
      source_id: version.id,
      budget_changed: false,
    });
    s.updateVersion(
      {
        name: "Devam düzenlendi",
        description: "Başlık güncellendi",
        budget_changed: false,
      },
      copy.id,
    );
    assert.equal(
      s.snapshot(2027, copy.id).version.effective_budget_units,
      units(1800000),
    );
    // Explicitly reverting a changed budget uses the year's budget again.
    s.updateVersion(
      {
        name: "Güncellenen plan",
        description: "Yıl bütçesine dön",
        budget_changed: false,
      },
      version.id,
    );
    assert.equal(
      s.snapshot(2027, version.id).version.effective_budget_units,
      units(2400000),
    );
  } finally {
    s.close();
  }
});

test("Eksik/yanlış bütçe ve aynı isimli versiyon güncellemeleri atomik reddedilir", () => {
  const s = setup();
  try {
    const version = s.snapshot(2027).version,
      before = JSON.stringify(s.snapshot(2027)),
      revision = s.revision();
    for (const budget of [undefined, "", "-1", "1.25", "1,0000001"])
      assert.throws(() =>
        write(s, version.id, () =>
          s.updateVersion({ ...fields, budget }, version.id),
        ),
      );
    assert.throws(
      () =>
        write(s, version.id, () =>
          s.updateVersion({ ...fields, name: "V1" }, version.id),
        ),
      /aynı isimli/,
    );
    assert.throws(
      () =>
        write(s, version.id, () =>
          s.updateVersion({ ...fields, budget_changed: "true" }, version.id),
        ),
      /var\/yok/,
    );
    assert.throws(() =>
      write(s, null, () =>
        s.createVersion({ ...fields, year: 2027, budget: "" }),
      ),
    );
    assert.equal(s.revision(), revision);
    assert.equal(JSON.stringify(s.snapshot(2027)), before);
    write(s, version.id, () =>
      s.updateVersion({ ...fields, budget: "0" }, version.id),
    );
    assert.equal(
      s.snapshot(2027, version.id).version.effective_budget_units,
      "0",
    );
  } finally {
    s.close();
  }
});

test("Eski versiyon kayıtları bütçe alanına kayıpsız taşınır; güncel bütçe kalıcı saklanır", () => {
  const dir = mkdtempSync(join(tmpdir(), "version-budget-migration-")),
    path = join(dir, "test.sqlite");
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(
      readFileSync(
        new URL("../backend/schema.sql", import.meta.url),
        "utf8",
      ).replace(", budget_units INTEGER CHECK(budget_units>=0)", ""),
    );
    legacy.exec(
      "INSERT INTO budget_years(year,reference_units) VALUES (2027,1000000000000); INSERT INTO budget_versions(id,year,name,description,active,created_at) VALUES (1,2027,'V1','Eski versiyon',1,'now')",
    );
    legacy.close();
    let s = new Store(path);
    assert.equal(
      s.snapshot(2027).version.effective_budget_units,
      units(1000000),
    );
    s.updateVersion({ ...fields, budget: "900000,000001" }, 1);
    s.close();
    s = new Store(path);
    assert.equal(
      s.snapshot(2027).version.effective_budget_units,
      "900000000001",
    );
    assert.equal(s.snapshot(2027).version.name, fields.name);
    assert.equal(s.snapshot(2027).version.active, 1);
    s.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Versiyon API düzenleme yetkileri, revizyon çakışması ve işlem geçmişi", async () => {
  const s = setup(),
    password = "version-test-password",
    hash = await hashPassword(password);
  s.run("UPDATE users SET password_hash=? WHERE id=1", hash);
  s.run(
    "INSERT INTO users(id,username,password_hash,created_at,role) VALUES (2,'viewer',?,'now','viewer')",
    hash,
  );
  const origin = "http://localhost:3199",
    server = (await createApp(s, { origin })).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const login = async (username) => {
    const response = await fetch(base + "/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const { csrf } = await response.json(),
      cookie = response.headers.get("set-cookie").split(";")[0];
    return (path, method, body) =>
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
  };
  try {
    const editor = await login("test"),
      viewer = await login("viewer"),
      version = s.snapshot(2027).version;
    const body = { ...fields, revision: s.revision() };
    assert.equal(
      (await viewer(`/versions/${version.id}`, "PUT", body)).status,
      403,
    );
    assert.equal(
      (await editor(`/versions/${version.id}`, "PUT", body)).status,
      200,
    );
    assert.equal(
      (await editor(`/versions/${version.id}`, "PUT", body)).status,
      409,
    );
    const state = await (
      await editor(`/state?year=2027&version=${version.id}`, "GET")
    ).json();
    assert.equal(
      state.versions.find((v) => v.id === version.id).effective_budget_units,
      units(2100000),
    );
    const audit = s.get(
      "SELECT * FROM audit_logs WHERE entity='budget_versions' AND entity_id=? ORDER BY id DESC LIMIT 1",
      version.id,
    );
    assert.equal(JSON.parse(audit.before_json).record.name, version.name);
    assert.equal(JSON.parse(audit.after_json).name, fields.name);
    assert.equal(JSON.parse(audit.after_json).budget_units, units(2100000));
  } finally {
    await new Promise((r) => server.close(r));
    s.close();
  }
});
