import { Store } from "./store.mjs";
import { createApp } from "./app.mjs";
import express from "express";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3100),
  origin = process.env.APP_ORIGIN || `http://${host}:${port}`;
if (
  process.env.NODE_ENV === "production" &&
  (process.env.COOKIE_SECURE !== "true" || !origin.startsWith("https://"))
)
  throw new Error(
    "Üretimde HTTPS APP_ORIGIN ve COOKIE_SECURE=true gereklidir.",
  );
const store = new Store();
if (!store.get("SELECT id FROM users LIMIT 1")) {
  console.error("Önce npm run setup komutunu çalıştırın.");
  process.exit(1);
}
const app = await createApp(store, {
  origin,
  secure: process.env.COOKIE_SECURE === "true",
});
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    configFile: "frontend/vite.config.ts",
    server: { middlewareMode: true },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.get("/{*path}", async (req, res, next) => {
    try {
      res
        .type("html")
        .send(
          await vite.transformIndexHtml(
            req.originalUrl,
            readFileSync("frontend/index.html", "utf8"),
          ),
        );
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
} else {
  if (!existsSync("dist/index.html")) {
    console.error("Önce npm run build komutunu çalıştırın.");
    process.exit(1);
  }
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
}
const server = app.listen(port, host, () =>
  console.log(`Yetenek Yönetimi Bütçe Takip Sistemi: ${origin}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
