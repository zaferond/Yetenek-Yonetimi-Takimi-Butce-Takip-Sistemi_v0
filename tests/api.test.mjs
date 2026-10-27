import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../backend/store.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { createApp } from "../backend/app.mjs";
test("API oturum, CSRF, login sınırı, atomik kayıt ve çıkış", async () => {
  const s = new Store(":memory:");
  s.seedDemo();
  s.run(
    "INSERT INTO users(id,username,password_hash,created_at) VALUES (1,?,?,?)",
    "test",
    await hashPassword("test-password-123"),
    "now",
  );
  s.run("UPDATE users SET role='admin' WHERE id=1");
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
  try {
    assert.equal((await request("/state?year=2026")).status, 401);
    assert.equal(
      (
        await request(
          "/auth/login",
          "POST",
          { username: "test", password: "bad" },
          { Origin: "https://elsewhere.invalid" },
        )
      ).status,
      403,
    );
    const login = await request("/auth/login", "POST", {
      username: "test",
      password: "test-password-123",
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /SameSite=Strict/);
    csrf = (await login.json()).csrf;
    let state = await (await request("/state?year=2026")).json();
    assert.equal(state.rows.length, 11);
    const body = {
      revision: state.revision,
      version_id: state.version.id,
      cells: [{ category_id: 1, month: 1, amount: "100000" }],
    };
    assert.equal(
      (await request("/plan", "PUT", body, { "X-CSRF-Token": "bad" })).status,
      403,
    );
    assert.equal((await request("/plan", "PUT", body)).status, 200);
    assert.equal((await request("/plan", "PUT", body)).status, 409);
    state = await (await request("/state?year=2026")).json();
    assert.equal(state.rows[0].months[0].plan, "100000000000");
    assert.equal(
      (
        await request("/invoices", "POST", {
          revision: state.revision,
          number: "0003",
          year: 2026,
          month: 13,
          lines: [],
        })
      ).status,
      400,
    );
    const logs = await (await request("/audit")).json();
    assert.equal(logs.length, 1);
    assert.equal(logs[0].username, "test");
    assert.equal((await request("/auth/logout", "POST", {})).status, 200);
    assert.equal((await request("/state?year=2026")).status, 401);
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await request("/auth/login", "POST", {
            username: "test",
            password: "bad",
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await request("/auth/login", "POST", {
          username: "test",
          password: "bad",
        })
      ).status,
      429,
    );
  } finally {
    await new Promise((r) => server.close(r));
    s.close();
  }
});
