import {
  fields,
  reports,
  expenses,
  revenues,
  seasonsByYear,
  fieldsByYear,
  getSeasonByFieldYear,
  getReportBySeason,
  getSeasonsByField,
  totalRevenueBySeason,
  totalExpensesBySeason,
  totalRevenueByYear,
  totalExpensesByYear,
  haFromM2,
  getAvailableYears,
  totalRevenue,
  totalExpenses,
} from "../../data";
import { deviationInfo } from "../../utils/harvest";

// Label kategori biaya dalam Bahasa Indonesia (dipakai di diagram Struktur Biaya).
const CATEGORY_LABEL_ID: Record<string, string> = {
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

// Pembulatan ringkas.
const round = (n: number, d = 0) => {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
};

// =====================================================
// Agregat per tahun (dasar perhitungan KPI)
// =====================================================
const yieldTonByYear = (year: number): number => {
  const ids = new Set(seasonsByYear(year).map((s) => s.id));
  return reports
    .filter((r) => ids.has(r.seasonId))
    .reduce((s, r) => s + r.yieldTon, 0);
};

const reportedM2ByYear = (year: number): number => {
  const ids = new Set(seasonsByYear(year).map((s) => s.id));
  const fids = new Set(
    reports.filter((r) => ids.has(r.seasonId)).map((r) => r.fieldId),
  );
  return Array.from(fids).reduce(
    (s, fid) => s + (fields.find((f) => f.id === fid)?.areaM2 ?? 0),
    0,
  );
};

// Produktivitas dalam kg/m² (1 ton = 1000 kg).
const yieldPerM2ByYear = (year: number): number => {
  const m2 = reportedM2ByYear(year);
  return m2 > 0 ? (yieldTonByYear(year) * 1000) / m2 : 0;
};

const marginByYear = (year: number): number => {
  const rev = totalRevenueByYear(year);
  const exp = totalExpensesByYear(year);
  return rev > 0 ? ((rev - exp) / rev) * 100 : 0;
};

// =====================================================
// KPI hero cards (nilai tahun terpilih + benchmark all-time + sparkline)
// =====================================================
export type KpiFormat = "rp" | "num" | "pct";

export type KpiItem = {
  key: string;
  label: string;
  unit?: string;
  format: KpiFormat;
  current: number;
  benchmark: number;
  benchmarkLabel: string;
  series: number[];
  /** Penjelasan singkat rumus/cara baca (tampil di kartu). */
  hint?: string;
  /** false bila nilai yang LEBIH KECIL justru lebih baik (mis. biaya). */
  higherIsBetter?: boolean;
  /** true bila datanya belum cukup untuk dihitung (tampil "—"). */
  empty?: boolean;
  /** true bila angka masih sementara karena musim belum selesai. */
  provisional?: boolean;
};

export function kpiSummary(year: number): KpiItem[] {
  const running = periodIsRunning(year);
  const years = getAvailableYears()
    .slice()
    .sort((a, b) => a - b);
  const prev = year - 1;
  // Total luas lahan dikelola (m²) pada tahun tertentu.
  const totalAreaM2 = (y: number) =>
    fieldsByYear(y).reduce((s, f) => s + f.areaM2, 0);
  // Margin bersih dalam Rupiah (pendapatan - pengeluaran) pada tahun tertentu.
  const marginRp = (y: number) =>
    totalRevenueByYear(y) - totalExpensesByYear(y);
  // Yield finansial: laba bersih dibagi modal (pengeluaran) tahun tsb.
  const yieldPct = (y: number) => {
    const exp = totalExpensesByYear(y);
    return exp > 0 ? (marginRp(y) / exp) * 100 : 0;
  };

  return [
    {
      key: "revenue",
      provisional: running,
      label: "Total Pendapatan",
      hint: "Seluruh uang masuk dari penjualan hasil panen",
      format: "rp",
      current: totalRevenueByYear(year),
      benchmark: totalRevenueByYear(prev),
      benchmarkLabel: "tahun sebelumnya",
      series: years.map((y) => totalRevenueByYear(y)),
    },
    {
      key: "expenses",
      label: "Pengeluaran",
      hint: "Seluruh biaya operasional musim ini",
      higherIsBetter: false,
      format: "rp",
      current: totalExpensesByYear(year),
      benchmark: totalExpensesByYear(prev),
      benchmarkLabel: "tahun sebelumnya",
      series: years.map((y) => totalExpensesByYear(y)),
    },
    {
      key: "marginRp",
      provisional: running,
      label: "Margin Bersih (Rp)",
      hint: "Pendapatan − pengeluaran",
      format: "rp",
      current: marginRp(year),
      benchmark: marginRp(prev),
      benchmarkLabel: "tahun sebelumnya",
      series: years.map((y) => marginRp(y)),
    },
    {
      key: "marginRpMonthly",
      provisional: running,
      label: "Estimasi Laba Bersih / Bulan",
      hint: "Laba bersih tahun ini ÷ 12 bulan",
      format: "rp",
      current: round(marginRp(year) / 12),
      benchmark: round(marginRp(prev) / 12),
      benchmarkLabel: "tahun sebelumnya",
      series: years.map((y) => round(marginRp(y) / 12)),
    },
    {
      key: "fields",
      label: "Total Luas Lahan Dikelola",
      hint: "Luas lahan yang punya musim tanam tahun ini",
      unit: "m²",
      format: "num",
      current: totalAreaM2(year),
      benchmark: totalAreaM2(prev),
      benchmarkLabel: "tahun sebelumnya",
      series: years.map((y) => totalAreaM2(y)),
    },
    {
      key: "margin",
      provisional: running,
      label: "Margin Bersih",
      hint: "Laba ÷ pendapatan. Berapa persen uang masuk yang jadi untung",
      unit: "%",
      format: "pct",
      current: round(marginByYear(year), 1),
      benchmark: round(marginByYear(prev), 1),
      benchmarkLabel: "tahun sebelumnya",
      series: years.map((y) => round(marginByYear(y), 1)),
    },
    {
      key: "yield",
      provisional: running,
      label: "ROI (Yield)",
      hint: "Laba ÷ modal. Untung per Rp 100 yang dikeluarkan",
      unit: "%",
      format: "pct",
      current: round(yieldPct(year), 1),
      benchmark: round(yieldPct(prev), 1),
      benchmarkLabel: "tahun sebelumnya",
      series: years.map((y) => round(yieldPct(y), 1)),
    },
  ];
}

// Akumulasi seluruh waktu (semua musim tercatat, termasuk yang belum panen).
export type AllTimeSummary = {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  roiPct: number;
};

export function allTimeSummary(): AllTimeSummary {
  const revenue = totalRevenue();
  const expenses = totalExpenses();
  const profit = revenue - expenses;
  return {
    revenue,
    expenses,
    profit,
    margin: revenue > 0 ? round((profit / revenue) * 100, 1) : 0,
    roiPct: expenses > 0 ? round((profit / expenses) * 100, 1) : 0,
  };
}

// Tren per tahun untuk grafik garis all-time: pendapatan, pengeluaran, laba
// bersih (Rp) + margin (%) yang saling bersinggungan sepanjang waktu.
export type AllTimeTrendRow = {
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  roi: number;
};

export function allTimeTrend(): AllTimeTrendRow[] {
  const years = getAvailableYears()
    .slice()
    .sort((a, b) => a - b);
  return years.map((y) => {
    const revenue = totalRevenueByYear(y);
    const expenses = totalExpensesByYear(y);
    const profit = revenue - expenses;
    return {
      year: y,
      revenue,
      expenses,
      profit,
      margin: revenue > 0 ? round((profit / revenue) * 100, 1) : 0,
      roi: expenses > 0 ? round((profit / expenses) * 100, 1) : 0,
    };
  });
}

// =====================================================
// Keuangan per lahan sepanjang waktu (all-time)
// Setiap baris = satu musim lahan tsb (unik per tahun), berisi pendapatan,
// pengeluaran, dan laba bersih. Dipakai grafik di modal detail lahan.
// =====================================================
export type FieldFinanceRow = {
  seasonId: string;
  year: number;
  label: string;
  crop: string;
  revenue: number;
  expenses: number;
  profit: number;
  /** Margin keuntungan periode ini: laba / pendapatan × 100. */
  margin: number;
  /** ROI periode ini: laba / pengeluaran (modal) × 100. */
  roi: number;
  /** ROI periode SEBELUMNYA (null pada periode pertama) — garis pembanding. */
  prevRoi: number | null;
  /** Selisih ROI terhadap periode sebelumnya, dalam poin persen. */
  roiDelta: number | null;
};

export function fieldFinanceTrend(fieldId: string): FieldFinanceRow[] {
  const base = getSeasonsByField(fieldId)
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((s) => {
      const revenue = totalRevenueBySeason(s.id);
      const expenses = totalExpensesBySeason(s.id);
      const profit = revenue - expenses;
      return {
        seasonId: s.id,
        year: s.year,
        label: s.label,
        crop: s.crop,
        revenue,
        expenses,
        profit,
        // Margin dihitung dari pendapatan; ROI dihitung dari modal (pengeluaran).
        // Bila pembagi 0 (mis. musim berjalan yang belum ada penjualan),
        // nilainya 0 agar grafik tidak menghasilkan Infinity/NaN.
        margin: revenue > 0 ? round((profit / revenue) * 100, 1) : 0,
        roi: expenses > 0 ? round((profit / expenses) * 100, 1) : 0,
      };
    });

  // Lampirkan ROI periode sebelumnya sebagai garis pembanding di grafik.
  return base.map((row, i) => {
    const prev = i > 0 ? base[i - 1] : undefined;
    const prevRoi = prev ? prev.roi : null;
    return {
      ...row,
      prevRoi,
      roiDelta: prevRoi === null ? null : round(row.roi - prevRoi, 1),
    };
  });
}

// =====================================================
// Produktivitas per lahan (kg/m²): aktual vs target
// =====================================================
export type YieldRow = {
  field: string;
  shortName: string;
  actual: number;
  target: number;
  harvested: boolean;
  status: string;
};

export function yieldByField(year: number): YieldRow[] {
  return fieldsByYear(year).map((field) => {
    const season = getSeasonByFieldYear(field.id, year);
    const rep = season ? getReportBySeason(season.id) : undefined;
    const m2 = field.areaM2;
    return {
      field: field.name,
      shortName: field.name.replace("Blok Tebu ", ""),
      actual: rep && m2 > 0 ? round((rep.yieldTon * 1000) / m2, 2) : 0,
      target: rep && m2 > 0 ? round((rep.targetTon * 1000) / m2, 2) : 0,
      harvested: !!rep && rep.yieldTon > 0,
      status: season?.status ?? "fallow",
    };
  });
}

// =====================================================
// Komposisi biaya: musim terpilih saja (donut tunggal)
// =====================================================
export type CostRow = {
  category: string;
  year: number;
  yearPct: number;
};

export function costComposition(year: number): {
  yearTotal: number;
  data: CostRow[];
} {
  const yIds = new Set(seasonsByYear(year).map((s) => s.id));
  const yexp = expenses.filter((e) => yIds.has(e.seasonId));
  const yTot = yexp.reduce((s, e) => s + e.amount, 0);
  const byCat = yexp.reduce<Record<string, number>>((m, e) => {
    m[e.category] = (m[e.category] ?? 0) + e.amount;
    return m;
  }, {});
  return {
    yearTotal: yTot,
    data: Object.keys(byCat)
      .map((category) => ({
        category: CATEGORY_LABEL_ID[category] ?? category,
        year: byCat[category] ?? 0,
        yearPct: yTot > 0 ? round(((byCat[category] ?? 0) / yTot) * 100) : 0,
      }))
      .sort((a, b) => b.year - a.year),
  };
}

// =====================================================
// P&L per lahan + margin rata-rata all-time (garis acuan)
// =====================================================
export type PnlRow = {
  field: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
};

export function pnlByField(year: number): {
  rows: PnlRow[];
  allTimeMargin: number;
} {
  const rows = fieldsByYear(year).map((field) => {
    const season = getSeasonByFieldYear(field.id, year);
    const revenue = season ? totalRevenueBySeason(season.id) : 0;
    const cost = season ? totalExpensesBySeason(season.id) : 0;
    return {
      field: field.name.replace("Blok Tebu ", ""),
      revenue,
      cost,
      profit: revenue - cost,
      margin: revenue > 0 ? round(((revenue - cost) / revenue) * 100, 1) : 0,
    };
  });
  const allRev = totalRevenue();
  const allExp = totalExpenses();
  return {
    rows,
    allTimeMargin:
      allRev > 0 ? round(((allRev - allExp) / allRev) * 100, 1) : 0,
  };
}

// =====================================================
// Durasi tanam–panen: deviasi hari aktualisasi vs perkiraan panen per lahan.
// Negatif = panen lebih cepat / belum jatuh tempo, Positif = telat (overdue).
// =====================================================
export type HarvestDeviationCategory =
  "cepat" | "sesuai" | "telat" | "berjalan";

export type HarvestDeviationRow = {
  field: string;
  shortName: string;
  deviationDays: number;
  category: HarvestDeviationCategory;
  harvested: boolean;
  detail: string;
};

export function harvestDeviationByField(
  year: number,
  now: Date = new Date(),
): HarvestDeviationRow[] {
  return fieldsByYear(year)
    .map((field): HarvestDeviationRow | null => {
      const season = getSeasonByFieldYear(field.id, year);
      if (!season) return null;
      const dev = deviationInfo(season, now);
      return {
        field: field.name,
        shortName: field.name.replace("Blok Tebu ", ""),
        deviationDays: dev.days,
        category: dev.category,
        harvested: season.status === "harvested",
        detail: dev.detail,
      };
    })
    .filter((r): r is HarvestDeviationRow => r !== null);
}


// =====================================================
// KPI TAMBAHAN: efisiensi & kelayakan usaha (dari pemasukan & pengeluaran)
// Sengaja diringkas jadi 3 indikator agar mudah dipahami.
// =====================================================
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

const rentByYear = (year: number): number => {
  const ids = new Set(seasonsByYear(year).map((s) => s.id));
  return expenses
    .filter((e) => ids.has(e.seasonId) && e.category === "rent")
    .reduce((s, e) => s + e.amount, 0);
};

// Musim dianggap "masih berjalan" bila belum berstatus panen selesai.
// Selama itu, pendapatan belum lengkap sehingga laba/rugi hanya sementara.
export function periodIsRunning(period: number | "all"): boolean {
  const list =
    period === "all"
      ? getAvailableYears().flatMap((y) => seasonsByYear(y))
      : seasonsByYear(period);
  return list.some((s) => s.status !== "harvested");
}

export function efficiencyKpis(year: number): KpiItem[] {
  const years = getAvailableYears()
    .slice()
    .sort((a, b) => a - b);
  const prev = year - 1;
  const rev = totalRevenueByYear;
  const exp = totalExpensesByYear;
  const running = periodIsRunning(year);

  const rc = (y: number) => safeDiv(rev(y), exp(y));
  const expenseRatio = (y: number) => safeDiv(exp(y), rev(y)) * 100;
  const rentShare = (y: number) => safeDiv(rentByYear(y), exp(y)) * 100;

  const mk = (
    k: Omit<KpiItem, "series" | "benchmarkLabel" | "current" | "benchmark">,
    fn: (y: number) => number,
    digits = 0,
    empty = false,
  ): KpiItem => ({
    ...k,
    benchmarkLabel: "tahun sebelumnya",
    current: round(fn(year), digits),
    benchmark: round(fn(prev), digits),
    series: years.map((y) => round(fn(y), digits)),
    empty,
  });

  return [
    mk(
      {
        key: "rc",
        label: "Rasio R/C",
        unit: "×",
        format: "num",
        provisional: running,
        hint: "Pendapatan ÷ biaya. Di atas 1 berarti untung",
      },
      rc,
      2,
    ),
    mk(
      {
        key: "expenseRatio",
        label: "Rasio Biaya",
        unit: "%",
        format: "pct",
        higherIsBetter: false,
        provisional: running,
        hint: "Biaya ÷ pendapatan. Makin kecil makin efisien",
      },
      expenseRatio,
      1,
      rev(year) <= 0,
    ),
    mk(
      {
        key: "rentShare",
        label: "Beban Sewa",
        unit: "%",
        format: "pct",
        higherIsBetter: false,
        hint: "Porsi biaya sewa lahan dari total biaya",
      },
      rentShare,
      1,
    ),
  ];
}

// =====================================================
// Rekap per tahun (pemasukan & pengeluaran tiap tahun)
// =====================================================
export type YearlyRow = {
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  roi: number;
  rc: number;
  /** Perubahan % dibanding tahun sebelumnya (null bila tidak ada pembanding). */
  revenueGrowth: number | null;
  expenseGrowth: number | null;
  cumRevenue: number;
  cumExpenses: number;
};

export function yearlySummary(): YearlyRow[] {
  const years = getAvailableYears()
    .slice()
    .sort((a, b) => a - b);
  let cumRev = 0;
  let cumExp = 0;
  return years.map((year, i) => {
    const revenue = totalRevenueByYear(year);
    const exp = totalExpensesByYear(year);
    const profit = revenue - exp;
    cumRev += revenue;
    cumExp += exp;
    const prevRev = i > 0 ? totalRevenueByYear(years[i - 1]) : 0;
    const prevExp = i > 0 ? totalExpensesByYear(years[i - 1]) : 0;
    return {
      year,
      revenue,
      expenses: exp,
      profit,
      margin: round(safeDiv(profit, revenue) * 100, 1),
      roi: round(safeDiv(profit, exp) * 100, 1),
      rc: round(safeDiv(revenue, exp), 2),
      revenueGrowth:
        i > 0 && prevRev > 0 ? round(((revenue - prevRev) / prevRev) * 100, 1) : null,
      expenseGrowth:
        i > 0 && prevExp > 0 ? round(((exp - prevExp) / prevExp) * 100, 1) : null,
      cumRevenue: cumRev,
      cumExpenses: cumExp,
    };
  });
}

// Struktur biaya per kategori tiap tahun (untuk batang bertumpuk).
export function costByYear(): {
  keys: string[];
  data: Array<Record<string, number>>;
} {
  const years = getAvailableYears()
    .slice()
    .sort((a, b) => a - b);
  const totals: Record<string, number> = {};
  const perYear = years.map((year) => {
    const ids = new Set(seasonsByYear(year).map((s) => s.id));
    const row: Record<string, number> = { year };
    for (const e of expenses) {
      if (!ids.has(e.seasonId)) continue;
      const label = CATEGORY_LABEL_ID[e.category] ?? e.category;
      row[label] = (row[label] ?? 0) + e.amount;
      totals[label] = (totals[label] ?? 0) + e.amount;
    }
    return row;
  });
  const keys = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  return {
    keys,
    data: perYear.map((row) => {
      const full: Record<string, number> = { year: row.year };
      for (const k of keys) full[k] = row[k] ?? 0;
      return full;
    }),
  };
}

// Arus kas bulanan untuk satu musim-tahun, berurutan kronologis.
export type CashflowRow = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  net: number;
  cumulative: number;
};

const MONTH_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

export function monthlyCashflow(year: number): CashflowRow[] {
  const ids = new Set(seasonsByYear(year).map((s) => s.id));
  const buckets = new Map<string, { revenue: number; expenses: number }>();
  const add = (date: string, kind: "revenue" | "expenses", amount: number) => {
    const key = String(date).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) return;
    const b = buckets.get(key) ?? { revenue: 0, expenses: 0 };
    b[kind] += amount;
    buckets.set(key, b);
  };
  for (const e of expenses) if (ids.has(e.seasonId)) add(e.date, "expenses", e.amount);
  for (const r of revenues) if (ids.has(r.seasonId)) add(r.date, "revenue", r.amount);
  const keys = Array.from(buckets.keys()).sort();
  if (!keys.length) return [];

  // Isi bulan kosong di antara bulan pertama dan terakhir.
  const [y0, m0] = keys[0].split("-").map(Number);
  const [y1, m1] = keys[keys.length - 1].split("-").map(Number);
  const out: CashflowRow[] = [];
  let cumulative = 0;
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); ) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { revenue: 0, expenses: 0 };
    const net = b.revenue - b.expenses;
    cumulative += net;
    out.push({
      key,
      label: `${MONTH_ID[m - 1]} ${String(y).slice(2)}`,
      revenue: b.revenue,
      expenses: b.expenses,
      net,
      cumulative,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
