import { useState, type FormEvent } from "react";
import { Field, Modal } from "./ui";
import {
  MONTHS,
  editAmount,
  money,
  subtract,
  sum,
} from "../../shared/domain.mjs";
import type { Snapshot } from "./types";
import { ApiError } from "./api";
export type EditorSpec = {
  kind:
    | "version"
    | "category"
    | "payment"
    | "saving"
    | "payment-saving"
    | "link"
    | "reference";
  record?: any;
};
export function RecordEditor({
  spec,
  data,
  onClose,
  onSave,
}: {
  spec: EditorSpec;
  data: Snapshot;
  onClose: () => void;
  onSave: (path: string, body: unknown, method?: string) => Promise<void>;
}) {
  const { kind, record: r } = spec;
  const [form, setForm] = useState<Record<string, string>>(() => ({
    name: r?.name || "",
    description: r?.description || "",
    title: r?.title || "",
    amount:
      kind === "payment-saving"
        ? editAmount(
            r.saving_units !== "0" ? r.saving_units : r.remaining_units,
          )
        : r?.amount_units
          ? editAmount(r.amount_units)
          : "",
    note: r?.saving_note || "",
    year: String(r?.year || data.year),
    month: String(r?.month || new Date().getMonth() + 1),
    category_id: String(r?.category_id || data.categories[0]?.id || ""),
    source_id: String(data.version?.id || ""),
    reference:
      kind === "reference"
        ? editAmount(
            data.version?.effective_budget_units ??
              data.years.find((y) => y.year === data.year)?.reference_units ??
              "0",
          )
        : "0",
    payment_id: String(r?.id || ""),
    invoice_id: "",
    budget_changed: r?.budget_changed === 1 ? "true" : "false",
    budget: editAmount(
      r?.effective_budget_units ??
        data.version?.effective_budget_units ??
        data.years.find((y) => y.year === data.year)?.reference_units ??
        "0",
    ),
  }));
  const [error, setError] = useState<ApiError | null>(null),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [selectedInvoices, setSelectedInvoices] = useState<number[]>([]);
  const title = {
    version: r ? "Bütçe versiyonunu düzenle" : "Yeni bütçe versiyonu",
    category: r ? "Bütçe kalemini düzenle" : "Yeni bütçe kalemi",
    payment: r ? "Planlı ödemeyi düzenle" : "Planlı ödeme ekle",
    saving: r ? "Tasarrufu düzenle" : "Tasarruf detayı ekle",
    "payment-saving": "Planlı ödeme tasarrufu",
    link: "Faturayla eşleştir",
    reference: `${data.year} Bütçe Güncelleme`,
  }[kind];
  const change = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
    setDirty(true);
  };
  const input = (key: string, label: string, required = true) => (
    <Field
      label={label}
      required={required}
      error={error?.field === key ? error.message : undefined}
    >
      <input
        required={required}
        value={form[key]}
        onChange={(e) => change(key, e.target.value)}
        inputMode={
          ["amount", "reference", "budget"].includes(key)
            ? "decimal"
            : undefined
        }
      />
    </Field>
  );
  const close = () => {
    if (
      !busy &&
      (!dirty || confirm("Kaydedilmemiş değişikliklerden vazgeçilsin mi?"))
    )
      onClose();
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      let path = "",
        method = "POST";
      let body: Record<string, unknown> = { ...form };
      if (kind === "version") {
        path = "/versions";
        body.budget_changed = form.budget_changed === "true";
      }
      if (kind === "category") path = "/categories";
      if (kind === "payment") path = "/payments";
      if (kind === "saving") {
        path = "/savings";
        body.version_id = data.version?.id;
      }
      if (kind === "link") {
        path = "/links";
        body = { payment_id: form.payment_id, invoice_ids: selectedInvoices };
      }
      if (kind === "payment-saving") {
        path = `/payments/${r.id}/saving`;
        method = "PUT";
        body = { amount: form.amount, note: form.note };
      }
      if (kind === "reference") {
        path = "/reference";
        method = "PUT";
        body.version_id = data.version?.id;
      }
      if (r?.id && !["link", "reference", "payment-saving"].includes(kind)) {
        path += `/${r.id}`;
        method = "PUT";
      }
      await onSave(path, body, method);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }
  const eligible = data.invoices.filter(
    (i) =>
      i.status === "active" &&
      i.year === r?.year &&
      i.month === r?.month &&
      i.lines.some((l) => l.category_id === r?.category_id),
  );
  const filteredInvoices = eligible.filter((i) =>
    i.number
      .toLocaleLowerCase("tr-TR")
      .includes(invoiceSearch.trim().toLocaleLowerCase("tr-TR")),
  );
  const toggleInvoice = (id: number) => {
    setSelectedInvoices((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
    setDirty(true);
  };
  const invoiceAvailable = (id: number) => {
    const lines = eligible
      .find((i) => i.id === id)!
      .lines.filter((l) => l.category_id === r.category_id);
    const used = data.links.filter(
      (link) =>
        link.payment_id !== r.id &&
        data.payments.some(
          (p) => p.id === link.payment_id && p.status === "active",
        ) &&
        lines.some((l) => l.id === link.line_id),
    );
    return subtract(
      sum(lines.map((l) => l.amount_units)),
      sum(used.map((l) => l.amount_units)),
    );
  };
  return (
    <Modal title={title} onClose={close}>
      <form onSubmit={save}>
        <div className="dialog-body">
          <fieldset disabled={busy}>
            {kind === "reference" &&
              input("reference", `${form.year} Bütçe · TL`)}
            {["category", "version"].includes(kind) &&
              input(
                "name",
                kind === "category" ? "Bütçe kalemi adı" : "Versiyon adı",
              )}
            {kind === "version" && (
              <>
                <Field label="Bütçede değişiklik var mı?" required>
                  <select
                    value={form.budget_changed}
                    onChange={(e) => change("budget_changed", e.target.value)}
                  >
                    <option value="false">Yok</option>
                    <option value="true">Var</option>
                  </select>
                </Field>
                {form.budget_changed === "true" &&
                  input("budget", "Güncel bütçe · TL")}
                {input("description", "Değişiklik açıklaması")}
                {!r && (
                  <Field label="Plan tutarlarını kopyala">
                    <select
                      value={form.source_id}
                      onChange={(e) => change("source_id", e.target.value)}
                    >
                      <option value="">Boş planla başla</option>
                      {data.versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </>
            )}
            {kind === "saving" && (
              <>
                {input("title", "Tasarruf başlığı")}
                {input("amount", "Tasarruf tutarı · TL")}
                <p className="muted">
                  Tasarruf detayı bilgi amaçlıdır; plandan yeniden düşülmez.
                </p>
              </>
            )}
            {kind === "payment-saving" && (
              <>
                <p>
                  {r.description} · {MONTHS[r.month - 1]} {r.year}
                </p>
                <dl className="match-summary">
                  <div>
                    <dt>Faturalanan</dt>
                    <dd>{money(r.linked_units)} TL</dd>
                  </div>
                  <div>
                    <dt>Tasarrufa ayrılabilir</dt>
                    <dd>
                      {money(subtract(r.amount_units, r.linked_units))} TL
                    </dd>
                  </div>
                </dl>
                {input("amount", "Tasarruf tutarı · TL")}
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    change(
                      "amount",
                      editAmount(subtract(r.amount_units, r.linked_units)),
                    )
                  }
                >
                  Faturalanmamış tutarın tamamını kullan
                </button>
                {input("note", "Tasarruf açıklaması", false)}
                <p className="muted">
                  Gerçekleşmeyecek tutarı girin. Bu tutar bekleyen ödemeden
                  çıkar ve {r.year} yılı tasarruf ekranında tüm versiyonlarda
                  görünür. Tasarrufu kaldırmak için 0 kaydedin.
                </p>
              </>
            )}
            {kind === "payment" && (
              <>
                <Field label="Bütçe kalemi" required>
                  <select
                    value={form.category_id}
                    onChange={(e) => change("category_id", e.target.value)}
                  >
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="form-grid">
                  <Field label="Yıl" required>
                    <select
                      value={form.year}
                      onChange={(e) => change("year", e.target.value)}
                    >
                      {data.years.map((y) => (
                        <option key={y.year}>{y.year}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ay" required>
                    <select
                      value={form.month}
                      onChange={(e) => change("month", e.target.value)}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {input("description", "Açıklama")}
                {input("amount", "Planlanan tutar · TL, KDV hariç")}
              </>
            )}
            {kind === "link" && (
              <>
                <p>
                  {r.description} · {MONTHS[r.month - 1]} {r.year}
                </p>
                <dl className="match-summary">
                  <div>
                    <dt>Planlanan ödeme</dt>
                    <dd>{money(r.amount_units)} TL</dd>
                  </div>
                  <div>
                    <dt>Bekleyen ödeme</dt>
                    <dd>{money(r.remaining_units)} TL</dd>
                  </div>
                </dl>
                <Field
                  label="Fatura numarası ara veya seç"
                  hint="Numara yazarak arayın; birden fazla fatura seçebilirsiniz."
                >
                  <input
                    type="search"
                    placeholder="Fatura numarası yazın…"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (
                          filteredInvoices.length === 1 &&
                          !selectedInvoices.includes(filteredInvoices[0].id)
                        )
                          toggleInvoice(filteredInvoices[0].id);
                      }
                    }}
                  />
                </Field>
                {selectedInvoices.length > 0 && (
                  <div
                    className="invoice-selections"
                    aria-label="Seçilen faturalar"
                  >
                    {selectedInvoices.map((id) => (
                      <button
                        type="button"
                        className="button small"
                        key={id}
                        onClick={() => toggleInvoice(id)}
                        aria-label={`${eligible.find((i) => i.id === id)?.number} seçimini kaldır`}
                      >
                        {eligible.find((i) => i.id === id)?.number} ×
                      </button>
                    ))}
                  </div>
                )}
                <div
                  className="invoice-picker"
                  role="group"
                  aria-label="Eşleştirilecek faturalar"
                >
                  {filteredInvoices.map((invoice) => (
                    <label className="invoice-choice" key={invoice.id}>
                      <input
                        type="checkbox"
                        checked={selectedInvoices.includes(invoice.id)}
                        onChange={() => toggleInvoice(invoice.id)}
                      />
                      <span>
                        <strong>{invoice.number}</strong>
                        <small>
                          {MONTHS[invoice.month - 1]} {invoice.year} ·{" "}
                          {money(invoiceAvailable(invoice.id))} TL
                          eşleştirilebilir
                        </small>
                        {data.links.some(
                          (l) =>
                            l.payment_id === r.id &&
                            invoice.lines.some((il) => il.id === l.line_id),
                        ) && <small>Bu ödemeyle eşleşmiş fatura</small>}
                      </span>
                    </label>
                  ))}
                </div>
                {!!eligible.length && !filteredInvoices.length && (
                  <p className="notice">
                    Bu numarayla eşleşen uygun fatura yok.
                  </p>
                )}
                <p className="muted">
                  Faturalar seçim sırasıyla, bekleyen ödeme ve fatura
                  bakiyeleriyle sınırlı olarak eşleştirilir. Önceki fatura
                  bağlantıları korunur. Tasarrufa ayrılan tutar eşleştirilmez.
                </p>
                {!eligible.length && (
                  <p className="notice">
                    Aynı bütçe kalemi, yıl ve ayda aktif fatura yok. Önce fatura
                    ekleyin.
                  </p>
                )}
              </>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="error-box">
              {error.message}
            </p>
          )}
        </div>
        <footer>
          <button type="button" className="button" onClick={close}>
            Vazgeç
          </button>
          <button
            className="button primary"
            disabled={busy || (kind === "link" && !selectedInvoices.length)}
          >
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
