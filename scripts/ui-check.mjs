import ExcelJS from "exceljs";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import express from "express";
import { resolve } from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { Store } from "../backend/store.mjs";
import { createApp } from "../backend/app.mjs";
import { hashPassword } from "../backend/auth.mjs";
import { money } from "../shared/domain.mjs";
// Excel writes TL amounts as numbers rounded half-up to 2 decimals (same rule as
// money()); build the expected value from that text, never from float math.
const excelMoney = (units) =>
  Number(money(units).replaceAll(".", "").replace(",", ".").replace("−", "-"));
const db = new Store(":memory:");
db.seedDemo();
const password = randomBytes(16).toString("hex");
db.run(
  "INSERT INTO users(id,username,password_hash,created_at) VALUES (1,?,?,?)",
  "ui-test",
  await hashPassword(password),
  new Date().toISOString(),
);
db.run("UPDATE users SET role='admin' WHERE id=1");
const app = await createApp(db, { origin: "http://127.0.0.1:3198" });
app.use(express.static(resolve("dist")));
app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
const server = app.listen(3198, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
page.setDefaultTimeout(15000);
const errors = [];
const requests = [];
page.on("request", (request) => requests.push(request.url()));
page.on("pageerror", (e) => errors.push(e.message));
mkdirSync("test-results", { recursive: true });
async function screenshot(name) {
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: `test-results/${name}.png`,
    fullPage: !(await page.locator("dialog[open]").count()),
    style: ".toast { visibility: hidden; }",
  });
}
async function noOverflow() {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "Sayfa yatay taşmamalı",
  );
}
async function openSection(name) {
  const card = page
    .locator(".home-page")
    .getByRole("button", { name, exact: true });
  if (await card.isVisible()) await card.click();
  else {
    const nav = page.getByRole("navigation", {
      name: "Çalışma alanı bölümleri",
    });
    if (!(await nav.isVisible()))
      await page
        .getByRole("button", { name: "Menüyü aç", exact: true })
        .click();
    await nav.getByRole("button", { name, exact: true }).click();
  }
  await page.getByRole("heading", { name, exact: true, level: 1 }).waitFor();
}
// Use Chrome's actual page zoom in a disposable profile. CSS zoom does not
// change media queries and cannot stand in for browser zoom acceptance.
async function verifyBrowserZoom() {
  const profile = mkdtempSync(resolve(tmpdir(), "yetenek-ui-zoom-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
      headless: true,
      viewport: null,
      args: ["--window-size=1366,768"],
    });
    const zoomPage = context.pages()[0];
    const capture = async (name, fullPage = true) => {
      const cdp = await context.newCDPSession(zoomPage);
      try {
        // CDP's DIP content size includes browser zoom. Playwright's CSS-pixel
        // clip would otherwise crop these screenshots at 200%.
        const metrics = await cdp.send("Page.getLayoutMetrics");
        const options = fullPage
          ? {
              clip: { ...metrics.contentSize, scale: 1 },
              captureBeyondViewport: true,
            }
          : { captureBeyondViewport: false };
        const shot = await cdp.send("Page.captureScreenshot", {
          format: "png",
          ...options,
        });
        writeFileSync(
          `test-results/${name}.png`,
          Buffer.from(shot.data, "base64"),
        );
      } finally {
        await cdp.detach();
      }
    };

    await zoomPage.goto("chrome://settings/appearance");
    const zoomSelect = zoomPage.locator("#zoomLevel");
    await zoomSelect.waitFor();
    const doubleZoom = await zoomSelect.evaluate(
      (select) =>
        [...select.options].find(
          (option) => option.textContent.trim() === "200%",
        ).value,
    );
    await zoomSelect.selectOption(doubleZoom);
    await zoomPage.goto("http://127.0.0.1:3198");
    zoomPage.on("pageerror", (error) => errors.push(error.message));
    await zoomPage.getByLabel("Kullanıcı Adı", { exact: true }).fill("ui-test");
    await zoomPage.getByLabel("Parola", { exact: true }).fill(password);
    await zoomPage
      .getByRole("button", { name: "Giriş Yap", exact: true })
      .click();
    await zoomPage
      .getByRole("heading", { name: "Ana Sayfa", exact: true, level: 1 })
      .waitFor();
    const dimensions = await zoomPage.evaluate(() => ({
      inner: innerWidth,
      outer: outerWidth,
      ratio: devicePixelRatio,
    }));
    assert.ok(
      dimensions.inner < dimensions.outer * 0.6,
      "Gerçek tarayıcı yakınlaştırması etkin olmalı",
    );
    await zoomPage.evaluate(() => document.fonts.ready);
    assert.equal(
      await zoomPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await capture("home-zoom-200");
    await zoomPage
      .locator(".home-page")
      .getByRole("button", { name: "Bütçe Planlama & Takip", exact: true })
      .click();
    await zoomPage
      .getByRole("heading", {
        name: "Bütçe Planlama & Takip",
        exact: true,
        level: 1,
      })
      .waitFor();
    assert.equal(
      await zoomPage.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await capture("budget-zoom-200");
    await zoomPage
      .getByRole("button", { name: "Menüyü aç", exact: true })
      .click();
    await expect(
      zoomPage.getByRole("dialog", { name: "Çalışma alanı menüsü" }),
    ).toBeVisible();
    await zoomPage.keyboard.press("Escape");
    await zoomPage
      .getByRole("button", { name: "Menüyü aç", exact: true })
      .click();
    await zoomPage
      .getByRole("navigation")
      .getByRole("button", { name: "Faturalar", exact: true })
      .click();
    await zoomPage
      .getByRole("button", { name: "Yeni fatura", exact: true })
      .click();
    const modal = zoomPage.getByRole("dialog", {
      name: "Yeni fatura",
      exact: true,
    });
    await zoomPage.getByLabel("Fatura Numarası").fill("ZOOM-TEST");
    await zoomPage.getByLabel("Diğer Katılımcı Sayısı").fill("0");
    await expect
      .poll(() =>
        zoomPage.getByLabel("Diğer Katılımcı Sayısı").evaluate((input) => {
          const field = input.getBoundingClientRect(),
            body = input.closest(".dialog-body").getBoundingClientRect();
          return field.top >= body.top - 1 && field.bottom <= body.bottom + 1;
        }),
      )
      .toBe(true);

    assert.equal(
      await modal.evaluate((el) => el.scrollWidth > el.clientWidth),
      false,
    );
    await expect(
      zoomPage.getByRole("button", { name: "Faturayı kaydet", exact: true }),
    ).toBeVisible();
    await capture("invoice-zoom-200", false);
    // No data is submitted from the zoom scenario.
  } finally {
    await context?.close();
    rmSync(profile, { recursive: true, force: true });
  }
}
try {
  await page.goto("http://127.0.0.1:3198");
  await page.getByRole("heading", { name: "Oturum Aç", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await screenshot("login");
  for (const selector of [".auth-screen", ".auth-brand", ".auth-panel"]) {
    assert.equal(
      await page
        .locator(selector)
        .evaluate((el) => getComputedStyle(el).backgroundImage),
      "none",
    );
  }
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 390, height: 550 },
  ]) {
    await page.setViewportSize(viewport);
    await noOverflow();
    await screenshot(`login-${viewport.width}-${viewport.height}`);
    await expect(
      page.getByRole("button", { name: "Giriş Yap", exact: true }),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.getByLabel("Kullanıcı Adı", { exact: true }).fill("ui-test");
  await page.getByLabel("Parola", { exact: true }).fill("incorrect-password");
  await page
    .getByRole("button", { name: "Parolayı göster", exact: true })
    .click();
  await expect(page.getByLabel("Parola", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Parolayı gizle", exact: true })
    .click();
  await page.getByRole("button", { name: "Giriş Yap", exact: true }).click();
  await expect(page.locator(".auth-error")).toBeVisible();
  await page.getByLabel("Parola", { exact: true }).fill(password);
  await page.getByLabel("Parola", { exact: true }).press("Enter");
  await page
    .getByRole("heading", { name: "Ana Sayfa", exact: true, level: 1 })
    .waitFor();
  await expect(page.locator(".home-card")).toHaveCount(4);
  await screenshot("home");
  await page.locator(".home-card").first().focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("heading", {
      name: "Bütçe Planlama & Takip",
      exact: true,
      level: 1,
    })
    .waitFor();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Bütçe Planlama & Takip", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await screenshot("budget");
  await expect(page.getByRole("navigation")).toBeVisible();
  // Every card works; context and each section's own search survive navigation.
  const initialVersion = await page
    .getByLabel("Plan versiyonu", { exact: true })
    .inputValue();
  await page.getByLabel("Dönem filtresi").selectOption("2");
  await page.getByLabel("Bütçe kalemi filtresi").selectOption("1");
  await page.getByLabel("Kayıtlarda ara").fill("LEAD");
  await page
    .getByRole("button", { name: "Otokar · Ana sayfaya dön", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ana Sayfa", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByLabel("Dönem filtresi")).toHaveCount(0);
  for (const name of ["Faturalar", "Planlı Ödemeler", "Versiyon & Tasarruf"]) {
    await openSection(name);
    await expect(
      page.getByLabel("Plan versiyonu", { exact: true }),
    ).toHaveValue(initialVersion);
    if (name !== "Versiyon & Tasarruf")
      await expect(page.getByLabel("Kayıtlarda ara")).toHaveValue("");
    await openSection("Ana Sayfa");
  }
  await openSection("Bütçe Planlama & Takip");
  await expect(page.getByLabel("Dönem filtresi")).toHaveValue("2");
  await expect(page.getByLabel("Bütçe kalemi filtresi")).toHaveValue("1");
  await expect(page.getByLabel("Kayıtlarda ara")).toHaveValue("LEAD");
  await expect(page.locator(".budget-table thead th")).toHaveCount(19);
  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await page.getByRole("button", { name: "Menüyü kapat", exact: true }).click();
  await screenshot("budget-menu-closed");
  await page.getByRole("button", { name: "Menüyü aç", exact: true }).click();
  const cell = page.getByRole("textbox", {
    name: "LEAD Liderlik & Agile Eğitimler Ocak planı",
    exact: true,
  });
  await cell.fill("100.000,123456");
  await expect(
    page.getByRole("button", { name: "Excel'e aktar", exact: true }),
  ).toBeDisabled();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Otokar · Ana sayfaya dön", exact: true })
    .click();
  await expect(cell).toHaveValue("100.000,123456");
  await expect(
    page.getByRole("heading", {
      name: "Bütçe Planlama & Takip",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Bütçeyi kaydet", exact: true })
    .click();
  await page.getByText("Değişiklikler kaydedildi.").waitFor();
  await page.reload();
  await openSection("Bütçe Planlama & Takip");
  await cell.waitFor();
  // Unfocused plan cells show the Turkish display format without rounding;
  // focusing switches to the editable form.
  assert.equal(await cell.inputValue(), "100.000,123456");
  await cell.focus();
  assert.equal(await cell.inputValue(), "100000,123456");
  await cell.blur();
  assert.equal(await cell.inputValue(), "100.000,123456");
  await expect(
    page.getByRole("button", { name: "Bütçeyi kaydet", exact: true }),
  ).toHaveCount(0);
  await openSection("Faturalar");
  await page.getByRole("button", { name: "Yeni fatura", exact: true }).click();
  assert.equal(
    await page.locator("dialog form").evaluate((form) => form.checkValidity()),
    false,
  );
  await page.getByLabel("Fatura Numarası").fill("000099");
  await page.getByLabel("Fatura Ayı").selectOption("1");
  await page
    .getByLabel("Eğitim Adı", { exact: false })
    .fill("UI Kabul Eğitimi");
  await page.getByLabel("Eğitim Bedeli TL").fill("30000");
  await page.getByLabel(/^Katılımcı Sayısı/).fill("0");
  await page.getByLabel("Ar-Ge Katılımcı Sayısı").fill("0");
  await page.getByLabel("Diğer Katılımcı Sayısı").fill("0");
  await page.getByLabel("Eğitim Bedeli TL").fill("1.25");
  await page
    .getByRole("button", { name: "Faturayı kaydet", exact: true })
    .click();
  await page.locator("dialog .error-box").waitFor();
  assert.equal(
    await page.getByLabel("Eğitim Adı").inputValue(),
    "UI Kabul Eğitimi",
  );
  await page.getByLabel("Eğitim Bedeli TL").fill("30000");
  db.run("UPDATE sessions SET expires_at=0");
  await page
    .getByRole("button", { name: "Faturayı kaydet", exact: true })
    .click();
  const reauth = page.getByRole("dialog", {
    name: "Oturum yenileme",
    exact: true,
  });
  await reauth.waitFor();
  await screenshot("reauth");
  assert.equal(
    await reauth
      .locator(".auth-screen")
      .evaluate((el) => getComputedStyle(el).backgroundImage),
    "none",
  );
  await reauth.getByLabel("Kullanıcı Adı", { exact: true }).fill("ui-test");
  await reauth.getByLabel("Parola", { exact: true }).fill(password);
  await reauth.getByRole("button", { name: "Giriş Yap", exact: true }).click();
  await reauth.waitFor({ state: "hidden" });
  assert.equal(
    await page.getByLabel("Eğitim Adı").inputValue(),
    "UI Kabul Eğitimi",
  );
  await screenshot("invoice-form");
  // Form state survives mobile layout changes and cancelled close attempts.
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  const invoiceDialog = page.getByRole("dialog", {
    name: "Yeni fatura",
    exact: true,
  });
  assert.equal(
    await invoiceDialog.evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
  );
  await screenshot("mobile-invoice-form");
  page.once("dialog", (dialog) => dialog.dismiss());
  await invoiceDialog
    .getByRole("button", { name: "Pencereyi kapat", exact: true })
    .click();
  await expect(page.getByLabel("Eğitim Adı")).toHaveValue("UI Kabul Eğitimi");
  await page.setViewportSize({ width: 1512, height: 982 });
  await page
    .getByRole("button", { name: "Eğitim kalemi ekle", exact: true })
    .click();
  const secondLine = page.locator(".line-editor").nth(1);
  await secondLine.getByLabel("Eğitim Adı").fill("UI İkinci Eğitim");
  await secondLine.getByLabel("Eğitim Bedeli TL").fill("5000");
  await secondLine.getByLabel(/^Katılımcı Sayısı/).fill("2");
  await secondLine.getByLabel("Ar-Ge Katılımcı Sayısı").fill("1");
  await secondLine.getByLabel("Diğer Katılımcı Sayısı").fill("1");
  await secondLine.getByText("Döviz bilgileri", { exact: false }).click();
  await secondLine.getByLabel("Eğitim Bedeli (Diğer)").fill("100");
  await secondLine.getByLabel("Para Birimi").selectOption("EUR");
  await secondLine.getByLabel("Kur · 1 döviz = X TL").fill("50");
  await secondLine.getByRole("button", { name: "TL alanına uygula" }).click();
  await expect(secondLine.getByLabel("Eğitim Bedeli TL")).toHaveValue("5000");
  await page
    .getByRole("button", { name: "Faturayı kaydet", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await openSection("Bütçe Planlama & Takip");
  await page
    .getByRole("button", {
      name: "LEAD Liderlik & Agile Eğitimler detayları",
      exact: true,
    })
    .click();
  await page.getByText("UI Kabul Eğitimi", { exact: true }).waitFor();
  assert.equal(
    db.snapshot(2027).invoices.find((i) => i.number === "000099").lines.length,
    2,
  );
  await openSection("Planlı Ödemeler");
  await page
    .getByRole("button", { name: "Planlı ödeme ekle", exact: true })
    .click();
  await page.getByLabel(/^Açıklama/).fill("UI Planlı Ödeme");
  await page.getByLabel(/^Ay/).selectOption("1");
  await page.getByLabel("Planlanan tutar").fill("100000");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await screenshot("payments");
  const row = page.getByRole("row").filter({ hasText: "UI Planlı Ödeme" });
  await row.getByRole("button", { name: "Eşleştir", exact: true }).click();
  const invoiceSearch = page.getByLabel("Fatura numarası ara veya seç");
  await invoiceSearch.fill("000099");
  // Typing an exact invoice number and Enter adds it without submitting.
  await invoiceSearch.press("Enter");
  await expect(
    page.getByRole("button", { name: "000099 seçimini kaldır" }),
  ).toBeVisible();
  await invoiceSearch.fill("0001-DEMO");
  await page.getByRole("checkbox", { name: /0001-DEMO/ }).check();
  await expect(
    page.getByRole("button", { name: "000099 seçimini kaldır" }),
  ).toBeVisible();
  await invoiceSearch.fill("");
  await expect(page.getByLabel("Eşleştirilecek tutar")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await screenshot("mobile-payment-match");
  await page.setViewportSize({ width: 1512, height: 982 });
  await screenshot("payment-match");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.match(await row.innerText(), /Kısmi fatura/);
  assert.equal(
    db.snapshot(2027).payments.find((p) => p.description === "UI Planlı Ödeme")
      .linked_units,
    "52000000000",
  );
  await row
    .getByRole("button", { name: "Tasarrufa ayır", exact: true })
    .click();
  await page.getByLabel("Tasarruf tutarı · TL").fill("50000");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("dialog .error-box")).toContainText("aşamaz");
  await page.getByLabel("Tasarruf tutarı · TL").fill("30000");
  await page
    .getByLabel("Tasarruf açıklaması")
    .fill("Gerçekleşmeyecek kalan eğitimler");
  await screenshot("payment-saving-form");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(
    db.snapshot(2027).payments.find((p) => p.description === "UI Planlı Ödeme")
      .remaining_units,
    "18000000000",
  );
  await screenshot("payment-saving");
  await openSection("Versiyon & Tasarruf");
  const savingRow = page
    .locator(".savings-list article")
    .filter({ hasText: "UI Planlı Ödeme" });
  await expect(savingRow).toContainText("30.000,00 TL");
  await expect(savingRow).toContainText("Gerçekleşmeyecek kalan eğitimler");
  const savingsMetric = page
    .locator(".metric")
    .filter({ has: page.getByText("Tasarruf detay toplamı", { exact: true }) });
  await expect(savingsMetric).toContainText("66.000,00");
  await page
    .getByRole("button", { name: "Yeni versiyon", exact: true })
    .click();
  await page.getByLabel("Versiyon adı").fill("V3 UI");
  await expect(page.getByLabel("Güncel bütçe · TL")).toHaveCount(0);
  await page.getByLabel("Bütçede değişiklik var mı?").selectOption("true");
  await page.getByLabel("Güncel bütçe · TL").fill("2200000");
  await page.getByLabel("Değişiklik açıklaması").fill("Kabul testi");
  await expect(page.getByText(/Faturalar kopyalanmaz\./)).toHaveCount(0);
  await screenshot("version-create");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.locator(".version-card").filter({ hasText: "V3 UI" }).waitFor();
  await expect(savingRow).toContainText("30.000,00 TL");
  await expect(savingsMetric).toContainText("30.000,00");
  await expect(page.locator(".metrics .metric")).toHaveCount(3);
  await expect(page.getByText("Mutabakat farkı", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("2027 Bütçe − seçili plan", { exact: true }),
  ).toHaveCount(0);
  const savingBudget = page
    .locator(".metric")
    .filter({ hasText: "Tasarruflu bütçe" });
  await expect(savingBudget).toContainText("2.170.000,00");
  await expect(page.getByText(/Referans farkı, versiyon farkı/)).toHaveCount(0);
  // Existing versions can be edited in place and keep their monthly allocations.
  const versionCard = page
    .locator(".version-card")
    .filter({ hasText: "V3 UI" });
  const editedVersion = db.get(
    "SELECT id FROM budget_versions WHERE name='V3 UI'",
  );
  const copiedPlan = db.all(
    "SELECT * FROM budget_lines WHERE version_id=?",
    editedVersion.id,
  );
  await versionCard
    .getByRole("button", { name: "V3 UI versiyonunu düzenle", exact: true })
    .click();
  await expect(page.getByLabel("Güncel bütçe · TL")).toHaveValue("2200000");
  await expect(page.getByLabel("Plan tutarlarını kopyala")).toHaveCount(0);
  await page.getByLabel("Versiyon adı").fill("V3 UI Güncel");
  await page.getByLabel("Değişiklik açıklaması").fill("Güncellenen açıklama");
  await page.getByLabel("Güncel bütçe · TL").fill("2100000");
  await screenshot("version-edit");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await expect(versionCard).toContainText("Güncellenen açıklama");
  await expect(savingBudget).toContainText("2.070.000,00");
  assert.deepEqual(
    db.all("SELECT * FROM budget_lines WHERE version_id=?", editedVersion.id),
    copiedPlan,
  );
  assert.equal(
    db.get("SELECT id FROM budget_versions WHERE name='V3 UI Güncel'").id,
    editedVersion.id,
  );
  // A saving can be edited or removed from the savings screen; removal reopens the pending balance.
  await savingRow
    .getByRole("button", { name: "UI Planlı Ödeme tasarrufunu düzenle" })
    .click();
  await page
    .getByRole("button", { name: "Faturalanmamış tutarın tamamını kullan" })
    .click();
  await expect(page.getByLabel("Tasarruf tutarı · TL")).toHaveValue("48000");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await expect(savingRow).toContainText("48.000,00 TL");
  page.once("dialog", (d) => d.accept());
  await savingRow
    .getByRole("button", { name: "UI Planlı Ödeme tasarrufunu kaldır" })
    .click();
  await expect(savingRow).toHaveCount(0);
  assert.equal(
    db.snapshot(2027).payments.find((p) => p.description === "UI Planlı Ödeme")
      .remaining_units,
    "48000000000",
  );
  // Keep a partial saving for subsequent cancellation and responsive-layout checks.
  await openSection("Planlı Ödemeler");
  await row
    .getByRole("button", { name: "Tasarrufa ayır", exact: true })
    .click();
  await page.getByLabel("Tasarruf tutarı · TL").fill("30000");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await openSection("Versiyon & Tasarruf");
  assert.equal(
    db.get(
      "SELECT budget_changed FROM budget_versions WHERE name='V3 UI Güncel'",
    ).budget_changed,
    1,
  );
  await screenshot("savings");
  assert.equal(db.snapshot(2027).invoices.length, 7);
  await openSection("Faturalar");
  await screenshot("invoices");
  const invRow = page.getByRole("row").filter({ hasText: "000099" });
  await invRow
    .getByRole("button", { name: "000099 düzenle", exact: true })
    .click();
  await page.getByLabel("Eğitim Bedeli TL").first().fill("35000");
  await page
    .getByRole("button", { name: "Faturayı kaydet", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.match(await invRow.innerText(), /40.000,00/);
  page.once("dialog", (d) => d.accept());
  await invRow
    .getByRole("button", { name: "000099 iptal et", exact: true })
    .click();
  await invRow.waitFor({ state: "hidden" });
  const payment = db
    .snapshot(2027)
    .payments.find((p) => p.description === "UI Planlı Ödeme");
  assert.equal(payment.remaining_units, "53000000000");
  assert.equal(payment.saving_units, "30000000000");
  await openSection("Bütçe Planlama & Takip");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Menüyü aç", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Çalışma alanı menüsü" });
  await expect(drawer).toBeVisible();
  await screenshot("mobile-menu");
  const lastMenuItem = drawer.getByRole("button", {
    name: "Admin",
    exact: true,
  });
  await lastMenuItem.focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector(".sidebar-drawer")
        .contains(document.activeElement),
    ),
    true,
  );
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Menüyü aç", exact: true }),
  ).toBeFocused();
  await openSection("Ana Sayfa");
  await expect(drawer).not.toBeVisible();
  await screenshot("mobile-home");
  await noOverflow();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await noOverflow();
    await screenshot(`home-${viewport.width}`);
    await openSection("Bütçe Planlama & Takip");
    await noOverflow();
    await screenshot(`budget-${viewport.width}`);
    await openSection("Faturalar");
    await noOverflow();
    await openSection("Planlı Ödemeler");
    await noOverflow();
    await openSection("Versiyon & Tasarruf");
    await noOverflow();
    if (viewport.width === 390) await screenshot("mobile-savings");
    await openSection("Ana Sayfa");
  }
  await verifyBrowserZoom();
  await page.setViewportSize({ width: 1366, height: 768 });
  await openSection("Bütçe Planlama & Takip");
  await page.getByLabel("Kayıtlarda ara").fill("bulunmayan-kayıt-ui");
  await expect(
    page.getByText("Filtrelere uyan bütçe kalemi bulunamadı."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  // The initial load can fail and recover from the same screen.
  let failLoad = true;
  await page.route("**/api/state?**", async (route) => {
    if (failLoad)
      await route.fulfill({
        status: 503,
        json: { error: "Test: veriler yüklenemedi." },
      });
    else await route.continue();
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Test: veriler yüklenemedi.",
  );
  failLoad = false;
  await page.getByRole("button", { name: "Tekrar dene", exact: true }).click();
  await page
    .getByRole("heading", { name: "Ana Sayfa", exact: true, level: 1 })
    .waitFor();
  await page.unroute("**/api/state?**");
  // An empty year has usable navigation and forms, without inventing a plan.
  const emptyState = {
    ...db.snapshot(2027),
    version: undefined,
    versions: [],
    rows: [],
    invoices: [],
    payments: [],
    links: [],
    savings: [],
  };
  await openSection("Bütçe Planlama & Takip");
  await page.route("**/api/state?**", (route) =>
    route.fulfill({ json: emptyState }),
  );
  await page
    .getByRole("button", { name: "Verileri yenile", exact: true })
    .click();
  await expect(
    page.getByLabel("Plan versiyonu", { exact: true }),
  ).toContainText("Plan yok");
  await openSection("Bütçe Planlama & Takip");
  await expect(
    page.getByText("Filtrelere uyan bütçe kalemi bulunamadı."),
  ).toBeVisible();
  await openSection("Faturalar");
  await expect(
    page.getByText(/Henüz bu filtrelere uyan fatura yok/),
  ).toBeVisible();
  await page.unroute("**/api/state?**");
  await page
    .getByRole("button", { name: "Verileri yenile", exact: true })
    .click();
  await expect(page.locator(".list-table tbody tr").first()).toBeVisible();
  // Current request: period download, inline year/reference, and Admin roles.
  await openSection("Faturalar");
  await page.getByLabel("Dönem filtresi").selectOption("range");
  await page.getByLabel("Başlangıç ayı").selectOption("1");
  await page.getByLabel("Bitiş ayı").selectOption("2");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Excel'e aktar", exact: true })
    .click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "faturalar-2027-1-2.xlsx");
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(await download.path());
  assert.equal(
    book.getWorksheet("Faturalar").rowCount,
    db
      .snapshot(2027)
      .invoices.filter((i) => i.month <= 2 && i.status === "active").length + 1,
  );
  assert.deepEqual(
    book.worksheets.map((w) => w.name),
    ["Faturalar", "Fatura Detayları"],
  );
  // Budget's download contains its own metrics and plan, scoped exactly like the current table.
  await openSection("Bütçe Planlama & Takip");
  await page.getByLabel("Bütçe kalemi filtresi").selectOption("1");
  await page.getByLabel("Kayıtlarda ara").fill("LEAD");
  const currentVersion = Number(
    await page.getByLabel("Plan versiyonu", { exact: true }).inputValue(),
  );
  const sourceBudgetRow = db
    .snapshot(2027, currentVersion)
    .rows.find((r) => r.id === 1);
  const budgetDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Excel'e aktar", exact: true })
    .click();
  const budgetDownload = await budgetDownloadPromise;
  assert.equal(
    budgetDownload.suggestedFilename(),
    "butce-planlama-2027-1-2.xlsx",
  );
  const budgetBook = new ExcelJS.Workbook();
  await budgetBook.xlsx.readFile(await budgetDownload.path());
  assert.deepEqual(
    budgetBook.worksheets.map((w) => w.name),
    ["Bütçe Planlama", "Gerçekleşen Detayları"],
  );
  const budgetSheet = budgetBook.getWorksheet("Bütçe Planlama");
  assert.equal(budgetSheet.rowCount, 12);
  assert.equal(
    budgetSheet.getCell("A9").value,
    "LEAD Liderlik & Agile Eğitimler",
  );
  assert.equal(
    budgetSheet.getCell("A5").value,
    excelMoney(
      String(
        BigInt(sourceBudgetRow.months[0].plan) +
          BigInt(sourceBudgetRow.months[1].plan),
      ),
    ),
  );
  assert.equal(
    budgetSheet.getCell("E5").value,
    excelMoney(
      String(
        BigInt(sourceBudgetRow.months[0].actual) +
          BigInt(sourceBudgetRow.months[1].actual),
      ),
    ),
  );
  assert.equal(
    budgetBook.getWorksheet("Gerçekleşen Detayları").rowCount,
    sourceBudgetRow.details.filter((l) => l.month <= 2).length + 1,
  );
  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await openSection("Versiyon & Tasarruf");
  await expect(page.getByLabel("Karşılaştırma versiyonu")).toHaveCount(0);
  await page
    .getByLabel("Plan versiyonu", { exact: true })
    .selectOption(String(editedVersion.id));
  await expect(
    page
      .locator(".metric")
      .filter({ has: page.getByText("2027 Bütçe", { exact: true }) }),
  ).toContainText("2.100.000,00");
  await page.getByRole("button", { name: "Güncelleme", exact: true }).click();
  await page.getByLabel("2027 Bütçe · TL").fill("5000000");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(
    db.snapshot(2027, editedVersion.id).version.effective_budget_units,
    "5000000000000",
  );
  assert.equal(
    db.snapshot(2027).years.find((y) => y.year === 2027).reference_units,
    "2400000000000",
  );
  await openSection("Bütçe Planlama & Takip");
  const plannedMetric = page
    .locator(".metric")
    .filter({ hasText: "Planlanan bütçe" });
  await expect(plannedMetric).toContainText("5.000.000,00");
  await page
    .getByLabel("Plan versiyonu", { exact: true })
    .selectOption(initialVersion);
  await expect(plannedMetric).toContainText("2.400.000,00");
  await page
    .getByLabel("Plan versiyonu", { exact: true })
    .selectOption(String(editedVersion.id));
  await expect(plannedMetric).toContainText("5.000.000,00");
  await openSection("Versiyon & Tasarruf");
  await page.getByLabel("Yeni bütçe yılı", { exact: true }).fill("2028");
  await page
    .getByLabel("Yeni yıl bütçesi TL", { exact: true })
    .fill("1200000,123456");
  await page
    .getByRole("button", { name: "Yeni yıl ekle", exact: true })
    .click();
  await expect(page.getByLabel("Bütçe yılı", { exact: true })).toHaveValue(
    "2028",
  );
  assert.equal(
    db.snapshot(2028).years.find((y) => y.year === 2028).reference_units,
    "1200000123456",
  );
  await openSection("Bütçe Planlama & Takip");
  await expect(plannedMetric).toContainText("1.200.000,12");
  await expect(
    page.locator(".metric").filter({ hasText: "Kalan bütçe" }),
  ).toContainText("1.200.000,12");
  await expect(
    page.locator(".metric").filter({ hasText: "Kullanılabilir bütçe" }),
  ).toContainText("1.200.000,12");
  await page.getByLabel("Dönem filtresi").selectOption("1");
  await expect(plannedMetric).toContainText("0,00"); // January has no monthly allocation.
  await page.getByRole("button", { name: "Filtreleri temizle" }).click();
  await expect(plannedMetric).toContainText("1.200.000,12");
  await openSection("Versiyon & Tasarruf");
  await page.getByRole("button", { name: "Güncelleme", exact: true }).click();
  await page.getByLabel("2028 Bütçe · TL").fill("1300000");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await openSection("Bütçe Planlama & Takip");
  await expect(plannedMetric).toContainText("1.300.000,00");
  await screenshot("new-year-budget");
  await page.getByLabel("Bütçe yılı", { exact: true }).selectOption("2027");
  await openSection("Admin");
  await page.getByLabel("Kullanıcı adı", { exact: true }).fill("ui-viewer");
  await page.getByLabel("İlk parola", { exact: false }).fill(password);
  await page
    .getByRole("button", { name: "Kullanıcı oluştur", exact: true })
    .click();
  await expect(
    page.getByLabel("ui-viewer yetkisi", { exact: true }),
  ).toHaveValue("viewer");
  await screenshot("admin");
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await screenshot("mobile-admin");
  await page.setViewportSize({ width: 1366, height: 768 });
  const viewerContext = await browser.newContext(),
    viewerPage = await viewerContext.newPage();
  try {
    await viewerPage.goto("http://127.0.0.1:3198");
    await viewerPage
      .getByLabel("Kullanıcı Adı", { exact: true })
      .fill("ui-viewer");
    await viewerPage.getByLabel("Parola", { exact: true }).fill(password);
    await viewerPage
      .getByRole("button", { name: "Giriş Yap", exact: true })
      .click();
    await viewerPage.locator(".home-card").first().click();
    await expect(
      viewerPage.getByRole("textbox", {
        name: "LEAD Liderlik & Agile Eğitimler Ocak planı",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      viewerPage
        .getByRole("navigation")
        .getByRole("button", { name: "Admin", exact: true }),
    ).toHaveCount(0);
  } finally {
    await viewerContext.close();
  }
  assert.equal(
    requests.some((url) => /login-background|login-vehicles/.test(url)),
    false,
    "Araç görseli isteği olmamalı",
  );
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await page.getByRole("heading", { name: "Oturum Aç", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "UI PASS: görselsiz giriş, ana sayfa kartları, ortak menü, bölüm filtrelerinin korunması, taslak koruması, mobil çekmece ve Escape odağı, 390/768/1366/1512/1920 px görünüm, giriş, kalıcı aylık plan, zorunlu/yanlış tutar doğrulama, form korunarak oturum yenileme, detay açma, planlı ödeme, çok kalemli/dövizli fatura, fatura numarasıyla eşleştirme, dönem bazlı Excel, Admin yetkileri, salt okunur kullanıcı, yıl bütçesi/güncelleme, gerçek %200 tarayıcı yakınlaştırması, boş veri/hata sonrası tekrar deneme, versiyon kopyası, fatura düzenleme/iptal, mobil taşma, çıkış.",
  );
} catch (error) {
  await screenshot("failure");
  throw error;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  db.close();
}
