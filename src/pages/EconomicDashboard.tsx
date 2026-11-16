import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { PageTransition } from "../components/ui/PageTransition";
import { PageHeader } from "../components/ui/PageHeader";
import { StatisticCard } from "../components/cards/StatisticCard";
import { Card, CardHeader } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { CurrencyInput } from "../components/ui/CurrencyInput";
import { PeriodFilter } from "../components/ui/PeriodFilter";
import {
  inputClass,
  labelClass,
  selectSmClass,
  tableWrap,
  theadClass,
  thClass,
  tdClass,
  trClass,
  iconButton,
} from "../components/ui/styles";
import {
  FieldComparisonChart,
  MonthlyCashflowChart,
  YearlySummaryTable,
} from "../client/components/Charts";
import {
  monthlyCashflow,
  yearlySummary,
  periodIsRunning,
} from "../client/utils/analytics";
import type { Period } from "../components/ui/PeriodFilter";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiPieChart,
  FiPercent,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiTarget,
  FiDownload,
  FiFileText,
  FiGrid,
  FiFile,
} from "react-icons/fi";
import {
  fields,
  seasons,
  expenses,
  revenues,
  seasonsByYear,
  getSeasonsByField,
  getSeasonById,
  getReportBySeason,
  getFieldName,
  getAvailableYears,
  getLatestYear,
  addExpense,
  updateExpense,
  removeExpense,
  addRevenue,
  updateRevenue,
  removeRevenue,
  upsertSeasonReport,
  useDataVersion,
} from "../data";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
} from "../utils/format";
import type { ExpenseCategory, Expense, Revenue } from "../types";
import {
  runFinanceExport,
  buildFinanceExport,
  formatLabel,
  stamp,
} from "../utils/export";
import type { ExportFormat, ExportKind } from "../utils/export";

const categoryLabel: Record<ExpenseCategory, string> = {
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

const barWidth = (v: number, max: number) => ({
  width: `${Math.round((v / max) * 100)}%`,
});

const num = (v: number) => (Number.isFinite(v) ? v : undefined);

export default function EconomicDashboard() {
  useDataVersion();
  const years = getAvailableYears();
  const [period, setPeriod] = useState<Period>(() => getLatestYear());
  const [modal, setModal] = useState<
    "expense" | "revenue" | "target" | "export" | null
  >(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [targetSeasonId, setTargetSeasonId] = useState<string | null>(null);
  // Filter kategori untuk daftar biaya (memudahkan menemukan & mengedit
  // pengeluaran kategori tertentu).
  const [expCat, setExpCat] = useState<ExpenseCategory | "all">("all");
  const [expField, setExpField] = useState<string>("all");
  // Set id musim yang termasuk periode terpilih (null = seluruh waktu).
  const periodSeasonIds = useMemo(
    () =>
      period === "all" ? null : new Set(seasonsByYear(period).map((s) => s.id)),
    [period],
  );

  const periodExpenses = useMemo(
    () =>
      periodSeasonIds
        ? expenses.filter((e) => periodSeasonIds.has(e.seasonId))
        : expenses,
    [periodSeasonIds],
  );
  const periodRevenues = useMemo(
    () =>
      periodSeasonIds
        ? revenues.filter((r) => periodSeasonIds.has(r.seasonId))
        : revenues,
    [periodSeasonIds],
  );

  const rev = periodRevenues.reduce((s, r) => s + r.amount, 0);
  const exp = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const profit = rev - exp;
  const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;
  const yieldPct = exp > 0 ? Math.round((profit / exp) * 100) : 0;

  const byCategory: Record<string, number> = {};
  for (const e of periodExpenses)
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  const catEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(...catEntries.map((c) => c[1]), 1);

  const perField = fields
    .map((f) => {
      const r = periodRevenues
        .filter((x) => x.fieldId === f.id)
        .reduce((s, x) => s + x.amount, 0);
      const c = periodExpenses
        .filter((x) => x.fieldId === f.id)
        .reduce((s, x) => s + x.amount, 0);
      return { id: f.id, name: f.name, revenue: r, expense: c, profit: r - c };
    })
    .filter((p) => p.revenue > 0 || p.expense > 0);
  const maxBar = Math.max(
    ...perField.flatMap((p) => [p.revenue, p.expense]),
    1,
  );

  // Economic Dashboard menampilkan SEMUA transaksi pada periode terpilih
  // (berbeda dari Activity Timeline yang difilter per lahan).
  const recentExpenses = [...periodExpenses].sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  );
  const recentRevenues = [...periodRevenues].sort(
    (a, b) => +new Date(b.date) - +new Date(a.date),
  );
  // Kategori biaya yang tersedia pada periode terpilih (untuk dropdown filter).
  const expenseCatOptions = useMemo(
    () =>
      (
        Array.from(
          new Set(periodExpenses.map((e) => e.category)),
        ) as ExpenseCategory[]
      ).sort((a, b) => categoryLabel[a].localeCompare(categoryLabel[b])),
    [periodExpenses],
  );
  const filteredExpenses = recentExpenses.filter(
    (e) =>
      (expCat === "all" || e.category === expCat) &&
      (expField === "all" || e.fieldId === expField),
  );

  const targetRows = (
    period === "all" ? [...seasons] : seasonsByYear(period)
  ).sort((a, b) => b.year - a.year);

  const openAddExpense = () => {
    setEditingExpense(null);
    setModal("expense");
  };
  const openEditExpense = (e: Expense) => {
    setEditingExpense(e);
    setModal("expense");
  };
  const openAddRevenue = () => {
    setEditingRevenue(null);
    setModal("revenue");
  };
  const openEditRevenue = (r: Revenue) => {
    setEditingRevenue(r);
    setModal("revenue");
  };
  const openTarget = (seasonId: string | null) => {
    setTargetSeasonId(seasonId);
    setModal("target");
  };
  const closeModal = () => setModal(null);

  const periodLabel = period === "all" ? "seluruh waktu" : `musim ${period}`;
  const running = periodIsRunning(period);

  // Metrik kelayakan usaha (dihitung dari data periode terpilih).
  const rcRatio = exp > 0 ? Math.round((rev / exp) * 100) / 100 : 0;
  const expenseRatio = rev > 0 ? Math.round((exp / rev) * 1000) / 10 : 0;
  const rentExp = periodExpenses
    .filter((e) => e.category === "rent")
    .reduce((s, e) => s + e.amount, 0);
  const rentShare = exp > 0 ? Math.round((rentExp / exp) * 1000) / 10 : 0;

  const chartData = perField.map((p) => ({
    name: p.name,
    revenue: p.revenue,
    cost: p.expense,
    profit: p.profit,
  }));
  const cashflow = period === "all" ? [] : monthlyCashflow(period);
  const yearly = yearlySummary();

  return (
    <PageTransition>
      <PageHeader
        title="Economic Dashboard"
        description={`Analisis biaya, pendapatan, margin, dan target panen · ${periodLabel}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} years={years} />
            <Button variant="outline" onClick={openAddExpense}>
              <FiPlus size={15} /> Biaya
            </Button>
            <Button variant="outline" onClick={openAddRevenue}>
              <FiPlus size={15} /> Pendapatan
            </Button>
            <Button onClick={() => setModal("export")}>
              <FiDownload size={15} /> Ekspor
            </Button>
          </div>
        }
      />

      {running ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-tulus-50 px-5 py-3.5 text-sm leading-relaxed text-tulus-800 dark:bg-[#5E9FE8]/15 dark:text-[#bcd7f6]">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-tulus-600 dark:bg-[#5E9FE8]" />
          <p>
            <span className="font-semibold">
              Ada musim yang masih berjalan.
            </span>{" "}
            Pendapatan baru tercatat setelah panen, jadi laba, margin, dan ROI
            yang minus saat ini bersifat sementara dan belum berarti rugi.
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatisticCard
          label="Total Pendapatan"
          value={formatCompactCurrency(rev)}
          icon={FiTrendingUp}
          tone="green"
          hint="Uang masuk dari penjualan"
        />
        <StatisticCard
          label="Total Biaya"
          value={formatCompactCurrency(exp)}
          icon={FiTrendingDown}
          tone="blue"
          hint="Seluruh pengeluaran operasional"
        />
        <StatisticCard
          label="Laba Bersih"
          value={formatCompactCurrency(profit)}
          icon={FiPieChart}
          tone={profit < 0 && !running ? "red" : "green"}
          negative={profit < 0}
          provisional={running}
          hint="Pendapatan − biaya"
        />
        <StatisticCard
          label="Margin"
          value={`${formatNumber(margin)}%`}
          icon={FiPercent}
          tone="amber"
          negative={margin < 0}
          provisional={running}
          hint="Laba ÷ pendapatan"
        />
        <StatisticCard
          label={period !== "all" ? "Yield (ROI)" : "ROI"}
          value={`${formatNumber(yieldPct)}%`}
          icon={FiTarget}
          tone="violet"
          negative={yieldPct < 0}
          provisional={running}
          hint="Laba ÷ modal"
        />
        <StatisticCard
          label="Rasio R/C"
          value={`${formatNumber(rcRatio)}×`}
          icon={FiPercent}
          tone="green"
          provisional={running}
          hint="Pendapatan ÷ biaya. Di atas 1 = untung"
        />
        <StatisticCard
          label="Rasio Biaya"
          value={rev > 0 ? `${formatNumber(expenseRatio)}%` : "—"}
          icon={FiPercent}
          tone="blue"
          provisional={running}
          hint="Biaya ÷ pendapatan. Makin kecil makin efisien"
        />
        <StatisticCard
          label="Beban Sewa"
          value={`${formatNumber(rentShare)}%`}
          icon={FiPercent}
          tone="amber"
          hint="Porsi biaya sewa dari total biaya"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="min-w-0 p-6 lg:col-span-3">
          <CardHeader
            title="Pendapatan vs biaya per lahan"
            description={`Batang membandingkan uang masuk dan keluar; garis menunjukkan laba · ${periodLabel}.`}
          />
          {chartData.length ? (
            <FieldComparisonChart data={chartData} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-muted">
              Belum ada transaksi pada periode ini.
            </p>
          )}
        </Card>

        <Card className="min-w-0 p-6 lg:col-span-2">
          <CardHeader
            title="Rincian biaya per kategori"
            description="Urut dari yang terbesar."
          />
          {catEntries.length ? (
            <ul className="space-y-4">
              {catEntries.map(([cat, amount]) => {
                const share = exp > 0 ? (amount / exp) * 100 : 0;
                return (
                  <li key={cat}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-ink dark:text-white">
                        {categoryLabel[cat as ExpenseCategory]}
                      </span>
                      <span className="tabular-nums text-ink dark:text-white">
                        {formatCompactCurrency(amount)}
                        <span className="ml-2 inline-block w-9 text-right text-xs text-ink-muted dark:text-white/45">
                          {Math.round(share)}%
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-tulus-600/85 dark:bg-[#5E9FE8]"
                        style={barWidth(amount, maxCat)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-ink-muted">
              Belum ada biaya pada periode ini.
            </p>
          )}
        </Card>
      </div>

      {cashflow.length ? (
        <Card className="mt-6 p-6">
          <CardHeader
            title="Arus kas bulanan"
            description="Uang masuk dan keluar tiap bulan. Garis = laba kumulatif; saat melewati nol, modal sudah kembali."
          />
          <MonthlyCashflowChart data={cashflow} />
        </Card>
      ) : null}

      {/* Daftar transaksi: klik ikon edit untuk ubah / hapus */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-6">
          <CardHeader
            title={`Biaya · ${periodLabel}`}
            description={`${filteredExpenses.length} transaksi`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={expField}
                  onChange={(ev) => setExpField(ev.target.value)}
                  aria-label="Filter lahan biaya"
                  className={selectSmClass}
                >
                  <option value="all">Semua lahan</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <select
                  value={expCat}
                  onChange={(ev) =>
                    setExpCat(ev.target.value as ExpenseCategory | "all")
                  }
                  aria-label="Filter kategori biaya"
                  className={selectSmClass}
                >
                  <option value="all">Semua kategori</option>
                  {expenseCatOptions.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel[c]}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
          <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto pr-1 scrollbar-thin dark:divide-white/10">
            {filteredExpenses.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink dark:text-white">
                    {e.description || categoryLabel[e.category]}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted dark:text-white/50">
                    {formatDate(e.date)} · {categoryLabel[e.category]} ·{" "}
                    {getFieldName(e.fieldId)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="whitespace-nowrap tabular-nums text-ink dark:text-white">
                    {formatCurrency(e.amount)}
                  </span>
                  <button
                    onClick={() => openEditExpense(e)}
                    aria-label="Edit biaya"
                    className={iconButton}
                  >
                    <FiEdit2 size={14} />
                  </button>
                </div>
              </li>
            ))}
            {filteredExpenses.length === 0 ? (
              <li className="py-8 text-center text-sm text-ink-muted dark:text-white/50">
                {expCat === "all" && expField === "all"
                  ? "Belum ada biaya."
                  : "Tidak ada biaya untuk filter ini."}
              </li>
            ) : null}
          </ul>
        </Card>

        <Card className="min-w-0 p-6">
          <CardHeader
            title={`Pendapatan · ${periodLabel}`}
            description={`${recentRevenues.length} transaksi`}
          />
          <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto pr-1 scrollbar-thin dark:divide-white/10">
            {recentRevenues.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink dark:text-white">
                    {r.product}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted dark:text-white/50">
                    {formatDate(r.date)} · {getFieldName(r.fieldId)}
                    {r.quantityKg ? ` · ${formatNumber(r.quantityKg)} kg` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="whitespace-nowrap tabular-nums text-leaf-700 dark:text-[#8fdcae]">
                    {formatCurrency(r.amount)}
                  </span>
                  <button
                    onClick={() => openEditRevenue(r)}
                    aria-label="Edit pendapatan"
                    className={iconButton}
                  >
                    <FiEdit2 size={14} />
                  </button>
                </div>
              </li>
            ))}
            {recentRevenues.length === 0 ? (
              <li className="py-8 text-center text-sm text-ink-muted dark:text-white/50">
                Belum ada pendapatan.
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      {/* Target & hasil panen per musim (sumber data Produktivitas di Showcase) */}
      <Card className="mt-6 p-6">
        <CardHeader
          title="Target & hasil panen per musim"
          description="Atur target & hasil panen (kg) tiap musim. Angka ini menjadi sumber metrik Produktivitas per Lahan (kg/m²) dan HPP di Showcase — terpisah dari jadwal panen / status overdue yang diatur di Field Management."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => openTarget(null)}
            >
              <FiTarget size={14} /> Set Target
            </Button>
          }
        />
        <div className={tableWrap}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className={theadClass}>
              <tr>
                <th className={`${thClass} pl-0`}>Lahan</th>
                <th className={thClass}>Musim</th>
                <th className={`${thClass} text-right`}>Target (kg)</th>
                <th className={`${thClass} text-right`}>Hasil (kg)</th>
                <th className={`${thClass} pr-0 text-right`}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {targetRows.map((s) => {
                const report = getReportBySeason(s.id);
                const targetKg = report
                  ? Math.round(report.targetTon * 1000)
                  : 0;
                const yieldKg = report ? Math.round(report.yieldTon * 1000) : 0;
                return (
                  <tr key={s.id} className={trClass}>
                    <td
                      className={`${tdClass} pl-0 font-medium text-ink dark:text-white`}
                    >
                      {getFieldName(s.fieldId)}
                    </td>
                    <td
                      className={`${tdClass} text-ink-muted dark:text-white/70`}
                    >
                      {s.year} · {s.crop}
                    </td>
                    <td
                      className={`${tdClass} text-right tabular-nums text-ink-muted dark:text-white/70`}
                    >
                      {targetKg ? formatNumber(targetKg) : "—"}
                    </td>
                    <td
                      className={`${tdClass} text-right tabular-nums text-ink-muted dark:text-white/70`}
                    >
                      {yieldKg ? formatNumber(yieldKg) : "—"}
                    </td>
                    <td className={`${tdClass} pr-0 text-right`}>
                      <button
                        onClick={() => openTarget(s.id)}
                        aria-label="Edit target"
                        className={iconButton}
                      >
                        <FiEdit2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {targetRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-ink-muted dark:text-white/50"
                  >
                    Belum ada musim pada periode ini.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <CardHeader
          title="Rekap pemasukan & pengeluaran per tahun"
          description="Semua tahun sekaligus. R/C = pendapatan ÷ biaya; Δ = perubahan dibanding tahun sebelumnya (hijau bila menguntungkan)."
        />
        <YearlySummaryTable rows={yearly} />
      </Card>

      <Modal
        isOpen={modal === "expense"}
        onClose={closeModal}
        title={editingExpense ? "Edit Biaya" : "Tambah Biaya"}
      >
        <ExpenseFormFields editing={editingExpense} onDone={closeModal} />
      </Modal>
      <Modal
        isOpen={modal === "revenue"}
        onClose={closeModal}
        title={editingRevenue ? "Edit Pendapatan" : "Tambah Pendapatan"}
      >
        <RevenueFormFields editing={editingRevenue} onDone={closeModal} />
      </Modal>
      <Modal
        isOpen={modal === "target"}
        onClose={closeModal}
        title="Target & Hasil Panen"
      >
        <TargetFormFields seasonId={targetSeasonId} onDone={closeModal} />
      </Modal>
      <Modal
        isOpen={modal === "export"}
        onClose={closeModal}
        title="Ekspor Laporan Keuangan"
      >
        <ExportFormFields
          years={years}
          defaultPeriod={period}
          onDone={closeModal}
        />
      </Modal>
    </PageTransition>
  );
}

// =====================================================
// Form ekspor: format (PDF/Excel/Word), cakupan periode & lahan,
// serta jenis data. Berkas dibuat langsung di browser (tanpa server)
// dan selalu memuat timestamp pembuatan.
// =====================================================
const formatOptions: Array<{
  value: ExportFormat;
  label: string;
  hint: string;
  icon: typeof FiFileText;
}> = [
  {
    value: "pdf",
    label: "PDF",
    hint: "Potrait, siap cetak",
    icon: FiFileText,
  },
  {
    value: "excel",
    label: "Excel (.xlsx)",
    hint: "Satu sheet, angka bisa diolah",
    icon: FiGrid,
  },
  {
    value: "word",
    label: "Word (.docx)",
    hint: "Mudah diedit ulang",
    icon: FiFile,
  },
];

const kindOptions: Array<{ value: ExportKind; label: string }> = [
  { value: "both", label: "Pendapatan & Pengeluaran" },
  { value: "revenue", label: "Hanya Pendapatan" },
  { value: "expense", label: "Hanya Pengeluaran" },
];

function ExportFormFields({
  years,
  defaultPeriod,
  onDone,
}: {
  years: number[];
  defaultPeriod: Period;
  onDone: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [scope, setScope] = useState<"all" | "period">(
    defaultPeriod === "all" ? "all" : "period",
  );
  const [year, setYear] = useState<number>(
    defaultPeriod === "all"
      ? (years[0] ?? new Date().getFullYear())
      : defaultPeriod,
  );
  const [fieldId, setFieldId] = useState<string>("all");
  const [kind, setKind] = useState<ExportKind>("both");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = {
    period: scope === "all" ? ("all" as const) : year,
    fieldId,
    kind,
  };
  // Pratinjau jumlah baris agar pengguna tahu isi berkasnya sebelum mengunduh.
  const preview = useMemo(
    () => buildFinanceExport(options),
    [scope, year, fieldId, kind],
  );

  const onExport = () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const result = runFinanceExport(format, options);
      setDone(result.filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat berkas ekspor.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className={labelClass}>Format berkas</p>
        <div className="grid grid-cols-3 gap-2">
          {formatOptions.map((opt) => {
            const Icon = opt.icon;
            const active = format === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormat(opt.value)}
                className={`rounded-xl border px-2 py-3 text-center transition ${
                  active
                    ? "border-tulus-600 bg-tulus-50 text-tulus-800 ring-1 ring-tulus-600 dark:border-[#5E9FE8] dark:bg-[#5E9FE8]/15 dark:text-white dark:ring-[#5E9FE8]"
                    : "border-slate-200 text-ink-muted hover:border-slate-300 hover:bg-slate-50 dark:border-white/15 dark:text-white/65 dark:hover:bg-white/5"
                }`}
              >
                <Icon className="mx-auto mb-1" size={18} />
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-[11px] leading-tight text-slate-400">
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={labelClass}>Cakupan periode</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setScope("all")}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              scope === "all"
                ? "border-tulus-600 bg-tulus-50 font-medium text-tulus-800 dark:border-[#5E9FE8] dark:bg-[#5E9FE8]/15 dark:text-white"
                : "border-slate-200 text-ink-muted hover:bg-slate-50 dark:border-white/15 dark:text-white/65 dark:hover:bg-white/5"
            }`}
          >
            Semua data
          </button>
          <button
            type="button"
            onClick={() => setScope("period")}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              scope === "period"
                ? "border-tulus-600 bg-tulus-50 font-medium text-tulus-800 dark:border-[#5E9FE8] dark:bg-[#5E9FE8]/15 dark:text-white"
                : "border-slate-200 text-ink-muted hover:bg-slate-50 dark:border-white/15 dark:text-white/65 dark:hover:bg-white/5"
            }`}
          >
            Periode tertentu
          </button>
          {scope === "period" ? (
            <select
              className={`${inputClass} w-auto`}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {(years.length ? years : [new Date().getFullYear()]).map((y) => (
                <option key={y} value={y}>
                  Musim {y}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Lahan</label>
          <select
            className={inputClass}
            value={fieldId}
            onChange={(e) => setFieldId(e.target.value)}
          >
            <option value="all">Semua lahan</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Jenis data</label>
          <select
            className={inputClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as ExportKind)}
          >
            {kindOptions.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Pratinjau isi berkas
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
          <span>Transaksi</span>
          <span className="text-right font-medium">
            {formatNumber(preview.totals.count)} transaksi
          </span>
          <span>Pendapatan</span>
          <span className="text-right font-medium text-emerald-600">
            {formatCurrency(preview.totals.revenue)}
          </span>
          <span>Pengeluaran</span>
          <span className="text-right font-medium text-red-600 dark:text-[#E97366]">
            {formatCurrency(preview.totals.expense)}
          </span>
          <span>Untung / rugi</span>
          <span className="text-right font-medium">
            {formatCurrency(preview.totals.profit)}
          </span>
          <span>Margin / ROI</span>
          <span className="text-right font-medium">
            {formatNumber(preview.totals.margin)}% /{" "}
            {formatNumber(preview.totals.roi)}%
          </span>
        </div>
        <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-400">
          Timestamp pada berkas: {stamp(preview.generatedAt)}
        </p>
      </div>

      {done ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Berkas {formatLabel[format]} berhasil dibuat:{" "}
          <strong className="break-all">{done}</strong>
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-[#E97366]/15 dark:text-[#f0a59c]">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          Tutup
        </Button>
        <Button onClick={onExport} disabled={busy}>
          <FiDownload size={15} />{" "}
          {busy ? "Menyiapkan..." : `Unduh ${formatLabel[format]}`}
        </Button>
      </div>
    </div>
  );
}

interface ExpenseFormVals {
  fieldId: string;
  seasonId: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
}

function ExpenseFormFields({
  editing,
  onDone,
}: {
  editing: Expense | null;
  onDone: () => void;
}) {
  const { register, handleSubmit, watch, control } = useForm<ExpenseFormVals>({
    defaultValues: {
      fieldId: editing?.fieldId ?? fields[0]?.id ?? "",
      seasonId: editing?.seasonId ?? "",
      date: editing?.date ?? new Date().toISOString().slice(0, 10),
      category: editing?.category ?? "fertilizer",
      description: editing?.description ?? "",
      amount: editing?.amount,
    },
  });
  const fid = watch("fieldId");
  const seasonOptions = fid ? getSeasonsByField(fid) : [];

  const onSubmit = (v: ExpenseFormVals) => {
    const season = getSeasonById(v.seasonId);
    if (!season) return;
    const payload = {
      seasonId: v.seasonId,
      fieldId: season.fieldId,
      date: v.date,
      category: v.category,
      description: v.description,
      amount: v.amount,
    };
    if (editing) updateExpense(editing.id, payload);
    else addExpense(payload);
    onDone();
  };

  const onDelete = () => {
    if (editing) removeExpense(editing.id);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Lahan</label>
          <select className={inputClass} {...register("fieldId")}>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Musim</label>
          <select
            className={inputClass}
            {...register("seasonId", { required: true })}
          >
            <option value="">— pilih musim —</option>
            {seasonOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.year} · {s.crop}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Kategori</label>
          <select className={inputClass} {...register("category")}>
            <option value="seeds">Benih</option>
            <option value="fertilizer">Pupuk</option>
            <option value="labor">Tenaga Kerja</option>
            <option value="equipment">Peralatan</option>
            <option value="irrigation">Irigasi</option>
            <option value="pesticide">Pestisida</option>
            <option value="logistics">Logistik</option>
            <option value="rent">Sewa</option>
            <option value="tax">Pajak</option>
            <option value="other">Lain-lain</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Jumlah (Rp)</label>
          <CurrencyInput
            control={control}
            name="amount"
            prefix="Rp"
            required
            className={inputClass}
            placeholder="1.000.000"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Deskripsi</label>
        <input
          className={inputClass}
          placeholder="mis. Pupuk NPK 50 kg"
          {...register("description", { required: true })}
        />
      </div>
      <div>
        <label className={labelClass}>Tanggal</label>
        <input type="date" className={inputClass} {...register("date")} />
      </div>
      <div className="flex items-center justify-between pt-1">
        {editing ? (
          <Button type="button" variant="danger" onClick={onDelete}>
            <FiTrash2 size={14} /> Hapus
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit">Simpan Biaya</Button>
      </div>
    </form>
  );
}

interface RevenueFormVals {
  fieldId: string;
  seasonId: string;
  date: string;
  product: string;
  quantityKg: number;
  amount: number;
}

function RevenueFormFields({
  editing,
  onDone,
}: {
  editing: Revenue | null;
  onDone: () => void;
}) {
  const { register, handleSubmit, watch, control } = useForm<RevenueFormVals>({
    defaultValues: {
      fieldId: editing?.fieldId ?? fields[0]?.id ?? "",
      seasonId: editing?.seasonId ?? "",
      date: editing?.date ?? new Date().toISOString().slice(0, 10),
      product: editing?.product ?? "Tebu",
      quantityKg: editing?.quantityKg,
      amount: editing?.amount,
    },
  });
  const fid = watch("fieldId");
  const seasonOptions = fid ? getSeasonsByField(fid) : [];

  const onSubmit = (v: RevenueFormVals) => {
    const season = getSeasonById(v.seasonId);
    if (!season) return;
    const qty = num(v.quantityKg);
    const payload = {
      seasonId: v.seasonId,
      fieldId: season.fieldId,
      date: v.date,
      product: v.product,
      quantityKg: qty,
      pricePerKg: qty && qty > 0 ? Math.round(v.amount / qty) : undefined,
      amount: v.amount,
    };
    if (editing) updateRevenue(editing.id, payload);
    else addRevenue(payload);
    onDone();
  };

  const onDelete = () => {
    if (editing) removeRevenue(editing.id);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Lahan</label>
          <select className={inputClass} {...register("fieldId")}>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Musim</label>
          <select
            className={inputClass}
            {...register("seasonId", { required: true })}
          >
            <option value="">— pilih musim —</option>
            {seasonOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.year} · {s.crop}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Produk</label>
        <input
          className={inputClass}
          placeholder="mis. Tebu giling"
          {...register("product", { required: true })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Jumlah (kg) — opsional</label>
          <CurrencyInput
            control={control}
            name="quantityKg"
            className={inputClass}
            placeholder="mis. 14.000"
          />
        </div>
        <div>
          <label className={labelClass}>Total Pendapatan (Rp)</label>
          <CurrencyInput
            control={control}
            name="amount"
            prefix="Rp"
            required
            className={inputClass}
            placeholder="9.000.000"
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Jika jumlah (kg) diisi, harga/kg akan dihitung otomatis dari total
        pendapatan.
      </p>
      <div>
        <label className={labelClass}>Tanggal</label>
        <input type="date" className={inputClass} {...register("date")} />
      </div>
      <div className="flex items-center justify-between pt-1">
        {editing ? (
          <Button type="button" variant="danger" onClick={onDelete}>
            <FiTrash2 size={14} /> Hapus
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit">Simpan Pendapatan</Button>
      </div>
    </form>
  );
}

interface TargetFormVals {
  seasonId: string;
  targetKg: number;
  yieldKg: number;
}

function TargetFormFields({
  seasonId,
  onDone,
}: {
  seasonId: string | null;
  onDone: () => void;
}) {
  const existing = seasonId ? getReportBySeason(seasonId) : undefined;
  const { register, handleSubmit, control } = useForm<TargetFormVals>({
    defaultValues: {
      seasonId: seasonId ?? "",
      targetKg: existing ? Math.round(existing.targetTon * 1000) : undefined,
      yieldKg: existing ? Math.round(existing.yieldTon * 1000) : undefined,
    },
  });

  const onSubmit = (v: TargetFormVals) => {
    const season = getSeasonById(v.seasonId);
    if (!season) return;
    const targetKg = num(v.targetKg);
    const yieldKg = num(v.yieldKg);
    const patch: { targetTon?: number; yieldTon?: number } = {};
    if (targetKg !== undefined) patch.targetTon = targetKg / 1000;
    if (yieldKg !== undefined) patch.yieldTon = yieldKg / 1000;
    upsertSeasonReport(v.seasonId, season.fieldId, patch);
    onDone();
  };

  const sortedSeasons = [...seasons].sort((a, b) => b.year - a.year);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label className={labelClass}>Musim</label>
        <select
          className={inputClass}
          disabled={Boolean(seasonId)}
          {...register("seasonId", { required: true })}
        >
          <option value="">— pilih musim —</option>
          {sortedSeasons.map((s) => (
            <option key={s.id} value={s.id}>
              {getFieldName(s.fieldId)} · {s.year} {s.crop}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Target Panen (kg)</label>
          <CurrencyInput
            control={control}
            name="targetKg"
            required
            className={inputClass}
            placeholder="mis. 14.500"
          />
        </div>
        <div>
          <label className={labelClass}>Hasil Panen (kg) — opsional</label>
          <CurrencyInput
            control={control}
            name="yieldKg"
            className={inputClass}
            placeholder="isi setelah panen"
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Target ini dipakai pada grafik Produktivitas per Lahan (kg/m²) di
        halaman Showcase.
      </p>
      <div className="flex justify-end pt-1">
        <Button type="submit">Simpan Target</Button>
      </div>
    </form>
  );
}
