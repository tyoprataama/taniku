import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiX, FiMapPin, FiCalendar, FiMaximize2 } from "react-icons/fi";
import type { Field, GalleryItem, Season } from "../../types";
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
import {
  Block,
  Callout,
  EmptyNote,
  Facts,
  Pill,
  StatRow,
  Stack,
  StatusChip,
  Tabs,
} from "./DetailPrimitives";
import type { Tone } from "./DetailPrimitives";
import { fieldFinanceTrend } from "../utils/analytics";
import {
  deviationInfo,
  growthProgress,
  humanDuration,
  rentalScheduleImpact,
} from "../../utils/harvest";
import { normalizeImageUrl } from "../../utils/image";

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

const ownershipLabel: Record<string, string> = {
  owned: "Milik Sendiri",
  rental: "Sewa",
};

// Label kategori biaya untuk linimasa aktivitas yang sudah memuat pengeluaran.
const expenseCategoryLabel: Record<string, string> = {
  seeds: "Benih",
  fertilizer: "Pupuk",
  labor: "Tenaga Kerja",
  equipment: "Peralatan",
  irrigation: "Irigasi",
  pesticide: "Pestisida",
  logistics: "Logistik",
  rent: "Sewa",
  other: "Lain-lain",
  tax: "Pajak",
};

const activityTone: Record<string, Tone> = {
  completed: "good",
  "in-progress": "warn",
  planned: "info",
};
const activityStatusLabel: Record<string, string> = {
  completed: "Selesai",
  "in-progress": "Berjalan",
  planned: "Rencana",
};

const devTone: Record<string, Tone> = {
  cepat: "good",
  sesuai: "neutral",
  telat: "bad",
  berjalan: "info",
};

const impactLabel: Record<string, string> = {
  high: "Tinggi",
  medium: "Sedang",
  low: "Rendah",
};

type TabKey = "overview" | "finance" | "activity" | "gallery" | "notes";
type TimelineFilter = "all" | "activity" | "expense";

const monthLabel = (key: string) =>
  new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(`${key}-01T00:00:00`),
  );

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
            className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-[#1c1c1c] sm:h-[86vh] sm:rounded-3xl"
          >
            <ModalBody
              key={season.id}
              field={field}
              season={season}
              onClose={onClose}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ModalBody({
  field: fieldProp,
  season: seasonProp,
  onClose,
}: {
  field: Field;
  season: Season;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [filter, setFilter] = useState<TimelineFilter>("all");
  // Foto galeri yang sedang diperbesar (popup/lightbox).
  const [photo, setPhoto] = useState<GalleryItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Konten tiap tab dimulai dari atas.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  // Ambil ulang data live (by id) agar perubahan admin — mis. biaya sewa —
  // langsung tercermin pada estimasi kerugian/keuntungan sewa.
  const field = getFieldById(fieldProp.id) ?? fieldProp;
  const season = getSeasonById(seasonProp.id) ?? seasonProp;
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
  // Riwayat keuangan lahan sepanjang waktu (semua musim/tahun) untuk grafik.
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
  // ROI all-time lahan ini = laba bersih / modal (pengeluaran) × 100.
  // Dijaga dari pembagian nol saat lahan belum punya pengeluaran.
  const financeRoi =
    financeTotals.expenses > 0
      ? Math.round((financeProfit / financeTotals.expenses) * 1000) / 10
      : 0;
  // Penjelasan ROI dalam bahasa sehari-hari: hasil untuk setiap Rp 1.000 modal.
  const financePer1000 =
    financeTotals.expenses > 0
      ? Math.round((financeProfit / financeTotals.expenses) * 1000)
      : 0;
  const progressPct = growthProgress(season);
  const overdue = progressPct > 100;
  // Selama musim belum panen, pendapatan belum lengkap: laba/rugi hanya sementara.
  const seasonRunning = season.status !== "harvested";
  // Biaya sewa efektif musim ini mengikuti pengeluaran kategori "rent" pada
  // musim tsb (agar perubahan biaya sewa yang diedit di admin langsung
  // tercermin pada estimasi kerugian/keuntungan), fallback ke biaya sewa lahan.
  const seasonRentExpense = exps
    .filter((e) => e.category === "rent")
    .reduce((sum, e) => sum + e.amount, 0);
  const scheduleImpact = rentalScheduleImpact(
    { ...field, rentalCost: seasonRentExpense || field.rentalCost },
    season,
  );
  const operationalProfit = revenueTotal - expenseTotal;
  // Estimasi laba bersih = laba operasional murni. Dampak sewa (kerugian saat
  // overdue / keuntungan saat lebih cepat panen) DITAMPILKAN TERPISAH sebagai
  // catatan, tidak ditambah/dikurangkan ke angka ini.
  const netProfit = operationalProfit;

  // Linimasa gabungan: aktivitas lapangan + rincian pengeluaran (tanggal & biaya).
  const timeline = [
    ...acts.map((a) => ({ kind: "activity" as const, date: a.date, data: a })),
    ...exps.map((e) => ({ kind: "expense" as const, date: e.date, data: e })),
  ].sort((a, b) => {
    const d = +new Date(b.date) - +new Date(a.date);
    return d !== 0 ? d : a.data.id.localeCompare(b.data.id);
  });
  const filtered = timeline.filter(
    (i) => filter === "all" || i.kind === filter,
  );
  // Kelompokkan per bulan agar linimasa mudah dipindai.
  const groups: Array<{ key: string; items: typeof timeline }> = [];
  for (const item of filtered) {
    const key = String(item.date).slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }

  const expenseByCat = exps.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});
  const catEntries = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1]);
  // Perbandingan biaya per kategori vs MUSIM SEBELUMNYA di lahan yang SAMA.
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
    if (!prevSeason) return null; // lahan ini belum punya musim sebelumnya
    const prev = prevExpenseByCat[category];
    if (prev === undefined || prev === 0) return { isNew: true, pct: 0 };
    return { isNew: false, pct: Math.round(((amount - prev) / prev) * 100) };
  };

  const noteCount = seasonDecisions.length + seasonPractices.length;
  const activityCount = timeline.length;
  const actOnly = timeline.filter((i) => i.kind === "activity").length;
  const expOnly = activityCount - actOnly;

  const progressNote =
    progressPct === 100
      ? null
      : season.status === "harvested"
        ? dev.days > 0
          ? `Melebihi 100% karena panen mundur ${humanDuration(dev.days)} dari perkiraan (prorata terhadap siklus tanam).`
          : `Di bawah 100% karena panen ${humanDuration(Math.abs(dev.days))} lebih cepat dari perkiraan (prorata terhadap siklus tanam).`
        : dev.days > 0
          ? `Sudah melewati perkiraan panen ${humanDuration(dev.days)} (overdue) — progress dihitung dari tanggal terhadap siklus tanam.`
          : `Progress dihitung dari tanggal: ${humanDuration(Math.abs(dev.days))} lagi menuju perkiraan panen.`;

  return (
    <>
      {/* Header + tab (tetap di atas, tidak ikut tergulir) */}
      <header className="shrink-0 border-b border-slate-200 bg-gradient-to-b from-tulus-50/70 to-white dark:border-white/10 dark:from-[#202020] dark:to-[#1c1c1c]">
        <div className="px-6 pt-6 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={season.status} />
                <WeatherBadge bmkgCode={field.bmkgCode} seed={field.location} />
              </div>
              <h2 className="mt-3 font-display text-2xl font-medium leading-tight text-ink dark:text-white sm:text-[1.75rem]">
                {field.name}
              </h2>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted dark:text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  <FiMapPin size={13} /> {field.location}
                </span>
                <span aria-hidden>·</span>
                <span>{season.label}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-ink-muted ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-ink dark:bg-white/5 dark:text-white/70 dark:ring-white/15 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>
        <div className="mt-4 px-4 sm:px-6">
          <Tabs<TabKey>
            label="Bagian detail lahan"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "overview", label: "Ringkasan" },
              { value: "finance", label: "Keuangan" },
              { value: "activity", label: "Aktivitas", count: activityCount },
              {
                value: "gallery",
                label: "Dokumentasi",
                count: galleryItems.length,
              },
              { value: "notes", label: "Keputusan & SOP", count: noteCount },
            ]}
          />
        </div>
      </header>

      {/* Konten tab (satu-satunya area yang tergulir) */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-7 scrollbar-thin sm:px-8"
      >
        <motion.div
          key={tab}
          initial={tabHidden}
          animate={tabShown}
          transition={tabTransition}
        >
          {tab === "overview" ? (
            <Stack>
              <Block title="Progress menuju panen">
                <div className="flex items-end justify-between gap-3">
                  <span
                    className={`font-display text-4xl font-medium leading-none tabular-nums ${
                      overdue
                        ? "text-red-600 dark:text-[#E97366]"
                        : "text-tulus-700 dark:text-[#8fbdf0]"
                    }`}
                  >
                    {formatNumber(progressPct)}%
                  </span>
                  <span className="pb-0.5 text-xs text-ink-muted dark:text-white/50">
                    {season.label}
                  </span>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${
                      overdue ? "bg-red-500" : "bg-tulus-600 dark:bg-[#5E9FE8]"
                    }`}
                    style={barStyle(progressPct)}
                  />
                </div>
                {progressNote ? (
                  <p className="mt-3 text-xs leading-relaxed text-ink-muted dark:text-white/50">
                    {progressNote}
                  </p>
                ) : null}
                <div className="mt-5">
                  <Facts
                    items={[
                      {
                        label: "Tanggal tanam",
                        value: formatDate(season.plantingDate),
                      },
                      {
                        label: "Perkiraan panen",
                        value: formatDate(season.harvestDate),
                      },
                      ...(season.actualHarvestDate
                        ? [
                            {
                              label: "Panen aktual",
                              value: formatDate(season.actualHarvestDate),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
                <div className="mt-4">
                  <Callout tone={devTone[dev.category]}>
                    <span className="font-medium">{dev.detail}</span>
                    {season.harvestNote ? (
                      <span className="mt-1 block opacity-90">
                        {season.harvestNote}
                      </span>
                    ) : null}
                  </Callout>
                </div>
              </Block>

              {report ? (
                <Block
                  title="Hasil panen"
                  hint="Perbandingan hasil dengan target (ton)."
                >
                  <StatRow
                    items={[
                      {
                        label: "Hasil",
                        value: `${formatNumber(report.yieldTon)} ton`,
                      },
                      {
                        label: "Target",
                        value: `${formatNumber(report.targetTon)} ton`,
                      },
                      ...(report.targetTon > 0
                        ? [
                            {
                              label: "Capaian",
                              value: `${formatNumber(
                                Math.round(
                                  (report.yieldTon / report.targetTon) * 100,
                                ),
                              )}%`,
                              tone:
                                report.yieldTon >= report.targetTon
                                  ? ("pos" as const)
                                  : ("neg" as const),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Block>
              ) : null}

              <Block
                title="Informasi lahan & komoditas"
                hint="Data permanen lahan dan komoditas musim ini."
              >
                <Facts
                  items={[
                    { label: "Komoditas", value: season.crop },
                    {
                      label: "Luas",
                      value: `${formatNumber(field.areaM2)} m² (${formatNumber(
                        haFromM2(field.areaM2),
                      )} ha)`,
                    },
                    {
                      label: "Kepemilikan",
                      value: ownershipLabel[field.ownership],
                    },
                    ...(field.ownership === "rental" && field.rentalCost
                      ? [
                          {
                            label: "Biaya sewa",
                            value: formatCompactCurrency(field.rentalCost),
                          },
                        ]
                      : []),
                    { label: "Kondisi tanah", value: field.soilType },
                    ...(latestMonitor
                      ? [
                          {
                            label: "Skor kesehatan",
                            value: `${latestMonitor.healthScore}/100`,
                          },
                        ]
                      : []),
                  ]}
                />
                {field.notes || season.notes ? (
                  <div className="mt-5 space-y-2 border-l-2 border-slate-200 pl-4 text-sm leading-relaxed text-ink-muted dark:border-white/15 dark:text-white/60">
                    {field.notes ? (
                      <p>
                        <span className="font-medium text-ink dark:text-white/85">
                          Lahan ·{" "}
                        </span>
                        {field.notes}
                      </p>
                    ) : null}
                    {season.notes ? (
                      <p>
                        <span className="font-medium text-ink dark:text-white/85">
                          Musim ·{" "}
                        </span>
                        {season.notes}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </Block>
            </Stack>
          ) : null}

          {tab === "finance" ? (
            <Stack>
              <Block
                title="Laba rugi musim ini"
                hint="Pendapatan dikurangi total biaya operasional musim ini."
              >
                <StatRow
                  items={[
                    {
                      label: "Pendapatan",
                      value: formatCurrency(revenueTotal),
                      tone: "pos",
                    },
                    {
                      label: "Total biaya",
                      value: formatCurrency(expenseTotal),
                      tone: "info",
                    },
                    {
                      label: seasonRunning
                        ? "Laba sementara"
                        : "Estimasi laba bersih",
                      value: formatCurrency(netProfit),
                      tone: seasonRunning
                        ? "default"
                        : netProfit >= 0
                          ? "pos"
                          : "neg",
                      sub: seasonRunning
                        ? "belum final · musim berjalan"
                        : "pendapatan − biaya",
                    },
                  ]}
                />

                <div className="mt-4">
                  {seasonRunning ? (
                    <Callout tone="info" title="Musim masih berjalan">
                      <p className="mt-1 opacity-90">
                        {field.ownership === "rental"
                          ? scheduleImpact.category === "telat"
                            ? `Perkiraan panen sudah terlewati ${humanDuration(
                                scheduleImpact.overdueDays,
                              )}. Dampak sewa dihitung saat aktualisasi panen.`
                            : scheduleImpact.detail
                          : "Belum panen. Untung atau rugi dinilai setelah panen dan penjualan selesai."}
                      </p>
                      <p className="mt-1 opacity-90">
                        Pendapatan baru tercatat setelah panen, jadi angka laba
                        saat ini bersifat sementara.
                      </p>
                    </Callout>
                  ) : field.ownership === "rental" ? (
                    <Callout
                      tone={
                        scheduleImpact.category === "telat" ? "bad" : "good"
                      }
                      title={`Lahan sewa · ${scheduleImpact.label}`}
                    >
                      <p className="mt-1 opacity-90">{scheduleImpact.detail}</p>
                      {scheduleImpact.amount > 0 ? (
                        <p className="mt-2 font-semibold">
                          Estimasi kerugian sewa:{" "}
                          {formatCurrency(scheduleImpact.amount)}
                          <span className="ml-1 font-normal opacity-80">
                            (
                            {formatCurrency(
                              Math.round(scheduleImpact.dailyRent),
                            )}
                            /hari × {scheduleImpact.overdueDays} hari)
                          </span>
                        </p>
                      ) : scheduleImpact.savingAmount > 0 ? (
                        <p className="mt-2 font-semibold">
                          Estimasi keuntungan sewa: +
                          {formatCurrency(scheduleImpact.savingAmount)}
                          <span className="ml-1 font-normal opacity-80">
                            (
                            {formatCurrency(
                              Math.round(scheduleImpact.dailyRent),
                            )}
                            /hari × {scheduleImpact.fasterDays} hari lebih cepat
                            — masa sewa lebih singkat)
                          </span>
                        </p>
                      ) : (
                        <p className="mt-2 font-medium">
                          Tidak ada selisih biaya sewa untuk periode ini.
                        </p>
                      )}
                    </Callout>
                  ) : operationalProfit < 0 ? (
                    <Callout
                      tone="bad"
                      title="Lahan milik sendiri — periode ini merugi"
                    >
                      <p className="mt-1 opacity-90">
                        Pendapatan ({formatCurrency(revenueTotal)}) lebih kecil
                        dari total biaya ({formatCurrency(expenseTotal)}).
                        {catEntries.length
                          ? ` Biaya terbesar: ${
                              expenseCategoryLabel[catEntries[0][0]] ??
                              catEntries[0][0]
                            } (${formatCurrency(catEntries[0][1])})`
                          : ""}
                      </p>
                    </Callout>
                  ) : (
                    <Callout
                      tone="good"
                      title="Lahan milik sendiri — periode ini untung, tanpa beban sewa."
                    />
                  )}
                </div>

                {!seasonRunning &&
                field.ownership === "rental" &&
                scheduleImpact.amount > 0 ? (
                  <p className="mt-3 text-xs leading-relaxed text-ink-muted dark:text-white/50">
                    Catatan: estimasi laba bersih belum memperhitungkan estimasi
                    kerugian sewa {formatCurrency(scheduleImpact.amount)} akibat
                    overdue {humanDuration(scheduleImpact.overdueDays)}{" "}
                    (ditampilkan terpisah di atas).
                  </p>
                ) : !seasonRunning &&
                  field.ownership === "rental" &&
                  scheduleImpact.savingAmount > 0 ? (
                  <p className="mt-3 text-xs leading-relaxed text-ink-muted dark:text-white/50">
                    Catatan: estimasi laba bersih belum memperhitungkan estimasi
                    keuntungan sewa{" "}
                    {formatCurrency(scheduleImpact.savingAmount)} karena panen
                    lebih cepat {humanDuration(scheduleImpact.fasterDays)}{" "}
                    (ditampilkan terpisah di atas).
                  </p>
                ) : null}
              </Block>

              <Block
                title="Rincian biaya"
                hint={
                  prevSeason
                    ? `Total per kategori. ▲ ▼ = perubahan dibanding ${prevSeason.label}.`
                    : "Total biaya per kategori pada musim ini."
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
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="font-medium text-ink dark:text-white">
                                {expenseCategoryLabel[category] ?? category}
                              </span>
                              {d && !d.isNew && d.pct !== 0 ? (
                                <span
                                  className={`text-[11px] font-medium ${
                                    d.pct > 0
                                      ? "text-red-600 dark:text-[#E97366]"
                                      : "text-leaf-600 dark:text-[#8fdcae]"
                                  }`}
                                  title={`Dibanding ${prevSeason?.label ?? "musim sebelumnya"}`}
                                >
                                  {d.pct > 0 ? "▲" : "▼"} {Math.abs(d.pct)}%
                                </span>
                              ) : null}
                              {d?.isNew ? (
                                <span
                                  className="text-[11px] font-medium text-slate-400 dark:text-white/40"
                                  title="Tidak ada di musim sebelumnya"
                                >
                                  baru
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 tabular-nums text-ink dark:text-white">
                              {formatCurrency(amount)}
                              <span className="ml-2 inline-block w-9 text-right text-xs text-ink-muted dark:text-white/45">
                                {Math.round(share)}%
                              </span>
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                            <div
                              className="h-full rounded-full bg-tulus-600/85 dark:bg-[#5E9FE8]"
                              style={barStyle(share)}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyNote>Belum ada biaya tercatat.</EmptyNote>
                )}
              </Block>

              <Block
                title="Riwayat keuangan lahan"
                hint="Uang masuk, uang keluar, dan untung lahan ini dari musim ke musim. Musim yang masih berjalan biasanya baru memuat pengeluaran."
              >
                {financeTrend.length ? (
                  <div className="space-y-5">
                    <div className="rounded-xl bg-slate-50 px-4 py-3.5 dark:bg-white/[0.05]">
                      <p className="text-sm leading-relaxed text-ink dark:text-white/85">
                        Total modal lahan ini adalah{" "}
                        <b>{formatCurrency(financeTotals.expenses)}</b> dan
                        menghasilkan return{" "}
                        <b>{formatCurrency(financeTotals.revenue)}</b>, jadi{" "}
                        {financeProfit < 0
                          ? seasonRunning
                            ? "sementara minus"
                            : "masih rugi"
                          : "profit"}{" "}
                        <b
                          className={
                            financeProfit < 0 && !seasonRunning
                              ? "text-red-600 dark:text-[#E97366]"
                              : "text-leaf-700 dark:text-[#8fdcae]"
                          }
                        >
                          {formatCurrency(Math.abs(financeProfit))}
                        </b>
                        .
                      </p>
                      {seasonRunning ? (
                        <p className="mt-2 text-xs leading-relaxed text-tulus-700 dark:text-[#8fbdf0]">
                          Angka ini sudah menghitung biaya {season.label} yang
                          masih berjalan, sedangkan pendapatannya belum masuk,
                          jadi rugi dan ROI negatif masih bersifat sementara.
                        </p>
                      ) : null}
                      {financeTotals.expenses > 0 ? (
                        <p className="mt-1 text-xs text-ink-muted dark:text-white/55">
                          Sederhananya: setiap Rp 1.000 uang masuk{" "}
                          {financePer1000 < 0
                            ? "berkurang"
                            : "menghasilkan return"}{" "}
                          sekitar {formatCurrency(Math.abs(financePer1000))}.
                        </p>
                      ) : null}
                    </div>

                    <StatRow
                      items={[
                        {
                          label: "Uang masuk",
                          value: formatCompactCurrency(financeTotals.revenue),
                          tone: "pos",
                          sub: "hasil penjualan panen",
                        },
                        {
                          label: "Uang keluar",
                          value: formatCompactCurrency(financeTotals.expenses),
                          tone: "info",
                          sub: "benih, pupuk, tenaga kerja, dll.",
                        },
                        {
                          label: `${financeProfit < 0 ? "Rugi" : "Untung"}${
                            seasonRunning ? " sementara" : ""
                          }`,
                          value: formatCompactCurrency(financeProfit),
                          tone: seasonRunning
                            ? "default"
                            : financeProfit < 0
                              ? "neg"
                              : "pos",
                          sub: "uang masuk − uang keluar",
                        },
                        {
                          label: "ROI",
                          value: `${formatNumber(financeRoi)}%`,
                          tone: seasonRunning
                            ? "default"
                            : financeRoi < 0
                              ? "neg"
                              : "roi",
                          sub: "untung dibanding modal",
                        },
                      ]}
                    />

                    <FieldFinanceChart data={financeTrend} />
                  </div>
                ) : (
                  <EmptyNote>
                    Belum ada data keuangan untuk lahan ini.
                  </EmptyNote>
                )}
              </Block>
            </Stack>
          ) : null}

          {tab === "activity" ? (
            <Block
              title="Linimasa aktivitas"
              hint="Urutan kegiatan lapangan beserta rincian pengeluaran dari tanam, perawatan, hingga panen."
              action={
                actOnly > 0 && expOnly > 0 ? (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {(
                      [
                        ["all", "Semua", activityCount],
                        ["activity", "Aktivitas", actOnly],
                        ["expense", "Pengeluaran", expOnly],
                      ] as Array<[TimelineFilter, string, number]>
                    ).map(([value, label, n]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value)}
                        aria-pressed={filter === value}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          filter === value
                            ? "bg-tulus-700 text-white dark:bg-[#5E9FE8] dark:text-[#0a1830]"
                            : "bg-slate-100 text-ink-muted hover:text-ink dark:bg-white/10 dark:text-white/60 dark:hover:text-white"
                        }`}
                      >
                        {label}{" "}
                        <span className="tabular-nums opacity-70">{n}</span>
                      </button>
                    ))}
                  </div>
                ) : null
              }
            >
              {groups.length ? (
                <div className="space-y-7">
                  {groups.map((g) => (
                    <div key={g.key}>
                      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-muted dark:text-white/45">
                        {monthLabel(g.key)}
                      </p>
                      <ol>
                        {g.items.map((item, index) => {
                          const isLast = index === g.items.length - 1;
                          const isAct = item.kind === "activity";
                          return (
                            <li
                              key={`${item.kind}-${item.data.id}`}
                              className="relative flex gap-4 pb-5 last:pb-0"
                            >
                              {!isLast ? (
                                <span className="absolute bottom-0 left-[5px] top-4 w-px bg-slate-200 dark:bg-white/10" />
                              ) : null}
                              <span
                                className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-white dark:ring-[#1c1c1c] ${
                                  isAct ? "bg-tulus-600" : "bg-amber-500"
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                {item.kind === "activity" ? (
                                  <>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-sm font-medium text-ink dark:text-white">
                                        {item.data.title}
                                      </p>
                                      <Pill
                                        tone={
                                          activityTone[item.data.status] ??
                                          "neutral"
                                        }
                                      >
                                        {activityStatusLabel[item.data.status]}
                                      </Pill>
                                    </div>
                                    <p className="mt-0.5 text-xs text-ink-muted dark:text-white/50">
                                      {formatDate(item.data.date)} ·{" "}
                                      {item.data.performedBy}
                                    </p>
                                    {item.data.description ? (
                                      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted dark:text-white/65">
                                        {item.data.description}
                                      </p>
                                    ) : null}
                                  </>
                                ) : (
                                  <>
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                      <p className="text-sm font-medium text-ink dark:text-white">
                                        {expenseCategoryLabel[
                                          item.data.category
                                        ] ?? item.data.category}
                                      </p>
                                      <p className="text-sm font-medium tabular-nums text-ink dark:text-white">
                                        − {formatCurrency(item.data.amount)}
                                      </p>
                                    </div>
                                    <p className="mt-0.5 text-xs text-ink-muted dark:text-white/50">
                                      {formatDate(item.data.date)} · Pengeluaran
                                    </p>
                                    {item.data.description ? (
                                      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted dark:text-white/65">
                                        {item.data.description}
                                      </p>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyNote>Belum ada aktivitas tercatat.</EmptyNote>
              )}
            </Block>
          ) : null}

          {tab === "gallery" ? (
            <Block
              title="Galeri dokumentasi"
              hint="Foto perkembangan tanaman dari fase ke fase."
            >
              {galleryItems.length ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {galleryItems.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setPhoto(g)}
                      aria-label={`Perbesar foto: ${g.title}`}
                      className="group text-left focus:outline-none"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 transition group-hover:ring-tulus-300 group-focus-visible:ring-2 group-focus-visible:ring-tulus-500 dark:bg-white/5 dark:ring-white/10">
                        <img
                          src={normalizeImageUrl(g.imageUrl)}
                          alt={g.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                        />
                        <span className="absolute inset-0 grid place-items-center bg-ink/0 opacity-0 transition group-hover:bg-ink/30 group-hover:opacity-100">
                          <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-tulus-700 shadow-lg">
                            <FiMaximize2 size={15} strokeWidth={2.5} />
                          </span>
                        </span>
                      </div>
                      <div className="mt-2.5 px-0.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-tulus-600 dark:text-[#8fbdf0]">
                          {g.stage}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-ink dark:text-white">
                          {g.title}
                        </p>
                        <p className="text-xs text-ink-muted dark:text-white/50">
                          {formatDate(g.date)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyNote>Belum ada dokumentasi.</EmptyNote>
              )}
            </Block>
          ) : null}

          {tab === "notes" ? (
            <Stack>
              <Block
                title="Catatan keputusan"
                hint="Keputusan operasional penting beserta konteks dan alasannya."
              >
                {seasonDecisions.length ? (
                  <ul className="space-y-3">
                    {seasonDecisions.map((d) => {
                      const details = [
                        ["Konteks", d.context],
                        ["Alasan", d.rationale],
                        ["Hasil", d.outcome],
                      ].filter(([, v]) => Boolean(v)) as Array<
                        [string, string]
                      >;
                      return (
                        <li
                          key={d.id}
                          className="rounded-xl border border-slate-200 p-4 dark:border-white/10"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-ink dark:text-white">
                              {d.title}
                            </p>
                            <span className="shrink-0 text-xs text-ink-muted dark:text-white/50">
                              {formatDate(d.date)}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted dark:text-white/65">
                            {d.decision}
                          </p>
                          {details.length ? (
                            <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-white/10">
                              {details.map(([label, text]) => (
                                <div
                                  key={label}
                                  className="grid grid-cols-[4.25rem_1fr] gap-2"
                                >
                                  <dt className="font-medium text-ink dark:text-white/80">
                                    {label}
                                  </dt>
                                  <dd className="leading-relaxed text-ink-muted dark:text-white/60">
                                    {text}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted dark:text-white/50">
                            <Pill>
                              Dampak: {impactLabel[d.impact] ?? d.impact}
                            </Pill>
                            <span>oleh {d.decidedBy}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyNote>Belum ada keputusan tercatat.</EmptyNote>
                )}
              </Block>

              <Block
                title="Praktik lapangan"
                hint="Standar & cara kerja (SOP) yang diterapkan pada lahan ini."
              >
                {seasonPractices.length ? (
                  <ul className="space-y-3">
                    {seasonPractices.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-xl border border-slate-200 p-4 dark:border-white/10"
                      >
                        <p className="text-[11px] font-medium uppercase tracking-wide text-tulus-600 dark:text-[#8fbdf0]">
                          {p.category}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-ink dark:text-white">
                          {p.title}
                        </p>
                        <p className="mt-1.5 text-sm leading-relaxed text-ink-muted dark:text-white/65">
                          {p.description}
                        </p>
                        {p.steps && p.steps.length ? (
                          <ol className="mt-3 list-decimal space-y-1 border-t border-slate-100 pl-5 pt-3 text-sm text-ink-muted marker:text-ink-muted/60 dark:border-white/10 dark:text-white/65">
                            {p.steps.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyNote>Belum ada praktik tercatat.</EmptyNote>
                )}
              </Block>
            </Stack>
          ) : null}
        </motion.div>
      </div>

      {/* Popup perbesar foto galeri */}
      <PhotoLightbox
        item={photo}
        fieldName={field.name}
        onClose={() => setPhoto(null)}
      />
    </>
  );
}

// Lightbox foto dokumentasi: gambar diperbesar + judul, tanggal, fase, dan
// catatan agar detail tetap terbaca. Escape ditangkap di fase capture supaya
// menutup lightbox saja, bukan seluruh modal detail lahan.
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
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1c1c1c]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
              <div className="min-w-0">
                <p className="truncate font-display text-base font-medium text-ink dark:text-white">
                  {item.title}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted dark:text-white/55">
                  <span className="inline-flex items-center gap-1">
                    <FiCalendar size={11} /> {formatDate(item.date)}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <FiMapPin size={11} /> {fieldName}
                  </span>
                  {item.stage ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>Fase {item.stage}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Tutup foto"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-ink-muted ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-ink dark:bg-white/5 dark:text-white/70 dark:ring-white/15 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <FiX size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
              <img
                src={normalizeImageUrl(item.imageUrl)}
                alt={item.title}
                className="max-h-[62vh] w-full bg-slate-50 object-contain dark:bg-black/30"
              />
              <div className="px-5 py-4">
                <p className="text-xs text-ink-muted dark:text-white/50">
                  Catatan
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink dark:text-white/85">
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
