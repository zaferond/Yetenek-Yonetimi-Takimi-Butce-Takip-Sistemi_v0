import {
  Wallet,
  ReceiptText,
  CalendarClock,
  ChartNoAxesCombined,
  House,
  ShieldCheck,
} from "lucide-react";

export const modules = [
  {
    id: "budget",
    label: "Bütçe Planlama & Takip",
    shortLabel: "Bütçe planlama",
    description:
      "Gelişim yatırımlarınızı planlayın, gerçekleşen harcamalarınızı izleyin.",
    group: "Planlama",
    Icon: Wallet,
  },
  {
    id: "invoices",
    label: "Faturalar",
    shortLabel: "Faturalar",
    description:
      "Eğitim harcamalarını doğru bütçe kalemi ve dönemle ilişkilendirin.",
    group: "Harcama yönetimi",
    Icon: ReceiptText,
  },
  {
    id: "payments",
    label: "Planlı Ödemeler",
    shortLabel: "Planlı ödemeler",
    description:
      "Bekleyen ödemeleri ve faturalara dönüşen tutarları takip edin.",
    group: "Ödeme takibi",
    Icon: CalendarClock,
  },
  {
    id: "savings",
    label: "Versiyon & Tasarruf",
    shortLabel: "Versiyon & tasarruf",
    description:
      "Bütçe revizyonlarını karşılaştırın, tasarruf detaylarını ayrı izleyin.",
    group: "Değerlendirme",
    Icon: ChartNoAxesCombined,
  },
] as const;

export type WorkSection = (typeof modules)[number]["id"];
export type Section = "home" | "admin" | WorkSection;
export const navigation = [
  { id: "home", label: "Ana Sayfa", shortLabel: "Ana Sayfa", Icon: House },
  ...modules,
  { id: "admin", label: "Admin", shortLabel: "Admin", Icon: ShieldCheck },
] as const;
