import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiX,
  FiMapPin,
  FiCalendar,
  FiActivity,
  FiDollarSign,
  FiImage,
  FiBookOpen,
  FiGrid,
  FiInfo,
  FiHome,
  FiMaximize2,
} from "react-icons/fi";
import type { Field, GalleryItem, Season } from "../../types";
import { fieldStatusMeta } from "../constants/fieldMeta";
import {
  getActivitiesBySeason,
  getExpensesBySeason,
  getGalleryBySeason,
  getReportBySeason,
  getDecisionsBySeason,
  getPracticesBySeason,
  getMonitorsBySeason,
  totalExpensesBySeason,
  totalRevenueBySeason,
  haFromM2,
  getFieldById,
  getSeasonsByField,
  getSeasonById,
} from "../../data";
import {
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  formatNumber,
} from "../../utils/format";
import { WeatherBadge } from "./WeatherBadge";
import { FieldFinanceChart } from "./Charts";
import { fieldFinanceTrend } from "../utils/analytics";
import {
  deviationInfo,
  growthProgress,
  humanDuration,
  rentalScheduleImpact,
} from "../../utils/harvest";
import { normalizeImageUrl } from "../../utils/image";

// ---------- Animasi ----------
const overlayHidden = { opacity: 0 };
const overlayShown = { opacity: 1 };
const overlayTransition = { duration: 0.2 };

const panelHidden = { opacity: 0, y: 28, scale: 0.98 };
const panelShown = { opacity: 1, y: 0, scale: 1 };
const panelExit = { opacity: 0, y: 18, scale: 0.98 };
const panelTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

const tabHidden = { opacity: 0, y: 6 };
const tabShown = { opacity: 1, y: 0 };
const tabTransition = { duration: 0.2 };

const barStyle = (pct: number) => ({
  width: `${Math.min(100, Math.max(0, pct))}%`,
});

// ---------- Label ----------
const ownershipLabel: Record<string, string> = {
  owned: "Milik sendiri",
  rental: "Sewa",
};

const expenseCategoryLabel: Record<string, string> = {
  seeds: "Benih",
  fertilizer: "Pupuk",
  labor: "Tenaga kerja",
  equipment: "Peralatan",
  irrigation: "Irigasi",
  pesticide: "Pestisida",
  logistics: "Logistik",
  rent: "Sewa",
  other: "Lain-lain",
  tax: "Pajak",
};

const activityToneMap: Record<string, string> = {
  completed: "bg-leaf-50 text-leaf-700 ring-leaf-600/20",
  "in-progress": "bg-amber-50 text-amber-700 ring-amber-600/20",
  planned: "bg-tulus-50 text-tulus-700 ring-tulus-600/20",
};
const activityStatusLabel: Record<string, string> = {
  completed: "Selesai",
  "in-progress": "Berjalan",
  planned: "Rencana",
};

// Kartu netral: dipatok eksplisit (bukan bg-slate-50) supaya tidak tertimpa
// aturan .dark-surface dan tetap terbaca di mode gelap.
const CARD = "rounded-xl bg-[#f8fafc] dark:bg-white/[0.05]";

const devCalloutClass: Record<string, string> = {
  cepat: "bg-leaf-50 text-leaf-700",
  sesuai: `${CARD} text-ink-muted`,
  telat: "bg-red-50 text-red-700",
  berjalan: "bg-tulus-50 text-tulus-700",
};

const impactLabel: Record<string, string> = {
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};

// =====================================================
// Blok UI kecil
// =====================================================
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function Block({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="py-5 first:pt-0 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-slate-100 dark:[&:not(:first-child)]:border-white/10">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-tulus-900 dark:text-white">
          {title}
        </h3>
        {aside ? <div className="text-xs text-ink-muted">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className={`${CARD} px-4 py-8 text-center text-sm text-ink-muted`}>
      {children}
    </p>
  );
}

function Chip({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

// =====================================================
// Modal
// =====================================================
export function FieldDetailModal({
  open,
  field,
  season,
  onClose,
}: {
  open: boolean;
  field: Field | null;
  season: Season | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const ready = open && field && season;

  return (
    <AnimatePresence>
      {ready ? (
        <motion.div
          key="field-modal"
          initial={overlayHidden}
          animate={overlayShown}
          exit={overlayHidden}
          transition={overlayTransition}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Detail ${field.name}`}
        >
          <motion.div
            initial={panelHidden}
            animate={panelShown}
            exit={panelExit}
            transition={panelTransition}
            onClick={(e) => e.stopPropagation()}
            className="dark-surface flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-[#1c1c1c] sm:h-[min(780px,88vh)] sm:rounded-3xl"
          >
            <ModalBody field={field} season={season} onClose={onClose} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

type TabId = "ringkasan" | "keuangan" | "aktivitas" | "galeri" | "catatan";

function ModalBody({
  field: fieldProp,
  season: seasonProp,
  onClose,
}: {
  field: Field;
  season: Season;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("ringkasan");
  const [photo, setPhoto] = useState<GalleryItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  // Ambil ulang data live (by id) agar perubahan admin langsung tercermin.
  const field = getFieldById(fieldProp.id) ?? fieldProp;
  const season = getSeasonById(seasonProp.id) ?? seasonProp;
  const meta = fieldStatusMeta[season.status];
  const isLive = season.status === "active";
  const dev = deviationInfo(season);
  const acts = getActivitiesBySeason(season.id);
  const exps = getExpensesBySeason(season.id);
  const galleryItems = getGalleryBySeason(season.id);
  const report = getReportBySeason(season.id);
  const seasonDecisions = getDecisionsBySeason(season.id);
  const seasonPractices = getPracticesBySeason(season.id);
  const monitors = getMonitorsBySeason(season.id);
  const latestMonitor = monitors[monitors.length - 1];
  const expenseTotal = totalExpensesBySeason(season.id);
  const revenueTotal = totalRevenueBySeason(season.id);

  // Riwayat keuangan lahan sepanjang waktu (semua musim/tahun).
  const financeTrend = fieldFinanceTrend(season.fieldId);
  const financeTotals = financeTrend.reduce(
    (acc, r) => {
      acc.revenue += r.revenue;
      acc.expenses += r.expenses;
      return acc;
    },
    { revenue: 0, expenses: 0 },
  );
  const financeProfit = financeTotals.revenue - financeTotals.expenses;
  const financeRoi =
    financeTotals.expenses > 0
      ? Math.round((financeProfit / financeTotals.expenses) * 1000) / 10
      : 0;
  const financePer1000 =
    financeTotals.expenses > 0
      ? Math.round((financeProfit / financeTotals.expenses) * 1000)
      : 0;

  const progressPct = growthProgress(season);
  const overdue = progressPct > 100;

  // Biaya sewa efektif musim ini mengikuti pengeluaran kategori "rent".
  const seasonRentExpense = exps
    .filter((e) => e.category === "rent")
    .reduce((sum, e) => sum + e.amount, 0);
  const scheduleImpact = rentalScheduleImpact(
    { ...field, rentalCost: seasonRentExpense || field.rentalCost },
    season,
  );
  // Laba bersih = laba operasional murni; dampak sewa ditampilkan terpisah.
  const operationalProfit = revenueTotal - expenseTotal;
  const netProfit = operationalProfit;

  // Linimasa gabungan: aktivitas lapangan + rincian pengeluaran.
  const timeline = [
    ...acts.map((a) => ({ kind: "activity" as const, date: a.date, data: a })),
    ...exps.map((e) => ({ kind: "expense" as const, date: e.date, data: e })),
  ].sort((a, b) => {
    const d = +new Date(b.date) - +new Date(a.date);
    return d !== 0 ? d : a.data.id.localeCompare(b.data.id);
  });

  const expenseByCat = exps.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});
  const catEntries = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1]);

  // Perbandingan biaya per kategori vs MUSIM SEBELUMNYA di lahan yang sama.
  const prevSeason = getSeasonsByField(season.fieldId)
    .filter((s) => +new Date(s.plantingDate) < +new Date(season.plantingDate))
    .sort((a, b) => +new Date(b.plantingDate) - +new Date(a.plantingDate))[0];
  const prevExpenseByCat: Record<string, number> = {};
  if (prevSeason) {
    for (const e of getExpensesBySeason(prevSeason.id)) {
      prevExpenseByCat[e.category] =
        (prevExpenseByCat[e.category] ?? 0) + e.amount;
    }
  }
  const catDelta = (category: string, amount: number) => {
    if (!prevSeason) return null;
    const prev = prevExpenseByCat[category];
    if (prev === undefined || prev === 0) return { isNew: true, pct: 0 };
    return { isNew: false, pct: Math.round(((amount - prev) / prev) * 100) };
  };

  const noteCount = seasonDecisions.length + seasonPractices.length;
  const tabs: Array<{
    id: TabId;
    label: string;
    icon: typeof FiInfo;
    count?: number;
  }> = [
    { id: "ringkasan", label: "Ringkasan", icon: FiGrid },
    { id: "keuangan", label: "Keuangan", icon: FiDollarSign },
    {
      id: "aktivitas",
      label: "Aktivitas",
      icon: FiActivity,
      count: timeline.length,
    },
    {
      id: "galeri",
      label: "Galeri",
      icon: FiImage,
      count: galleryItems.length,
    },
    { id: "catatan", label: "Catatan", icon: FiBookOpen, count: noteCount },
  ];

  return (
    <>
      {/* ---------- Header ---------- */}
      <div className="relative shrink-0 bg-gradient-to-br from-tulus-50/80 to-white px-6 pt-6 dark:from-[#202020] dark:to-[#1c1c1c] sm:px-8">
        <button
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white text-ink-muted ring-1 ring-slate-200 transition hover:text-ink dark:bg-white/10 dark:ring-white/15"
        >
          <FiX size={18} />
        </button>

        <div className="flex flex-wrap items-center gap-2 pr-12">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${meta.className}`}
          >
            {isLive ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-leaf-500" />
              </span>
            ) : (
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            )}
            {isLive ? `${meta.label} · Live` : meta.label}
          </span>
          <WeatherBadge bmkgCode={field.bmkgCode} seed={field.location} />
        </div>
        <h2 className="mt-3 pr-12 font-display text-2xl font-semibold text-tulus-900 dark:text-white">
          {field.name}
        </h2>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
          <FiMapPin size={13} /> {field.location} · {season.label}
        </p>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Bagian detail lahan"
          className="-mx-2 mt-5 flex gap-1 overflow-x-auto scrollbar-thin sm:-mx-3"
        >
          {tabs.map((t) => {
            const active = t.id === tab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`relative inline-flex shrink-0 items-center gap-1.5 px-3 pb-3 pt-1 text-sm font-medium transition ${
                  active
                    ? "text-tulus-700 dark:text-[#8fbdf0]"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon size={14} />
                {t.label}
                {t.count ? (
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-semibold leading-4 ${
                      active
                        ? "bg-tulus-100 text-tulus-700 dark:bg-[#5E9FE8]/20 dark:text-[#8fbdf0]"
                        : "bg-slate-100 text-ink-muted dark:bg-white/10"
                    }`}
                  >
                    {t.count}
                  </span>
                ) : null}
                {active ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-tulus-600 dark:bg-[#5E9FE8]" />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="-mx-6 h-px bg-slate-200 dark:bg-white/10 sm:-mx-8" />
      </div>

      {/* ---------- Konten tab ---------- */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin"
      >
        <motion.div
          key={tab}
          initial={tabHidden}
          animate={tabShown}
          transition={tabTransition}
          className="px-6 py-6 sm:px-8"
        >
          {/* ===================== RINGKASAN ===================== */}
          {tab === "ringkasan" ? (
            <>
              <Block title="Progress musim">
                <div className={`${CARD} p-4 sm:p-5`}>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-ink-muted">
                        Pertumbuhan menuju panen
                      </p>
                      <p
                        className={`mt-1 font-display text-4xl font-medium leading-none ${
                          overdue
                            ? "text-red-600"
                            : "text-tulus-700 dark:text-[#8fbdf0]"
                        }`}
                      >
                        {formatNumber(progressPct)}%
                      </p>
                    </div>
                    <p className="text-right text-xs text-ink-muted">
                      {season.crop}
                    </p>
                  </div>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all ${
                        overdue
                          ? "bg-red-500"
                          : "bg-tulus-600 dark:bg-[#5E9FE8]"
                      }`}
                      style={barStyle(progressPct)}
                    />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Fact
                      label="Tanam"
                      value={formatDate(season.plantingDate)}
                    />
                    <Fact
                      label="Perkiraan panen"
                      value={formatDate(season.harvestDate)}
                    />
                    {season.actualHarvestDate ? (
                      <Fact
                        label="Panen aktual"
                        value={formatDate(season.actualHarvestDate)}
                      />
                    ) : null}
                  </dl>
                </div>

                <div
                  className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${devCalloutClass[dev.category]}`}
                >
                  {dev.detail}
                  {season.harvestNote ? (
                    <span className="mt-1 block font-normal opacity-90">
                      {season.harvestNote}
                    </span>
                  ) : null}
                </div>
                {progressPct !== 100 ? (
                  <p className="mt-2 px-1 text-xs leading-relaxed text-ink-muted">
                    {season.status === "harvested"
                      ? dev.days > 0
                        ? `Di atas 100% karena panen mundur ${humanDuration(dev.days)} dari perkiraan.`
                        : `Di bawah 100% karena panen ${humanDuration(Math.abs(dev.days))} lebih cepat dari perkiraan.`
                      : dev.days > 0
                        ? `Melewati perkiraan panen ${humanDuration(dev.days)} (overdue). Progress dihitung dari tanggal.`
                        : `${humanDuration(Math.abs(dev.days))} lagi menuju perkiraan panen. Progress dihitung dari tanggal.`}
                  </p>
                ) : null}
              </Block>

              {report ? (
                <Block title="Hasil panen">
                  {(() => {
                    const pct =
                      report.targetTon > 0
                        ? Math.round((report.yieldTon / report.targetTon) * 100)
                        : 0;
                    return (
                      <div className={`${CARD} p-4 sm:p-5`}>
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="font-display text-3xl font-medium leading-none text-ink">
                              {formatNumber(report.yieldTon)}
                              <span className="ml-1 text-base font-normal text-ink-muted">
                                ton
                              </span>
                            </p>
                            <p className="mt-1.5 text-xs text-ink-muted">
                              dari target {formatNumber(report.targetTon)} ton
                            </p>
                          </div>
                          <span
                            className={`text-sm font-semibold ${
                              pct >= 100
                                ? "text-leaf-700"
                                : "text-tulus-700 dark:text-[#8fbdf0]"
                            }`}
                          >
                            {pct}% target
                          </span>
                        </div>
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-leaf-500 dark:bg-[#72BC8F]"
                            style={barStyle(pct)}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </Block>
              ) : null}

              <Block title="Informasi lahan">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
                  <Fact
                    label="Luas"
                    value={`${formatNumber(field.areaM2)} m² · ${formatNumber(haFromM2(field.areaM2))} ha`}
                  />
                  <Fact
                    label="Kepemilikan"
                    value={ownershipLabel[field.ownership]}
                  />
                  {field.ownership === "rental" && field.rentalCost ? (
                    <Fact
                      label="Biaya sewa"
                      value={formatCompactCurrency(field.rentalCost)}
                    />
                  ) : null}
                  <Fact label="Kondisi tanah" value={field.soilType} />
                  <Fact label="Komoditas" value={season.crop} />
                  {latestMonitor ? (
                    <Fact
                      label="Skor kesehatan"
                      value={`${latestMonitor.healthScore}/100`}
                    />
                  ) : null}
                </dl>
                {field.notes || season.notes ? (
                  <div className="mt-5 space-y-2">
                    {[field.notes, season.notes]
                      .filter((n): n is string => Boolean(n))
                      .map((n) => (
                        <p
                          key={n}
                          className="border-l-2 border-tulus-200 pl-3 text-sm leading-relaxed text-ink-muted dark:border-white/15"
                        >
                          {n}
                        </p>
                      ))}
                  </div>
                ) : null}
              </Block>
            </>
          ) : null}

          {/* ===================== KEUANGAN ===================== */}
          {tab === "keuangan" ? (
            <>
              <Block title={`Keuangan ${season.label}`}>
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  <div className={`${CARD} px-3.5 py-3`}>
                    <p className="text-xs text-ink-muted">Pendapatan</p>
                    <p className="mt-1 font-display text-base font-semibold text-ink sm:text-lg">
                      {formatCompactCurrency(revenueTotal)}
                    </p>
                  </div>
                  <div className={`${CARD} px-3.5 py-3`}>
                    <p className="text-xs text-ink-muted">Biaya</p>
                    <p className="mt-1 font-display text-base font-semibold text-ink sm:text-lg">
                      {formatCompactCurrency(expenseTotal)}
                    </p>
                  </div>
                  <div
                    className={`rounded-xl px-3.5 py-3 ${
                      netProfit >= 0 ? "bg-leaf-50" : "bg-red-50"
                    }`}
                  >
                    <p
                      className={`text-xs ${netProfit >= 0 ? "text-leaf-700" : "text-red-700"}`}
                    >
                      {netProfit >= 0 ? "Laba bersih" : "Rugi bersih"}
                    </p>
                    <p
                      className={`mt-1 font-display text-base font-semibold sm:text-lg ${
                        netProfit >= 0 ? "text-leaf-700" : "text-red-600"
                      }`}
                    >
                      {formatCompactCurrency(netProfit)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 px-1 text-xs text-ink-muted">
                  Laba bersih = pendapatan − biaya operasional musim ini (
                  {formatCurrency(netProfit)}).
                </p>

                {/* Satu callout konteks, tergantung kepemilikan & hasil */}
                {field.ownership === "rental" ? (
                  <div
                    className={`mt-4 rounded-xl px-4 py-3 ${
                      scheduleImpact.category === "telat"
                        ? "bg-red-50"
                        : "bg-leaf-50"
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      <FiHome size={14} className="text-tulus-600" />
                      Lahan sewa · {scheduleImpact.label}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {scheduleImpact.detail}
                    </p>
                    {scheduleImpact.amount > 0 ? (
                      <p className="mt-2 text-sm font-semibold text-red-600">
                        Estimasi kerugian sewa:{" "}
                        {formatCurrency(scheduleImpact.amount)}
                        <span className="ml-1 font-normal text-ink-muted">
                          (
                          {formatCurrency(Math.round(scheduleImpact.dailyRent))}
                          /hari × {scheduleImpact.overdueDays} hari)
                        </span>
                      </p>
                    ) : scheduleImpact.savingAmount > 0 ? (
                      <p className="mt-2 text-sm font-semibold text-leaf-700">
                        Estimasi keuntungan sewa: +
                        {formatCurrency(scheduleImpact.savingAmount)}
                        <span className="ml-1 font-normal text-ink-muted">
                          (
                          {formatCurrency(Math.round(scheduleImpact.dailyRent))}
                          /hari × {scheduleImpact.fasterDays} hari lebih cepat)
                        </span>
                      </p>
                    ) : (
                      <p className="mt-2 text-sm font-medium text-leaf-700">
                        Tidak ada selisih biaya sewa untuk periode ini.
                      </p>
                    )}
                    {scheduleImpact.amount > 0 ||
                    scheduleImpact.savingAmount > 0 ? (
                      <p className="mt-2 text-xs text-ink-muted">
                        Dampak sewa ditampilkan terpisah dan belum termasuk
                        dalam laba bersih di atas.
                      </p>
                    ) : null}
                  </div>
                ) : operationalProfit < 0 ? (
                  <div className="mt-4 rounded-xl bg-red-50 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-red-700">
                      <FiInfo size={14} />
                      Lahan milik sendiri — periode ini merugi
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Pendapatan ({formatCurrency(revenueTotal)}) lebih kecil
                      dari total biaya ({formatCurrency(expenseTotal)}).
                      {catEntries.length
                        ? ` Biaya terbesar: ${expenseCategoryLabel[catEntries[0][0]] ?? catEntries[0][0]} (${formatCurrency(catEntries[0][1])}).`
                        : ""}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-leaf-50 px-4 py-3">
                    <p className="text-sm font-medium text-leaf-700">
                      Lahan milik sendiri — periode ini untung, tanpa beban
                      sewa.
                    </p>
                  </div>
                )}
              </Block>

              <Block
                title="Biaya per kategori"
                aside={
                  prevSeason ? `Perubahan vs ${prevSeason.label}` : undefined
                }
              >
                {catEntries.length ? (
                  <ul className="space-y-4">
                    {catEntries.map(([category, amount]) => {
                      const d = catDelta(category, amount);
                      const share =
                        expenseTotal > 0 ? (amount / expenseTotal) * 100 : 0;
                      return (
                        <li key={category}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2">
                              <span className="font-medium text-ink">
                                {expenseCategoryLabel[category] ?? category}
                              </span>
                              {d && !d.isNew && d.pct !== 0 ? (
                                <span
                                  className={`text-[11px] font-medium ${
                                    d.pct > 0
                                      ? "text-red-600"
                                      : "text-emerald-600"
                                  }`}
                                >
                                  {d.pct > 0 ? "▲" : "▼"} {Math.abs(d.pct)}%
                                </span>
                              ) : null}
                              {d?.isNew ? (
                                <span className="text-[11px] font-medium text-slate-400">
                                  baru
                                </span>
                              ) : null}
                            </span>
                            <span className="whitespace-nowrap text-ink-muted">
                              <span className="font-medium text-ink">
                                {formatCurrency(amount)}
                              </span>{" "}
                              · {Math.round(share)}%
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                            <div
                              className="h-full rounded-full bg-tulus-600 dark:bg-[#5E9FE8]"
                              style={barStyle(share)}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Empty>Belum ada biaya tercatat.</Empty>
                )}
              </Block>

              <Block title="Riwayat keuangan lahan" aside="Semua musim">
                {financeTrend.length ? (
                  <>
                    <p className="text-sm leading-relaxed text-ink-muted">
                      Modal lahan ini{" "}
                      <b className="font-semibold text-ink">
                        {formatCurrency(financeTotals.expenses)}
                      </b>{" "}
                      dengan return{" "}
                      <b className="font-semibold text-ink">
                        {formatCurrency(financeTotals.revenue)}
                      </b>
                      , jadi {financeProfit < 0 ? "masih rugi" : "profit"}{" "}
                      <b
                        className={`font-semibold ${
                          financeProfit < 0 ? "text-red-600" : "text-leaf-700"
                        }`}
                      >
                        {formatCurrency(Math.abs(financeProfit))}
                      </b>
                      .
                      {financeTotals.expenses > 0
                        ? ` Setiap Rp 1.000 modal ${
                            financePer1000 < 0
                              ? "berkurang sekitar"
                              : "menghasilkan sekitar"
                          } ${formatCurrency(Math.abs(financePer1000))}.`
                        : ""}
                    </p>

                    <dl
                      className={`${CARD} mt-4 grid grid-cols-2 divide-slate-200 py-3 sm:grid-cols-4 sm:divide-x dark:divide-white/10`}
                    >
                      {[
                        {
                          label: "Uang masuk",
                          value: formatCompactCurrency(financeTotals.revenue),
                          tone: "text-ink",
                        },
                        {
                          label: "Uang keluar",
                          value: formatCompactCurrency(financeTotals.expenses),
                          tone: "text-ink",
                        },
                        {
                          label: financeProfit < 0 ? "Rugi" : "Untung",
                          value: formatCompactCurrency(financeProfit),
                          tone:
                            financeProfit < 0
                              ? "text-red-600"
                              : "text-leaf-700",
                        },
                        {
                          label: "ROI",
                          value: `${formatNumber(financeRoi)}%`,
                          tone:
                            financeRoi < 0 ? "text-red-600" : "text-leaf-700",
                        },
                      ].map((s) => (
                        <div key={s.label} className="px-4 py-2">
                          <dt className="text-[11px] uppercase tracking-wide text-ink-muted">
                            {s.label}
                          </dt>
                          <dd
                            className={`mt-1 font-display text-lg font-semibold ${s.tone}`}
                          >
                            {s.value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-5">
                      <FieldFinanceChart data={financeTrend} />
                    </div>
                  </>
                ) : (
                  <Empty>Belum ada data keuangan untuk lahan ini.</Empty>
                )}
              </Block>
            </>
          ) : null}

          {/* ===================== AKTIVITAS ===================== */}
          {tab === "aktivitas" ? <ActivityTab timeline={timeline} /> : null}

          {/* ===================== GALERI ===================== */}
          {tab === "galeri" ? (
            galleryItems.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {galleryItems.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setPhoto(g)}
                    aria-label={`Perbesar foto: ${g.title}`}
                    className="group block text-left focus:outline-none"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 transition group-hover:ring-tulus-300 group-focus-visible:ring-2 group-focus-visible:ring-tulus-500 dark:bg-white/5 dark:ring-white/10">
                      <img
                        src={normalizeImageUrl(g.imageUrl)}
                        alt={g.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                      />
                      <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-tulus-700 opacity-0 shadow transition group-hover:opacity-100">
                        <FiMaximize2 size={13} strokeWidth={2.5} />
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-ink">
                      {g.title}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {g.stage ? `${g.stage} · ` : ""}
                      {formatDate(g.date)}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <Empty>Belum ada dokumentasi.</Empty>
            )
          ) : null}

          {/* ===================== CATATAN ===================== */}
          {tab === "catatan" ? (
            <>
              <Block
                title="Keputusan"
                aside={
                  seasonDecisions.length
                    ? `${seasonDecisions.length} catatan`
                    : undefined
                }
              >
                {seasonDecisions.length ? (
                  <ul className="space-y-3">
                    {seasonDecisions.map((d) => {
                      const hasDetail = d.context || d.rationale || d.outcome;
                      return (
                        <li
                          key={d.id}
                          className="rounded-xl border border-slate-200 px-4 py-3.5 dark:border-white/10"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-ink">
                              {d.title}
                            </p>
                            <span className="shrink-0 text-xs text-ink-muted">
                              {formatDate(d.date)}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                            {d.decision}
                          </p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                            <Chip className="bg-slate-100 text-slate-600 ring-slate-500/20">
                              Dampak {impactLabel[d.impact] ?? d.impact}
                            </Chip>
                            <span>oleh {d.decidedBy}</span>
                          </div>
                          {hasDetail ? (
                            <details className="group mt-3 border-t border-slate-100 pt-2.5 dark:border-white/10">
                              <summary className="cursor-pointer list-none text-xs font-medium text-tulus-700 marker:hidden dark:text-[#8fbdf0]">
                                <span className="group-open:hidden">
                                  Lihat konteks, alasan &amp; hasil
                                </span>
                                <span className="hidden group-open:inline">
                                  Sembunyikan detail
                                </span>
                              </summary>
                              <dl className="mt-2.5 space-y-2 text-xs leading-relaxed text-ink-muted">
                                {d.context ? (
                                  <div>
                                    <dt className="font-semibold text-ink-soft">
                                      Konteks
                                    </dt>
                                    <dd>{d.context}</dd>
                                  </div>
                                ) : null}
                                {d.rationale ? (
                                  <div>
                                    <dt className="font-semibold text-ink-soft">
                                      Alasan
                                    </dt>
                                    <dd>{d.rationale}</dd>
                                  </div>
                                ) : null}
                                {d.outcome ? (
                                  <div>
                                    <dt className="font-semibold text-ink-soft">
                                      Hasil
                                    </dt>
                                    <dd>{d.outcome}</dd>
                                  </div>
                                ) : null}
                              </dl>
                            </details>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <Empty>Belum ada keputusan tercatat.</Empty>
                )}
              </Block>

              <Block
                title="Praktik lapangan"
                aside={
                  seasonPractices.length
                    ? `${seasonPractices.length} SOP`
                    : undefined
                }
              >
                {seasonPractices.length ? (
                  <ul className="space-y-3">
                    {seasonPractices.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-xl border border-slate-200 px-4 py-3.5 dark:border-white/10"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-tulus-600">
                          {p.category}
                        </p>
                        <p className="mt-1 text-sm font-medium text-ink">
                          {p.title}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                          {p.description}
                        </p>
                        {p.steps && p.steps.length ? (
                          <details className="group mt-3 border-t border-slate-100 pt-2.5 dark:border-white/10">
                            <summary className="cursor-pointer list-none text-xs font-medium text-tulus-700 marker:hidden dark:text-[#8fbdf0]">
                              <span className="group-open:hidden">
                                Lihat {p.steps.length} langkah
                              </span>
                              <span className="hidden group-open:inline">
                                Sembunyikan langkah
                              </span>
                            </summary>
                            <ol className="mt-2.5 list-decimal space-y-1 pl-5 text-sm text-ink-muted">
                              {p.steps.map((step, idx) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ol>
                          </details>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>Belum ada praktik tercatat.</Empty>
                )}
              </Block>
            </>
          ) : null}
        </motion.div>
      </div>

      <PhotoLightbox
        item={photo}
        fieldName={field.name}
        onClose={() => setPhoto(null)}
      />
    </>
  );
}

// =====================================================
// Tab Aktivitas: filter + linimasa dikelompokkan per bulan
// =====================================================
type TimelineItem =
  | {
      kind: "activity";
      date: string;
      data: ReturnType<typeof getActivitiesBySeason>[number];
    }
  | {
      kind: "expense";
      date: string;
      data: ReturnType<typeof getExpensesBySeason>[number];
    };

const monthFmt = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
});

function ActivityTab({ timeline }: { timeline: TimelineItem[] }) {
  const [filter, setFilter] = useState<"all" | "activity" | "expense">("all");
  const actCount = timeline.filter((t) => t.kind === "activity").length;
  const expCount = timeline.length - actCount;
  const items = timeline.filter((t) => filter === "all" || t.kind === filter);

  if (!timeline.length) return <Empty>Belum ada aktivitas tercatat.</Empty>;

  // Kelompokkan per bulan (urutan sudah terbaru → terlama).
  const groups: Array<{ month: string; rows: TimelineItem[] }> = [];
  for (const it of items) {
    const month = monthFmt.format(new Date(it.date));
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.rows.push(it);
    else groups.push({ month, rows: [it] });
  }

  const filters: Array<{ id: typeof filter; label: string; n: number }> = [
    { id: "all", label: "Semua", n: timeline.length },
    { id: "activity", label: "Aktivitas", n: actCount },
    { id: "expense", label: "Pengeluaran", n: expCount },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? "bg-tulus-600 text-white dark:bg-[#5E9FE8] dark:text-[#0c111b]"
                  : "bg-slate-100 text-ink-muted hover:text-ink dark:bg-white/10"
              }`}
            >
              {f.label} <span className="opacity-70">{f.n}</span>
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <Empty>Tidak ada catatan pada filter ini.</Empty>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.month}>
              <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {g.month}
              </h4>
              <ol>
                {g.rows.map((item, index) => {
                  const isLast = index === g.rows.length - 1;
                  const isAct = item.kind === "activity";
                  return (
                    <li
                      key={`${item.kind}-${item.data.id}`}
                      className="relative flex gap-3 pb-5 last:pb-0"
                    >
                      {!isLast ? (
                        <span className="absolute bottom-0 left-[4px] top-4 w-px bg-slate-200 dark:bg-white/10" />
                      ) : null}
                      <span
                        className={`relative z-10 mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full ring-2 ring-white dark:ring-[#1c1c1c] ${
                          isAct ? "bg-tulus-600" : "bg-amber-500"
                        }`}
                      />
                      {item.kind === "activity" ? (
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-ink">
                              {item.data.title}
                            </p>
                            <Chip className={activityToneMap[item.data.status]}>
                              {activityStatusLabel[item.data.status]}
                            </Chip>
                          </div>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {formatDate(item.data.date)} ·{" "}
                            {item.data.performedBy}
                          </p>
                          {item.data.description ? (
                            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                              {item.data.description}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-ink">
                              {expenseCategoryLabel[item.data.category] ??
                                item.data.category}
                              <span className="font-normal text-ink-muted">
                                {" "}
                                · {item.data.description}
                              </span>
                            </p>
                            <span className="shrink-0 text-sm font-medium text-ink">
                              − {formatCurrency(item.data.amount)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {formatDate(item.data.date)} · Pengeluaran
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// Lightbox foto dokumentasi. Escape ditangkap di fase capture supaya
// menutup lightbox saja, bukan seluruh modal detail lahan.
// =====================================================
function PhotoLightbox({
  item,
  fieldName,
  onClose,
}: {
  item: GalleryItem | null;
  fieldName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [item, onClose]);

  return (
    <AnimatePresence>
      {item ? (
        <motion.div
          key="photo-lightbox"
          initial={overlayHidden}
          animate={overlayShown}
          exit={overlayHidden}
          transition={overlayTransition}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto: ${item.title}`}
        >
          <motion.div
            initial={panelHidden}
            animate={panelShown}
            exit={panelExit}
            transition={panelTransition}
            onClick={(e) => e.stopPropagation()}
            className="dark-surface flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1c1c1c]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-white/10">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold text-tulus-900 dark:text-white">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {formatDate(item.date)} · {fieldName}
                  {item.stage ? ` · Fase ${item.stage}` : ""}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Tutup foto"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ink-muted ring-1 ring-slate-200 transition hover:text-ink dark:bg-white/10 dark:ring-white/15"
              >
                <FiX size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <img
                src={normalizeImageUrl(item.imageUrl)}
                alt={item.title}
                className="max-h-[62vh] w-full bg-[#f8fafc] object-contain dark:bg-black/20"
              />
              <div className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-tulus-50 px-2 py-0.5 font-medium text-tulus-700">
                    <FiCalendar size={11} /> {formatDate(item.date)}
                  </span>
                  {item.stage ? (
                    <span className="inline-flex items-center rounded-full bg-leaf-50 px-2 py-0.5 font-medium text-leaf-700">
                      {item.stage}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed text-ink">
                  {item.notes ? item.notes : "Tidak ada catatan."}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
