// =====================================================
// Penyusun data ekspor keuangan (pendapatan & pengeluaran).
//
// Dipakai halaman admin → Economic Dashboard → tombol Ekspor.
// Satu sumber data untuk ketiga format (PDF, Excel, Word) supaya angka
// yang tampil di layar dan di file hasil ekspor selalu sama.
//
// Struktur data disusun BERKELOMPOK: periode (musim/tahun) → lahan → baris
// transaksi. Dengan begitu kolom "Musim" dan "Lahan" tidak perlu diulang di
// setiap baris — cukup ditegaskan pada judul kelompoknya — dan data antar
// lahan tidak tercampur. Setiap lahan punya subtotal, setiap periode punya
// total, dan seluruh cakupan punya total keseluruhan.
// =====================================================
import {
  expenses,
  revenues,
  seasonsByYear,
  getSeasonById,
  getFieldName,
} from "../../data";
import type { ExpenseCategory } from "../../types";

export type ExportFormat = "pdf" | "excel" | "word";

/** Jenis data yang diekspor. */
export type ExportKind = "both" | "revenue" | "expense";

/** Cakupan ekspor: seluruh waktu / satu musim (tahun), semua lahan / satu lahan. */
export type ExportOptions = {
  period: number | "all";
  fieldId: string | "all";
  kind: ExportKind;
};

/** Satu baris transaksi di dalam tabel sebuah lahan. */
export type ExportRow = {
  date: string;
  isRevenue: boolean;
  /** "Pendapatan" atau "Pengeluaran". */
  typeLabel: string;
  /** Kategori biaya (pengeluaran) atau nama produk (pendapatan). */
  category: string;
  description: string;
  amount: number;
};

export type ExportTotals = {
  revenue: number;
  expense: number;
  profit: number;
  /** Margin: untung / pendapatan × 100. */
  margin: number;
  /** ROI: untung / pengeluaran (modal) × 100. */
  roi: number;
  /** Jumlah baris transaksi yang tercetak. */
  count: number;
};

/** Kelompok satu lahan di dalam satu periode. */
export type ExportFieldGroup = {
  fieldId: string;
  fieldName: string;
  /** Musim yang tercakup, mis. ["MT1 2026 (Padi)"]. */
  seasonLabels: string[];
  rows: ExportRow[];
  totals: ExportTotals;
};

/** Kelompok satu periode (tahun tanam). */
export type ExportPeriodGroup = {
  year: number;
  label: string;
  fieldGroups: ExportFieldGroup[];
  totals: ExportTotals;
};

export type ExportDataset = {
  generatedAt: Date;
  periodLabel: string;
  fieldLabel: string;
  kindLabel: string;
  periods: ExportPeriodGroup[];
  totals: ExportTotals;
};

export const categoryLabelId: Record<ExpenseCategory, string> = {
  seeds: "Benih",
  fertilizer: "Pupuk",
  labor: "Tenaga Kerja",
  equipment: "Peralatan",
  irrigation: "Irigasi",
  pesticide: "Pestisida",
  logistics: "Logistik",
  rent: "Sewa",
  tax: "Pajak",
  other: "Lain-lain",
};

const kindLabelMap: Record<ExportKind, string> = {
  both: "Pendapatan & Pengeluaran",
  revenue: "Pendapatan saja",
  expense: "Pengeluaran saja",
};

const round1 = (n: number) => Math.round(n * 10) / 10;

const seasonLabelOf = (seasonId: string): string => {
  const s = getSeasonById(seasonId);
  return s ? `${s.label} (${s.crop})` : "Tanpa musim";
};

const yearOf = (seasonId: string): number => {
  const s = getSeasonById(seasonId);
  return s ? s.year : 0;
};

/** Baris internal: transaksi + konteks periode/lahan untuk pengelompokan. */
type Entry = ExportRow & {
  year: number;
  fieldId: string;
  seasonLabel: string;
};

/** Hitung total dari sekumpulan baris. */
function totalsOf(rows: Entry[] | ExportRow[]): ExportTotals {
  let revenue = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.isRevenue) revenue += row.amount;
    else expense += row.amount;
  }
  const profit = revenue - expense;
  return {
    revenue,
    expense,
    profit,
    margin: revenue > 0 ? round1((profit / revenue) * 100) : 0,
    roi: expense > 0 ? round1((profit / expense) * 100) : 0,
    count: rows.length,
  };
}

export function buildFinanceExport(opts: ExportOptions): ExportDataset {
  // Batasi ke musim pada periode terpilih (null = seluruh waktu).
  const periodSeasonIds =
    opts.period === "all"
      ? null
      : new Set(seasonsByYear(opts.period).map((s) => s.id));

  const inScope = (row: { seasonId: string; fieldId: string }) =>
    (periodSeasonIds === null || periodSeasonIds.has(row.seasonId)) &&
    (opts.fieldId === "all" || row.fieldId === opts.fieldId);

  const revenueEntries: Entry[] = revenues.filter(inScope).map((r) => ({
    date: r.date,
    isRevenue: true,
    typeLabel: "Pendapatan",
    category: r.product,
    description:
      r.quantityKg && r.pricePerKg
        ? `Penjualan ${r.quantityKg.toLocaleString("id-ID")} kg @ Rp ${Math.round(
            r.pricePerKg,
          ).toLocaleString("id-ID")}/kg`
        : r.quantityKg
          ? `Penjualan ${r.quantityKg.toLocaleString("id-ID")} kg`
          : `Penjualan ${r.product}`,
    amount: r.amount,
    year: yearOf(r.seasonId),
    fieldId: r.fieldId,
    seasonLabel: seasonLabelOf(r.seasonId),
  }));

  const expenseEntries: Entry[] = expenses.filter(inScope).map((e) => ({
    date: e.date,
    isRevenue: false,
    typeLabel: "Pengeluaran",
    category: categoryLabelId[e.category] ?? e.category,
    description: e.description,
    amount: e.amount,
    year: yearOf(e.seasonId),
    fieldId: e.fieldId,
    seasonLabel: seasonLabelOf(e.seasonId),
  }));

  const entries =
    opts.kind === "revenue"
      ? revenueEntries
      : opts.kind === "expense"
        ? expenseEntries
        : [...revenueEntries, ...expenseEntries];

  // --- Kelompokkan: periode → lahan ---
  const byYear = new Map<number, Entry[]>();
  for (const entry of entries) {
    const bucket = byYear.get(entry.year);
    if (bucket) bucket.push(entry);
    else byYear.set(entry.year, [entry]);
  }

  const periods: ExportPeriodGroup[] = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, yearEntries]) => {
      const byField = new Map<string, Entry[]>();
      for (const entry of yearEntries) {
        const bucket = byField.get(entry.fieldId);
        if (bucket) bucket.push(entry);
        else byField.set(entry.fieldId, [entry]);
      }

      const fieldGroups: ExportFieldGroup[] = [...byField.entries()]
        .map(([fieldId, fieldEntries]) => {
          const rows = [...fieldEntries].sort(
            (a, b) => +new Date(a.date) - +new Date(b.date),
          );
          const seasonLabels = [
            ...new Set(rows.map((r) => r.seasonLabel)),
          ].sort();
          return {
            fieldId,
            fieldName: getFieldName(fieldId),
            seasonLabels,
            rows: rows.map(
              ({ date, isRevenue, typeLabel, category, description, amount }) => ({
                date,
                isRevenue,
                typeLabel,
                category,
                description,
                amount,
              }),
            ),
            totals: totalsOf(rows),
          };
        })
        .sort((a, b) => a.fieldName.localeCompare(b.fieldName, "id"));

      return {
        year,
        label: year > 0 ? `Musim ${year}` : "Tanpa periode",
        fieldGroups,
        totals: totalsOf(yearEntries),
      };
    });

  return {
    generatedAt: new Date(),
    periodLabel:
      opts.period === "all" ? "Semua periode" : `Musim ${opts.period}`,
    fieldLabel:
      opts.fieldId === "all" ? "Semua lahan" : getFieldName(opts.fieldId),
    kindLabel: kindLabelMap[opts.kind],
    periods,
    totals: totalsOf(entries),
  };
}

// ---------- Format tampilan yang aman untuk file hasil ekspor ----------

/** "Rp 1.500.000" tanpa karakter spesial (aman untuk PDF, Excel & Word). */
export const rp = (v: number): string => {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(Math.round(v));
  return `Rp ${sign}${abs.toLocaleString("id-ID")}`;
};

export const num = (v: number): string => v.toLocaleString("id-ID");

/** Persen satu desimal: "12,5%". */
export const pct = (v: number): string =>
  `${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;

/** Tanggal ringkas: 25/08/2026. */
export const dmy = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** Timestamp lengkap untuk dicantumkan di dokumen. */
export const stamp = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${p(
    d.getHours(),
  )}.${p(d.getMinutes())}.${p(d.getSeconds())} WIB`;
};

/** Bagian nama file berbasis waktu: 2026-08-25_1042. */
export const stampSlug = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(
    d.getHours(),
  )}${p(d.getMinutes())}`;
};

/**
 * Nama file tanpa ekstensi, selalu diawali "taniku-".
 * Contoh: taniku-musim-2026-sawah-utara-2026-08-25_1042
 */
export function exportFileBase(
  data: ExportDataset,
  opts: ExportOptions,
): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [
    "taniku",
    opts.period === "all" ? "semua-periode" : `musim-${opts.period}`,
    opts.fieldId === "all" ? "semua-lahan" : slug(data.fieldLabel),
    stampSlug(data.generatedAt),
  ];
  return parts.join("-");
}
