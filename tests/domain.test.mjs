import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAmount,
  editAmount,
  money,
  validateInvoice,
  fxSuggestion,
  rate,
  sum,
} from "../shared/domain.mjs";
const valid = () => ({
  number: "000012",
  year: 2026,
  month: 2,
  lines: [
    {
      category_id: 1,
      training_name: "Eğitim",
      amount: "1.250,123456",
      participant_count: "0",
      rd_participant_count: "0",
      other_participant_count: "0",
    },
  ],
});
test("Türkçe tutarlar kayıpsız; boş, negatif, belirsiz ve fazla hassas girişler reddedilir", () => {
  assert.equal(parseAmount("1.250,123456"), "1250123456");
  assert.equal(editAmount("1250123456"), "1250,123456");
  assert.equal(money("1250123456"), "1.250,12");
  assert.equal(sum(["1", "2"]), "3");
  for (const input of [
    "",
    " ",
    "-1",
    "1.25",
    "1,234.56",
    "1,1234567",
    "1e5",
    "NaN",
    "00.123",
    "1 250",
    1.2,
  ])
    assert.throws(() => parseAmount(input));
  assert.equal(parseAmount("0"), "0");
  assert.equal(parseAmount("9000000000000"), "9000000000000000000");
  assert.throws(() => parseAmount("9000000000000,000001"));
  assert.equal(money("999999"), "1,00");
  assert.equal(money("-1234567"), "−1,23");
});
test("Yedi fatura alanı zorunlu, sıfır geçerli, sayı değil metin fatura numarası", () => {
  const invoice = validateInvoice(valid());
  assert.equal(invoice.number, "000012");
  assert.equal(invoice.lines[0].participant_count, 0);
  for (const field of ["number", "month"]) {
    const v = valid();
    v[field] = "";
    assert.throws(() => validateInvoice(v));
  }
  for (const field of [
    "training_name",
    "amount",
    "participant_count",
    "rd_participant_count",
    "other_participant_count",
  ]) {
    const v = valid();
    v.lines[0][field] = "";
    assert.throws(() => validateInvoice(v));
  }
  for (const val of ["-1", "1.2", " ", "NaN"]) {
    const v = valid();
    v.lines[0].participant_count = val;
    assert.throws(() => validateInvoice(v));
  }
  const v = valid();
  v.lines[0].rd_participant_count = "10";
  assert.doesNotThrow(() => validateInvoice(v));
});
test("Döviz yönü ve koşullu alanlar; TL yalnızca verilen tutar", () => {
  const v = valid();
  v.lines[0].foreign_amount = "100";
  assert.throws(() => validateInvoice(v));
  v.lines[0].currency = "EUR";
  assert.throws(() => validateInvoice(v));
  v.lines[0].exchange_rate = "40,125";
  const invoice = validateInvoice(v);
  assert.equal(invoice.lines[0].amount_units, "1250123456");
  assert.equal(
    fxSuggestion(invoice.lines[0].foreign_units, invoice.lines[0].rate_units),
    "4012500000",
  );
  assert.equal(rate("10", "0"), null);
});
