import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../backend/store.mjs";
import { hashPassword, verifyPassword } from "../backend/auth.mjs";
import { createApp } from "../backend/app.mjs";

async function setup(options = {}) {
  const s = new Store(":memory:");
  s.seedDemo();
  s.run(
    "INSERT INTO users(id,username,password_hash,role,created_at) VALUES (1,'yonetici',?,'admin','now')",
    await hashPassword("yonetici-parola-123"),
  );
  const origin = "http://localhost:3199",
    app = await createApp(s, { origin, ...options }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const client = { cookie: "", csrf: "" };
  client.request = (path, method = "GET", body, headers = {}) =>
    fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: client.cookie,
        "X-CSRF-Token": client.csrf,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  client.login = async (username, password) => {
    const r = await client.request("/auth/login", "POST", {
      username,
      password,
    });
    if (r.status === 200) {
      client.cookie = r.headers.get("set-cookie").split(";")[0];
      client.csrf = (await r.json()).csrf;
    }
    return r;
  };
  const close = async () => {
    await new Promise((r) => server.close(r));
    s.close();
  };
  return { s, client, close, base };
}

test("verifyPassword bozuk hash'te hata fırlatmadan false döner", async () => {
  for (const bad of ["", "salt:", "salt:abc", ":", "yalniz-tuz", null])
    assert.equal(await verifyPassword("parola", bad), false);
  const good = await hashPassword("dogru-parola-123");
  assert.equal(await verifyPassword("dogru-parola-123", good), true);
  assert.equal(await verifyPassword("yanlis", good), false);
});

test("bozuk parola hash'li kullanıcı girişi 500 değil 401 döner", async () => {
  const { s, client, close } = await setup();
  try {
    s.run("UPDATE users SET password_hash='kirik:' WHERE id=1");
    assert.equal(
      (await client.login("yonetici", "yonetici-parola-123")).status,
      401,
    );
  } finally {
    await close();
  }
});

test("giriş, başarısız giriş ve çıkış audit'e yazılır; parola loglanmaz", async () => {
  const { s, client, close } = await setup();
  try {
    assert.equal(
      (await client.login("yonetici", "yanlis-parola-xyz")).status,
      401,
    );
    assert.equal(
      (await client.login("olmayan", "gizli-parola-xyz")).status,
      401,
    );
    assert.equal(
      (await client.login("yonetici", "yonetici-parola-123")).status,
      200,
    );
    assert.equal(
      (await client.request("/auth/logout", "POST", {})).status,
      200,
    );
    const rows = s.all(
      "SELECT action FROM audit_logs WHERE entity='sessions' ORDER BY id",
    );
    assert.deepEqual(
      rows.map((r) => r.action),
      ["Başarısız giriş", "Giriş yapıldı", "Çıkış yapıldı"],
    );
    const dump = JSON.stringify(s.all("SELECT * FROM audit_logs"));
    for (const secret of [
      "yanlis-parola-xyz",
      "gizli-parola-xyz",
      "yonetici-parola-123",
    ])
      assert.ok(!dump.includes(secret));
  } finally {
    await close();
  }
});

test("audit listesi limit ve before ile sayfalanır, varsayılan 200", async () => {
  const { s, client, close } = await setup();
  try {
    for (let i = 0; i < 250; i++)
      s.run(
        "INSERT INTO audit_logs(user_id,action,entity,created_at) VALUES (1,'deneme','x','now')",
      );
    await client.login("yonetici", "yonetici-parola-123");
    const all = await (await client.request("/audit")).json();
    assert.equal(all.length, 200);
    const page = await (await client.request("/audit?limit=10")).json();
    assert.equal(page.length, 10);
    const next = await (
      await client.request(`/audit?limit=10&before=${page.at(-1).id}`)
    ).json();
    assert.equal(next[0].id, page.at(-1).id - 1);
    assert.equal((await client.request("/audit?limit=0")).status, 400);
    assert.equal((await client.request("/audit?limit=5000")).status, 400);
    assert.equal((await client.request("/audit?before=abc")).status, 400);
  } finally {
    await close();
  }
});

test("state ucu geçersiz version parametresini 400 ile reddeder", async () => {
  const { client, close } = await setup();
  try {
    await client.login("yonetici", "yonetici-parola-123");
    for (const v of ["abc", "0", "-1", "1.5"])
      assert.equal(
        (await client.request(`/state?year=2027&version=${v}`)).status,
        400,
      );
    assert.equal((await client.request("/state?year=2027")).status, 200);
  } finally {
    await close();
  }
});

test("CSP ws: yalnız geliştirme modunda izinlidir", async () => {
  for (const dev of [false, true]) {
    const { base, close } = await setup({ dev });
    try {
      const csp = (await fetch(base + "/state")).headers.get(
        "content-security-policy",
      );
      assert.equal(/connect-src 'self' ws:/.test(csp), dev);
    } finally {
      await close();
    }
  }
});

test("trust proxy ayarı X-Forwarded-For ile istemci IP'sini ayırır", async () => {
  const { client, close } = await setup({ trustProxy: "loopback" });
  try {
    for (let i = 0; i < 10; i++)
      await client.request(
        "/auth/login",
        "POST",
        { username: `u${i}`, password: "x" },
        { "X-Forwarded-For": "10.0.0.1" },
      );
    assert.equal(
      (
        await client.request(
          "/auth/login",
          "POST",
          { username: "u99", password: "x" },
          { "X-Forwarded-For": "10.0.0.1" },
        )
      ).status,
      429,
    );
    // Farklı istemci IP'si kilitlenmez.
    assert.equal(
      (
        await client.request(
          "/auth/login",
          "POST",
          { username: "u99", password: "x" },
          { "X-Forwarded-For": "10.0.0.2" },
        )
      ).status,
      401,
    );
  } finally {
    await close();
  }
});

test("trust proxy kapalıyken X-Forwarded-For dikkate alınmaz", async () => {
  const { client, close } = await setup();
  try {
    for (let i = 0; i < 10; i++)
      await client.request(
        "/auth/login",
        "POST",
        { username: `u${i}`, password: "x" },
        { "X-Forwarded-For": `10.0.0.${i}` },
      );
    assert.equal(
      (
        await client.request("/auth/login", "POST", {
          username: "z",
          password: "x",
        })
      ).status,
      429,
    );
  } finally {
    await close();
  }
});

test("giriş sayaç tablosu üst sınırı aşınca en eski kaydı atar", async () => {
  const { client, close } = await setup({
    trustProxy: "loopback",
    maxLoginKeys: 3,
  });
  const attempt = (ip, username = "") =>
    client
      .request(
        "/auth/login",
        "POST",
        { username, password: "x" },
        { "X-Forwarded-For": ip },
      )
      .then((r) => r.status);
  try {
    for (let i = 0; i < 10; i++) await attempt("10.0.0.1");
    assert.equal(await attempt("10.0.0.1"), 429);
    for (let i = 2; i <= 5; i++) await attempt(`10.0.0.${i}`);
    assert.equal(await attempt("10.0.0.1"), 401);
  } finally {
    await close();
  }
});
