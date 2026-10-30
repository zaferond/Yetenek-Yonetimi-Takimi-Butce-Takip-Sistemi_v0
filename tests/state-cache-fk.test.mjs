import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../backend/store.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { createApp } from "../backend/app.mjs";

async function setup() {
  const s = new Store(":memory:");
  s.seedDemo();
  s.run(
    "INSERT INTO users(id,username,password_hash,role,created_at) VALUES (1,'yonetici',?,'admin','now')",
    await hashPassword("yonetici-parola-123"),
  );
  const origin = "http://localhost:3199",
    app = await createApp(s, { origin }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie = "",
    csrf = "";
  const request = (path, method = "GET", body, headers = {}) =>
    fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
        "X-CSRF-Token": csrf,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const r = await request("/auth/login", "POST", {
    username: "yonetici",
    password: "yonetici-parola-123",
  });
  cookie = r.headers.get("set-cookie").split(";")[0];
  csrf = (await r.json()).csrf;
  return {
    s,
    request,
    close: async () => {
      await new Promise((r) => server.close(r));
      s.close();
    },
  };
}

test("/api/state ETag ve If-None-Match ile 304 döner, gövde biçimi değişmez", async () => {
  const { s, request, close } = await setup();
  try {
    const first = await request("/state?year=2027");
    assert.equal(first.status, 200);
    const etag = first.headers.get("etag");
    assert.ok(etag && etag.includes(`-${s.revision()}-2027-`));
    assert.match(etag, /-admin"$/);
    assert.equal(first.headers.get("cache-control"), "no-cache, private");
    const body = await first.json();
    assert.deepEqual(body, JSON.parse(JSON.stringify(s.snapshot(2027))));

    const again = await request("/state?year=2027", "GET", undefined, {
      "If-None-Match": etag,
    });
    assert.equal(again.status, 304);
    assert.equal(again.headers.get("etag"), etag);
    assert.equal(await again.text(), "");

    // Önbellekten gelen ikinci tam yanıt aynı.
    assert.deepEqual(await (await request("/state?year=2027")).json(), body);

    // Farklı yıl/sürüm farklı ETag üretir.
    const other = await request("/state?year=2028", "GET", undefined, {
      "If-None-Match": etag,
    });
    assert.notEqual(other.headers.get("etag"), etag);

    // Revision değişince eski ETag geçersizleşir.
    s.run(
      "UPDATE meta SET value=? WHERE key='revision'",
      String(s.revision() + 1),
    );
    const changed = await request("/state?year=2027", "GET", undefined, {
      "If-None-Match": etag,
    });
    assert.equal(changed.status, 200);
    assert.notEqual(changed.headers.get("etag"), etag);
  } finally {
    await close();
  }
});

test("açılışta foreign_key_check ihlali uyarı yazar, uygulamayı durdurmaz", () => {
  const clean = new Store(":memory:");
  assert.deepEqual(clean.checkForeignKeys(), []);
  assert.deepEqual(clean.foreignKeyProblems, []);
  clean.db.exec("PRAGMA foreign_keys = OFF");
  clean.run(
    "INSERT INTO planned_payment_invoice_links(payment_id,line_id,amount_units) VALUES (99999,99999,1)",
  );
  const warnings = [];
  const original = console.warn;
  console.warn = (...a) => warnings.push(a.join(" "));
  try {
    const problems = clean.checkForeignKeys();
    assert.ok(problems.length >= 1);
    assert.equal(problems[0].table, "planned_payment_invoice_links");
    assert.ok(warnings.some((w) => w.includes("yabancı anahtar ihlali")));
  } finally {
    console.warn = original;
    clean.close();
  }
});
