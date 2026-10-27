export const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
export const CATEGORIES = [
  "LEAD Liderlik & Agile Eğitimler",
  "LEAD Yönetim Eğitimleri",
  "Koç Üniversitesi Yüksek Lisans",
  "Davranışsal Eğitimler",
  "Teknik Eğitimler",
  "LEAD Dijital & Online Eğitimler",
  "Gelişim Merkezi Uygulamaları",
  "İSG Eğitimleri",
  "SSH Eğitimleri (Askeri & Ticari)",
  "Gelişim & Zirve Yolculuğu Eğitimleri",
  "MYK & Belgelendirme Süreçleri",
];
export const SCALE = 1000000n;
export const MAX_UNITS = 9000000000000000000n;
export class ValidationError extends Error {
  constructor(message, field = "", status = 400) {
    super(message);
    this.field = field;
    this.status = status;
  }
}
export function required(value, field, max = 200) {
  if (typeof value !== "string" || !value.trim())
    throw new ValidationError("Bu alan zorunludur.", field);
  if (value.trim().length > max)
    throw new ValidationError(`En fazla ${max} karakter girilebilir.`, field);
  return value.trim();
}
export function optional(value, field, max = 2000) {
  if (value === undefined || value === null || value === "") return "";
  return required(value, field, max);
}
export function integer(value, field, min = 0, max = 1000000) {
  if (
    !/^[0-9]+$/.test(String(value ?? "")) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < min ||
    Number(value) > max
  )
    throw new ValidationError(`${min}–${max} arasında tam sayı girin.`, field);
  return Number(value);
}
// Strict Turkish entry: decimal comma; periods only in correctly grouped thousands.
// Six decimal digits are retained, never silently rounded at entry.
export function parseAmount(value, field = "amount", positive = false) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!/^(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{1,6})?$/.test(s))
    throw new ValidationError(
      "Türkçe tutar girin: 1.250,50 (en fazla 6 ondalık).",
      field,
    );
  const [whole, fraction = ""] = s.replaceAll(".", "").split(",");
  const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
  if (result > MAX_UNITS || (positive && result === 0n))
    throw new ValidationError(
      positive
        ? "Sıfırdan büyük, geçerli bir tutar girin."
        : "Tutar desteklenen sınırı aşıyor.",
      field,
    );
  return result.toString();
}
export function editAmount(units = "0") {
  const n = BigInt(units),
    abs = n < 0n ? -n : n;
  const frac = (abs % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return `${n < 0n ? "-" : ""}${abs / SCALE}${frac ? "," + frac : ""}`;
}
export function money(units = "0", digits = 2) {
  let n = BigInt(units);
  const negative = n < 0n;
  if (negative) n = -n;
  const factor = 10n ** BigInt(6 - digits);
  const rounded = (n + factor / 2n) / factor;
  const base = 10n ** BigInt(digits);
  return `${negative ? "−" : ""}${(rounded / base).toLocaleString("tr-TR")}${digits ? "," + (rounded % base).toString().padStart(digits, "0") : ""}`;
}
export function sum(values) {
  return values.reduce((a, b) => a + BigInt(b), 0n).toString();
}
export function subtract(a, b) {
  return (BigInt(a) - BigInt(b)).toString();
}
export function rate(actual, plan) {
  return BigInt(plan) === 0n
    ? null
    : Number((BigInt(actual) * 1000n) / BigInt(plan)) / 10;
}
export function normalizeName(value) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();
}
export function fxSuggestion(amount, exchange) {
  return ((BigInt(amount) * BigInt(exchange) + SCALE / 2n) / SCALE).toString();
}
export function validateInvoice(input) {
  const invoice = {
    number: required(input.number, "number", 100),
    year: integer(input.year, "year", 2000, 2100),
    month: integer(input.month, "month", 1, 12),
    note: optional(input.note, "note"),
    lines: [],
  };
  if (
    !Array.isArray(input.lines) ||
    !input.lines.length ||
    input.lines.length > 100
  )
    throw new ValidationError("1–100 eğitim kalemi girin.", "lines");
  invoice.lines = input.lines.map((line, i) => {
    const f = (key) => `lines.${i}.${key}`;
    const result = {
      id: line.id ? integer(line.id, f("id"), 1) : null,
      category_id: integer(line.category_id, f("category_id"), 1),
      training_topic_id: line.training_topic_id == null || line.training_topic_id === '' ? null : integer(line.training_topic_id, f('training_topic_id'), 1),
      training_name: required(line.training_name, f("training_name")),
      amount_units: parseAmount(line.amount, f("amount")),
      participant_count: integer(
        line.participant_count,
        f("participant_count"),
      ),
      rd_participant_count: integer(
        line.rd_participant_count,
        f("rd_participant_count"),
      ),
      other_participant_count: integer(
        line.other_participant_count,
        f("other_participant_count"),
      ),
      description: optional(line.description, f("description")),
      currency: "",
      foreign_units: null,
      rate_units: null,
    };
    if (line.foreign_amount !== "" && line.foreign_amount != null) {
      result.foreign_units = parseAmount(
        line.foreign_amount,
        f("foreign_amount"),
      );
      result.currency = required(line.currency, f("currency"));
      if (!["USD", "EUR", "GBP", "CHF"].includes(result.currency))
        throw new ValidationError(
          "USD, EUR, GBP veya CHF seçin.",
          f("currency"),
        );
      result.rate_units = parseAmount(
        line.exchange_rate,
        f("exchange_rate"),
        true,
      );
    } else if (line.exchange_rate !== "" && line.exchange_rate != null)
      result.rate_units = parseAmount(
        line.exchange_rate,
        f("exchange_rate"),
        true,
      );
    return result;
  });
  return invoice;
}
