import { Wallet, ReceiptText, WalletCards, CalendarClock } from "lucide-react";
import { MONTHS, money } from "../../../shared/domain.mjs";

export type BudgetTotals = Record<
  "plan" | "actual" | "remaining" | "pending" | "available",
  string
>;
export function BudgetMetrics({
  totals,
  month,
  annual,
  version,
}: {
  totals: BudgetTotals;
  month: string;
  annual: boolean;
  version?: string;
}) {
  const metrics = [
    {
      label: "Planlanan bütçe",
      key: "plan",
      caption: `${
        annual
          ? "Yıllık bütçe"
          : month
            ? month.includes("-")
              ? month
                  .split("-")
                  .map((m) => MONTHS[Number(m) - 1])
                  .join(" – ")
              : MONTHS[Number(month) - 1]
            : "Aylık dağılım · Seçili kapsam"
      } · ${version || "Plan yok"}`,
      Icon: Wallet,
    },
    {
      label: "Gerçekleşen harcama",
      key: "actual",
      caption: "Aktif fatura kalemleri",
      Icon: ReceiptText,
    },
    {
      label: "Kalan bütçe",
      key: "remaining",
      caption: "Planlanan − gerçekleşen",
      Icon: WalletCards,
    },
    {
      label: "Bekleyen planlı ödeme",
      key: "pending",
      caption: "Henüz faturalanmayan tutar",
      Icon: CalendarClock,
    },
    {
      label: "Kullanılabilir bütçe",
      key: "available",
      caption: "Kalan − bekleyen ödeme",
      Icon: null,
    },
  ] as const;
  return (
    <section className="metrics" aria-label="Seçili kapsam bütçe özeti">
      {metrics.map(({ key, label, caption, Icon }) => (
        <article
          className={`metric ${key === "available" ? "accent" : ""}`}
          key={key}
        >
          <div>
            <span>{label}</span>
            {Icon && <Icon size={18} aria-hidden="true" />}
          </div>
          <strong className={BigInt(totals[key]) < 0n ? "negative" : ""}>
            {money(totals[key])}
            <small> TL</small>
          </strong>
          <p>{caption}</p>
        </article>
      ))}
    </section>
  );
}
