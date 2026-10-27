import { useState, type FormEvent } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import {
  MONTHS,
  editAmount,
  parseAmount,
  fxSuggestion,
  money,
  validateInvoice,
} from "../../shared/domain.mjs";
import type { Invoice, Snapshot } from "./types";
import { ApiError } from "./api";
import { Field, Modal } from "./ui";
type DraftLine = {
  id?: number;
  category_id: string;
  training_name: string;
  amount: string;
  foreign_amount: string;
  currency: string;
  exchange_rate: string;
  participant_count: string;
  rd_participant_count: string;
  other_participant_count: string;
  description: string;
};
const blankLine = (category = 1): DraftLine => ({
  category_id: String(category),
  training_name: "",
  amount: "",
  foreign_amount: "",
  currency: "",
  exchange_rate: "",
  participant_count: "",
  rd_participant_count: "",
  other_participant_count: "",
  description: "",
});
export function InvoiceEditor({
  data,
  invoice,
  category,
  onClose,
  onSave,
}: {
  data: Snapshot;
  invoice?: Invoice;
  category?: number;
  onClose: () => void;
  onSave: (path: string, body: unknown, method?: string) => Promise<void>;
}) {
  const [number, setNumber] = useState(invoice?.number || ""),
    [year, setYear] = useState(String(invoice?.year || data.year)),
    [month, setMonth] = useState(
      String(invoice?.month || new Date().getMonth() + 1),
    ),
    [note, setNote] = useState(invoice?.note || "");
  const [lines, setLines] = useState<DraftLine[]>(
    invoice
      ? invoice.lines.map((l) => ({
          id: l.id,
          category_id: String(l.category_id),
          training_name: l.training_name,
          amount: editAmount(l.amount_units),
          foreign_amount:
            l.foreign_units === null ? "" : editAmount(l.foreign_units),
          currency: l.currency,
          exchange_rate: l.rate_units === null ? "" : editAmount(l.rate_units),
          participant_count: String(l.participant_count),
          rd_participant_count: String(l.rd_participant_count),
          other_participant_count: String(l.other_participant_count),
          description: l.description,
        }))
      : [blankLine(category || data.categories[0]?.id)],
  );
  const [error, setError] = useState<ApiError | null>(null),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const readonly = invoice?.status === "cancelled";
  function close() {
    if (
      !busy &&
      (!dirty ||
        confirm("Kaydedilmemiş fatura değişikliklerinden vazgeçilsin mi?"))
    )
      onClose();
  }
  function update(i: number, key: keyof DraftLine, value: string) {
    setLines((old) =>
      old.map((l, n) => (n === i ? { ...l, [key]: value } : l)),
    );
    setDirty(true);
  }
  const fieldError = (key: string) =>
    error?.field === key ? error.message : undefined;
  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body = { number, year, month, note, lines };
    try {
      validateInvoice(body);
      await onSave(
        invoice ? `/invoices/${invoice.id}` : "/invoices",
        body,
        invoice ? "PUT" : "POST",
      );
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={invoice ? `Fatura ${invoice.number}` : "Yeni fatura"}
      onClose={close}
    >
      <form onSubmit={save} onChange={() => setDirty(true)}>
        <div className="dialog-body">
          <p className="muted">Yıldızlı alanlar zorunludur.</p>
          {readonly && (
            <p className="notice">
              Bu fatura iptal edilmiştir; bütçe toplamına dahil değildir.
            </p>
          )}
          <fieldset disabled={busy || readonly}>
            <h3 className="form-section-title">Fatura bilgileri</h3>
            <div className="form-grid three">
              <Field
                label="Fatura Numarası"
                required
                error={fieldError("number")}
              >
                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  maxLength={100}
                  required
                  placeholder="Örn. 00001234"
                />
              </Field>
              <Field label="Bütçe Yılı" required error={fieldError("year")}>
                <select value={year} onChange={(e) => setYear(e.target.value)}>
                  {data.years.map((y) => (
                    <option key={y.year}>{y.year}</option>
                  ))}
                </select>
              </Field>
              <Field label="Fatura Ayı" required error={fieldError("month")}>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {lines.map((line, i) => {
              let suggested: string | null = null;
              try {
                if (line.foreign_amount && line.exchange_rate)
                  suggested = fxSuggestion(
                    parseAmount(line.foreign_amount),
                    parseAmount(line.exchange_rate),
                  );
              } catch {}
              const f = (key: string) => fieldError(`lines.${i}.${key}`);
              const participantsDiffer =
                [
                  line.participant_count,
                  line.rd_participant_count,
                  line.other_participant_count,
                ].every((v) => /^\d+$/.test(v)) &&
                Number(line.participant_count) !==
                  Number(line.rd_participant_count) +
                    Number(line.other_participant_count);
              return (
                <section className="line-editor" key={i}>
                  <div className="section-heading">
                    <h3>Fatura Detay{lines.length > 1 ? ` ${i + 1}` : ""}</h3>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="icon danger"
                        aria-label={`Kalem ${i + 1} kaldır`}
                        onClick={() => {
                          setLines(lines.filter((_, n) => n !== i));
                          setDirty(true);
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                  <div className="form-grid">
                    <Field
                      label="Bütçe Kalemi"
                      required
                      error={f("category_id")}
                    >
                      <select
                        value={line.category_id}
                        onChange={(e) =>
                          update(i, "category_id", e.target.value)
                        }
                      >
                        {data.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Eğitim Adı"
                      required
                      error={f("training_name")}
                    >
                      <input
                        required
                        maxLength={200}
                        value={line.training_name}
                        onChange={(e) =>
                          update(i, "training_name", e.target.value)
                        }
                        placeholder="Eğitimin veya harcamanın adı"
                      />
                    </Field>
                    <Field
                      label="Eğitim Bedeli TL · KDV hariç"
                      required
                      error={f("amount")}
                      hint="Örnek: 1.250,50"
                    >
                      <input
                        required
                        inputMode="decimal"
                        value={line.amount}
                        onChange={(e) => update(i, "amount", e.target.value)}
                      />
                    </Field>
                    <Field label="Açıklama" error={f("description")}>
                      <textarea
                        value={line.description}
                        maxLength={2000}
                        onChange={(e) =>
                          update(i, "description", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <h4 className="form-section-title">Katılımcı dağılımı</h4>
                  <div className="form-grid three">
                    {(
                      [
                        ["participant_count", "Katılımcı Sayısı"],
                        ["rd_participant_count", "Ar-Ge Katılımcı Sayısı"],
                        ["other_participant_count", "Diğer Katılımcı Sayısı"],
                      ] as const
                    ).map(([key, label]) => (
                      <Field label={label} required error={f(key)} key={key}>
                        <input
                          required
                          inputMode="numeric"
                          pattern="[0-9]+"
                          value={line[key]}
                          onChange={(e) => update(i, key, e.target.value)}
                        />
                      </Field>
                    ))}
                  </div>
                  {participantsDiffer && (
                    <p className="notice">
                      Ar-Ge + Diğer, toplam katılımcı sayısına eşit değil.
                      Kontrol edebilirsiniz; bu fark kaydı engellemez.
                    </p>
                  )}
                  <details
                    className="fx-section"
                    open={
                      Boolean(line.foreign_amount || line.exchange_rate) ||
                      undefined
                    }
                  >
                    <summary>
                      Döviz bilgileri <small>İsteğe bağlı</small>
                    </summary>
                    <div className="form-grid three">
                      <Field
                        label="Eğitim Bedeli (Diğer)"
                        error={f("foreign_amount")}
                      >
                        <input
                          inputMode="decimal"
                          value={line.foreign_amount}
                          onChange={(e) =>
                            update(i, "foreign_amount", e.target.value)
                          }
                        />
                      </Field>
                      <Field
                        label="Para Birimi"
                        required={Boolean(line.foreign_amount)}
                        error={f("currency")}
                      >
                        <select
                          required={Boolean(line.foreign_amount)}
                          value={line.currency}
                          onChange={(e) =>
                            update(i, "currency", e.target.value)
                          }
                        >
                          <option value="">Seçin</option>
                          {["USD", "EUR", "GBP", "CHF"].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="Kur · 1 döviz = X TL"
                        required={Boolean(line.foreign_amount)}
                        error={f("exchange_rate")}
                      >
                        <input
                          required={Boolean(line.foreign_amount)}
                          inputMode="decimal"
                          value={line.exchange_rate}
                          onChange={(e) =>
                            update(i, "exchange_rate", e.target.value)
                          }
                        />
                      </Field>
                    </div>
                    {suggested !== null && (
                      <p className="notice">
                        Hesaplanan TL: {money(suggested, 6)}{" "}
                        <button
                          type="button"
                          className="link"
                          onClick={() =>
                            update(i, "amount", editAmount(suggested!))
                          }
                        >
                          TL alanına uygula
                        </button>
                        . Bütçeye kaydettiğiniz TL tutarı yansır; manuel fark
                        korunur.
                      </p>
                    )}
                  </details>
                </section>
              );
            })}
            {!readonly && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  setLines([...lines, blankLine(data.categories[0]?.id)]);
                  setDirty(true);
                }}
              >
                <Plus size={16} />
                Eğitim kalemi ekle
              </button>
            )}
            <Field label="Not" error={fieldError("note")}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                placeholder="Faturanın tüm kalemleri için not"
              />
            </Field>
          </fieldset>
          {error && (
            <p role="alert" className="error-box">
              {error.message}
            </p>
          )}
        </div>
        <footer>
          <button type="button" className="button" onClick={close}>
            Kapat
          </button>
          {!readonly && (
            <button className="button primary" disabled={busy}>
              <Save size={16} />
              {busy ? "Kaydediliyor…" : "Faturayı kaydet"}
            </button>
          )}
        </footer>
      </form>
    </Modal>
  );
}
