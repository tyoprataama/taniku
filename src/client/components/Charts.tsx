import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
} from "../../utils/format";
import { useTheme } from "../theme";
import { ChartLegend, Segmented } from "./ChartCard";
import type {
  KpiItem,
  YieldRow,
  CostRow,
  PnlRow,
  FieldFinanceRow,
  HarvestDeviationRow,
  HarvestDeviationCategory,
  YearlyRow,
  CashflowRow,
  
} from "../utils/analytics";

// =====================================================
// Palet grafik (sadar tema terang/gelap).
// Aturan warna dibuat SERAGAM di semua grafik:
//   Pendapatan = hijau · Biaya = biru · Laba = netral (tinta)
//   Margin = kuning · ROI = ungu · Rugi/terlambat = merah
// =====================================================
const CAT_COLORS_LIGHT = [
  "#214e8a",
  "#1aa46a",
  "#f59e0b",
  "#5181c0",
  "#94a3b8",
  "#7ea4d6",
  "#138a58",
  "#0f766e",
  "#b45309",
  "#64748b",
];
const CAT_COLORS_DARK = [
  "#5E9FE8",
  "#72BC8F",
  "#EAC26B",
  "#BF8EDA",
  "#9aa4b2",
  "#4FB9C9",
  "#DE9255",
  "#7DD3C0",
  "#F4A261",
  "#CBD5E1",
];

const DEV_COLORS_LIGHT: Record<HarvestDeviationCategory, string> = {
  cepat: "#1aa46a",
  sesuai: "#94a3b8",
  telat: "#ef4444",
  berjalan: "#214e8a",
};
const DEV_COLORS_DARK: Record<HarvestDeviationCategory, string> = {
  cepat: "#72BC8F",
  sesuai: "#9aa4b2",
  telat: "#E97366",
  berjalan: "#5E9FE8",
};

const DEV_LABEL: Record<HarvestDeviationCategory, string> = {
  cepat: "Panen lebih cepat",
  sesuai: "Tepat target",
  telat: "Telat / overdue",
  berjalan: "Sedang berjalan",
};

const DEV_LEGEND: HarvestDeviationCategory[] = [
  "cepat",
  "sesuai",
  "berjalan",
  "telat",
];

function useChartTheme() {
  const { isDark } = useTheme();
  return {
    isDark,
    text: isDark ? "#ffffff" : "#0c111b",
    muted: isDark ? "rgba(255,255,255,0.55)" : "#5b6675",
    grid: isDark ? "rgba(255,255,255,0.08)" : "#e8edf3",
    zero: isDark ? "rgba(255,255,255,0.3)" : "#aeb8c6",
    surface: isDark ? "#202020" : "#ffffff",
    track: isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9",
    cursorFill: isDark ? "rgba(255,255,255,0.05)" : "rgba(33,78,138,0.05)",
    revenue: isDark ? "#72BC8F" : "#1aa46a",
    expense: isDark ? "#5E9FE8" : "#214e8a",
    profit: isDark ? "#ffffff" : "#0c111b",
    loss: isDark ? "#E97366" : "#ef4444",
    margin: isDark ? "#EAC26B" : "#f59e0b",
    roi: isDark ? "#B794F4" : "#8b5cf6",
    catColors: isDark ? CAT_COLORS_DARK : CAT_COLORS_LIGHT,
    devColors: isDark ? DEV_COLORS_DARK : DEV_COLORS_LIGHT,
  };
}

type ChartTheme = ReturnType<typeof useChartTheme>;

// ---------- Konstanta kecil & formatter ----------
const axisTick = (fill: string) => ({ fontSize: 11, fill });
const chartMargin = { top: 8, right: 4, bottom: 0, left: 0 };
const barRadius: [number, number, number, number] = [5, 5, 0, 0];
const activeDotCfg = { r: 5, strokeWidth: 2 };
const dotColor = (c: string) => ({ backgroundColor: c });
const textColor = (c: string) => ({ color: c });
const barWidth = (pct: number) => ({ width: `${pct}%` });

// Format ringkas khusus sumbu: 35jt, -35jt, 1,2M, 500rb.
const fmtRpAxis = (v: number) => {
  const n = Number(v);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000)
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000_000) return `${sign}${Math.round(abs / 1_000_000)}jt`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}rb`;
  return `${sign}${abs}`;
};
const fmtPctAxis = (v: number) => `${formatNumber(Number(v))}%`;
const fmtSignedDays = (v: number) =>
  v === 0 ? "0 hari" : `${v > 0 ? "+" : "−"}${formatNumber(Math.abs(v))} hari`;

// ---------- Tooltip generik (satu gaya untuk semua grafik) ----------
type TipRow = { label: string; value: string; color?: string };
type TipContent = {
  title: string;
  subtitle?: string;
  rows: TipRow[];
  note?: string;
  noteColor?: string;
};

function ChartTip({
  active,
  payload,
  build,
}: {
  active?: boolean;
  payload?: Array<{ payload?: unknown }>;
  build: (row: any) => TipContent | null;
}) {
  const row = payload && payload.length ? payload[0]?.payload : undefined;
  if (!active || !row) return null;
  const c = build(row);
  if (!c) return null;
  return (
    <div className="min-w-[190px] max-w-[260px] rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs shadow-lg dark:border-white/15 dark:bg-[#202020]">
      <p className="font-semibold text-ink dark:text-white">{c.title}</p>
      {c.subtitle ? (
        <p className="mt-0.5 text-ink-muted dark:text-white/55">{c.subtitle}</p>
      ) : null}
      <ul className="mt-2 space-y-1.5">
        {c.rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center justify-between gap-4"
          >
            <span className="inline-flex items-center gap-1.5 text-ink-muted dark:text-white/65">
              {r.color ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={dotColor(r.color)}
                />
              ) : null}
              {r.label}
            </span>
            <span className="font-medium tabular-nums text-ink dark:text-white">
              {r.value}
            </span>
          </li>
        ))}
      </ul>
      {c.note ? (
        <p
          className="mt-2 border-t border-slate-100 pt-2 dark:border-white/10"
          style={c.noteColor ? textColor(c.noteColor) : undefined}
        >
          {c.note}
        </p>
      ) : null}
    </div>
  );
}

// ---------- Sparkline ----------
export function Sparkline({
  data,
  color = "#214e8a",
}: {
  data: number[];
  color?: string;
}) {
  const d = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={d} margin={{ top: 3, bottom: 3, left: 0, right: 0 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// =====================================================
// KPI cards
// =====================================================
function formatKpi(it: KpiItem): string {
  if (it.format === "rp") return formatCompactCurrency(it.current);
  if (it.format === "pct") return `${formatNumber(it.current)}%`;
  return `${formatNumber(it.current)}${it.unit ? " " + it.unit : ""}`;
}

// Baris terakhir yang tidak penuh diperlebar agar grid tetap rapi.
function kpiSpan(index: number, total: number): string {
  const isLast = index === total - 1;
  const isSecondLast = index === total - 2;
  const lg = total % 4;
  let cls = "";
  if (isLast && total % 2 === 1) cls += "sm:max-lg:col-span-2 ";
  if (lg === 1 && isLast) cls += "lg:col-span-4";
  else if (lg === 2 && (isLast || isSecondLast)) cls += "lg:col-span-2";
  else if (lg === 3 && isLast) cls += "lg:col-span-2";
  return cls;
}

export function KpiCards({ items }: { items: KpiItem[] }) {
  const t = useChartTheme();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it, i) => {
        const empty = Boolean(it.empty);
        const delta =
          it.benchmark !== 0
            ? Math.round(
                ((it.current - it.benchmark) / Math.abs(it.benchmark)) * 100,
              )
            : 0;
        const up = delta >= 0;
        // "Baik" bergantung pada jenis metrik: biaya turun = baik.
        const favorable = (it.higherIsBetter ?? true) ? up : !up;
        const provisional = Boolean(it.provisional) && !empty;
        // Angka minus pada musim berjalan hanya sementara: jangan diberi warna merah.
        const negative = !empty && it.current < 0 && !provisional;
        return (
          <div
            key={it.key}
            className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#202020] ${kpiSpan(i, items.length)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-ink-muted dark:text-white/60">
                {it.label}
              </p>
              {provisional ? (
                <span
                  title="Musim masih berjalan: angka ini belum final"
                  className="shrink-0 rounded-full bg-tulus-50 px-2 py-0.5 text-[10px] font-medium text-tulus-700 dark:bg-[#5E9FE8]/15 dark:text-[#8fbdf0]"
                >
                  Sementara
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p
                className={`min-w-0 break-words font-display text-[1.75rem] font-medium leading-none tabular-nums ${
                  negative
                    ? "text-red-600 dark:text-[#E97366]"
                    : empty
                      ? "text-slate-300 dark:text-white/25"
                      : "text-ink dark:text-white"
                }`}
              >
                {empty ? "—" : formatKpi(it)}
              </p>
              {!empty ? (
                <div className="h-7 w-14 shrink-0 opacity-70">
                  <Sparkline
                    data={it.series}
                    color={
                      provisional
                        ? t.expense
                        : negative
                          ? t.loss
                          : favorable
                            ? t.revenue
                            : t.expense
                    }
                  />
                </div>
              ) : null}
            </div>
            {it.hint ? (
              <p className="mt-2 text-xs leading-snug text-ink-muted dark:text-white/45">
                {empty ? "Belum ada data hasil panen/pendapatan." : it.hint}
              </p>
            ) : null}
            {!empty ? (
              <div className="mt-auto flex items-center gap-2 pt-4 text-xs">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    provisional
                      ? "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/65"
                      : favorable
                        ? "bg-leaf-50 text-leaf-700 dark:bg-[#72BC8F]/15 dark:text-[#8fdcae]"
                        : "bg-red-50 text-red-700 dark:bg-[#E97366]/15 dark:text-[#f0a59c]"
                  }`}
                >
                  {up ? "\u25B2" : "\u25BC"} {Math.abs(delta)}%
                </span>
                <span className="text-ink-muted dark:text-white/45">
                  vs {it.benchmarkLabel}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// Tren all-time per tahun
// Dua tampilan agar tiap grafik hanya punya satu sumbu:
//   • Rupiah: pendapatan & pengeluaran (batang) + laba bersih (garis)
//   • Rasio : margin bersih & ROI (garis, %)
// =====================================================
type AllTimeRow = {
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  roi: number;
};

export function AllTimeTrendChart({ data }: { data: AllTimeRow[] }) {
  const t = useChartTheme();
  const [view, setView] = useState<"rp" | "pct">("rp");
  const tick = axisTick(t.muted);
  const tickInk = axisTick(t.text);

  const buildTip = (row: AllTimeRow): TipContent =>
    view === "rp"
      ? {
          title: `Tahun ${row.year}`,
          rows: [
            {
              label: "Pendapatan",
              value: formatCurrency(row.revenue),
              color: t.revenue,
            },
            {
              label: "Pengeluaran",
              value: formatCurrency(row.expenses),
              color: t.expense,
            },
            {
              label: "Laba bersih",
              value: formatCurrency(row.profit),
              color: t.profit,
            },
          ],
        }
      : {
          title: `Tahun ${row.year}`,
          rows: [
            {
              label: "Margin bersih",
              value: `${formatNumber(row.margin)}%`,
              color: t.margin,
            },
            { label: "ROI", value: `${formatNumber(row.roi)}%`, color: t.roi },
          ],
        };

  const dotFor = (stroke: string) => ({
    r: 3.5,
    strokeWidth: 2,
    stroke,
    fill: t.surface,
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Tampilan grafik"
          value={view}
          onChange={setView}
          options={[
            { value: "rp", label: "Rupiah" },
            { value: "pct", label: "Margin & ROI" },
          ]}
        />
        <ChartLegend
          items={
            view === "rp"
              ? [
                  { label: "Pendapatan", color: t.revenue },
                  { label: "Pengeluaran", color: t.expense },
                  { label: "Laba bersih", color: t.profit, shape: "line" },
                ]
              : [
                  { label: "Margin bersih", color: t.margin, shape: "line" },
                  { label: "ROI", color: t.roi, shape: "line" },
                ]
          }
        />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        {view === "rp" ? (
          <ComposedChart
            data={data}
            margin={chartMargin}
            barGap={4}
            barCategoryGap="32%"
          >
            <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 4" />
            <XAxis
              dataKey="year"
              tick={tickInk}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={tick}
              tickFormatter={fmtRpAxis}
              width={46}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke={t.zero} />
            <Tooltip
              content={<ChartTip build={buildTip} />}
              cursor={{ fill: t.cursorFill }}
            />
            <Bar
              dataKey="revenue"
              name="Pendapatan"
              fill={t.revenue}
              radius={barRadius}
              maxBarSize={24}
            />
            <Bar
              dataKey="expenses"
              name="Pengeluaran"
              fill={t.expense}
              radius={barRadius}
              maxBarSize={24}
            />
            <Line
              type="monotone"
              dataKey="profit"
              name="Laba bersih"
              stroke={t.profit}
              strokeWidth={2}
              dot={dotFor(t.profit)}
              activeDot={activeDotCfg}
            />
          </ComposedChart>
        ) : (
          <LineChart data={data} margin={chartMargin}>
            <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 4" />
            <XAxis
              dataKey="year"
              tick={tickInk}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={tick}
              tickFormatter={fmtPctAxis}
              width={46}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke={t.zero} />
            <Tooltip
              content={<ChartTip build={buildTip} />}
              cursor={{ stroke: t.zero, strokeDasharray: "3 3" }}
            />
            <Line
              type="monotone"
              dataKey="margin"
              name="Margin bersih"
              stroke={t.margin}
              strokeWidth={2}
              dot={dotFor(t.margin)}
              activeDot={activeDotCfg}
            />
            <Line
              type="monotone"
              dataKey="roi"
              name="ROI"
              stroke={t.roi}
              strokeWidth={2}
              dot={dotFor(t.roi)}
              activeDot={activeDotCfg}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// =====================================================
// Riwayat keuangan satu lahan (per musim)
//   • Rupiah: pendapatan vs pengeluaran (batang) + laba (garis)
//   • ROI   : ROI tiap musim (batang; merah bila negatif)
// =====================================================
function fieldFinanceTip(row: FieldFinanceRow, t: ChartTheme): TipContent {
  const pctColor = (v: number) =>
    v < 0 ? t.loss : v > 0 ? t.revenue : t.muted;
  let note = "Musim pertama lahan ini.";
  let noteColor: string = t.muted;
  if (row.roiDelta !== null && row.prevRoi !== null) {
    note = `${row.roiDelta >= 0 ? "\u25B2" : "\u25BC"} ${formatNumber(
      Math.abs(row.roiDelta),
    )} poin ROI vs musim sebelumnya (${formatNumber(row.prevRoi)}%)`;
    noteColor = pctColor(row.roiDelta);
  }
  return {
    title: row.label,
    subtitle: `${row.crop} · ${row.year}`,
    rows: [
      {
        label: "Pendapatan",
        value: formatCurrency(row.revenue),
        color: t.revenue,
      },
      {
        label: "Pengeluaran",
        value: formatCurrency(row.expenses),
        color: t.expense,
      },
      { label: "Laba bersih", value: formatCurrency(row.profit), color: t.profit },
      {
        label: "Margin",
        value: `${formatNumber(row.margin)}%`,
        color: t.margin,
      },
      { label: "ROI", value: `${formatNumber(row.roi)}%`, color: t.roi },
    ],
    note,
    noteColor,
  };
}

export function FieldFinanceChart({ data }: { data: FieldFinanceRow[] }) {
  const t = useChartTheme();
  const [view, setView] = useState<"rp" | "roi">("rp");
  const tick = axisTick(t.muted);
  const tickInk = axisTick(t.text);
  const buildTip = (row: FieldFinanceRow) => fieldFinanceTip(row, t);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Tampilan grafik"
          value={view}
          onChange={setView}
          options={[
            { value: "rp", label: "Rupiah" },
            { value: "roi", label: "ROI" },
          ]}
        />
        <ChartLegend
          items={
            view === "rp"
              ? [
                  { label: "Uang masuk", color: t.revenue },
                  { label: "Uang keluar", color: t.expense },
                  { label: "Laba", color: t.profit, shape: "line" },
                ]
              : [
                  { label: "ROI positif", color: t.roi },
                  { label: "ROI negatif", color: t.loss },
                ]
          }
        />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        {view === "rp" ? (
          <ComposedChart
            data={data}
            margin={chartMargin}
            barGap={4}
            barCategoryGap="30%"
          >
            <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 4" />
            <XAxis
              dataKey="year"
              tick={tickInk}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={tick}
              tickFormatter={fmtRpAxis}
              width={46}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke={t.zero} />
            <Tooltip
              content={<ChartTip build={buildTip} />}
              cursor={{ fill: t.cursorFill }}
            />
            <Bar
              dataKey="revenue"
              name="Pendapatan"
              fill={t.revenue}
              radius={barRadius}
              maxBarSize={22}
            />
            <Bar
              dataKey="expenses"
              name="Pengeluaran"
              fill={t.expense}
              radius={barRadius}
              maxBarSize={22}
            />
            <Line
              type="monotone"
              dataKey="profit"
              name="Laba bersih"
              stroke={t.profit}
              strokeWidth={2}
              dot={{ r: 3.5, strokeWidth: 2, stroke: t.profit, fill: t.surface }}
              activeDot={activeDotCfg}
            />
          </ComposedChart>
        ) : (
          <BarChart data={data} margin={chartMargin} barCategoryGap="38%">
            <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 4" />
            <XAxis
              dataKey="year"
              tick={tickInk}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={tick}
              tickFormatter={fmtPctAxis}
              width={46}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke={t.zero} />
            <Tooltip
              content={<ChartTip build={buildTip} />}
              cursor={{ fill: t.cursorFill }}
            />
            <Bar
              dataKey="roi"
              name="ROI"
              radius={barRadius}
              maxBarSize={36}
            >
              {data.map((row) => (
                <Cell
                  key={row.seasonId}
                  fill={row.roi < 0 ? t.loss : t.roi}
                />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// =====================================================
// Produktivitas per lahan (kg/m²): aktual vs target
// =====================================================
export function YieldBulletChart({ data }: { data: YieldRow[] }) {
  const t = useChartTheme();
  const tick = axisTick(t.muted);
  const tickInk = axisTick(t.text);
  const buildTip = (row: YieldRow): TipContent => ({
    title: row.field,
    rows: [
      {
        label: "Target",
        value: `${formatNumber(row.target)} kg/m²`,
        color: t.isDark ? "#3a5170" : "#aec6e8",
      },
      {
        label: "Aktual",
        value: `${formatNumber(row.actual)} kg/m²`,
        color: t.revenue,
      },
    ],
  });
  return (
    <div>
      <div className="mb-4">
        <ChartLegend
          items={[
            { label: "Target", color: t.isDark ? "#3a5170" : "#aec6e8" },
            { label: "Aktual", color: t.revenue },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 60)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
          barGap={3}
        >
          <CartesianGrid horizontal={false} stroke={t.grid} strokeDasharray="3 4" />
          <XAxis
            type="number"
            tick={tick}
            tickFormatter={(v: number) => formatNumber(Number(v))}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            width={100}
            tick={tickInk}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<ChartTip build={buildTip} />}
            cursor={{ fill: t.cursorFill }}
          />
          <Bar
            dataKey="target"
            name="Target"
            fill={t.isDark ? "#3a5170" : "#aec6e8"}
            radius={[0, 5, 5, 0]}
            barSize={10}
          />
          <Bar
            dataKey="actual"
            name="Aktual"
            fill={t.revenue}
            radius={[0, 5, 5, 0]}
            barSize={10}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// =====================================================
// Komposisi biaya: donut + daftar kategori bersebelahan
// =====================================================
export function CostDonutChart({
  data,
  year,
  total,
}: {
  data: CostRow[];
  year: number;
  /** Opsional: total biaya musim, ditampilkan di tengah donut. */
  total?: number;
}) {
  const t = useChartTheme();
  const buildTip = (row: CostRow): TipContent => ({
    title: row.category,
    rows: [
      { label: "Nominal", value: formatCurrency(row.year) },
      { label: "Porsi", value: `${row.yearPct}%` },
    ],
  });
  return (
    <div className="grid items-center gap-8 md:grid-cols-[240px_1fr]">
      <div className="relative mx-auto h-[220px] w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={<ChartTip build={buildTip} />}
              wrapperStyle={{ zIndex: 50 }}
            />
            <Pie
              data={data}
              dataKey="year"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={72}
              outerRadius={104}
              paddingAngle={2}
              cornerRadius={3}
              stroke={t.surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((row, i) => (
                <Cell
                  key={`y-${row.category}`}
                  fill={t.catColors[i % t.catColors.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] uppercase tracking-wider text-ink-muted dark:text-white/50">
            Musim {year}
          </span>
          {total !== undefined ? (
            <span className="mt-0.5 font-display text-lg font-medium tabular-nums text-ink dark:text-white">
              {formatCompactCurrency(total)}
            </span>
          ) : null}
        </div>
      </div>
      <ul className="grid gap-x-8 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
        {data.map((row, i) => (
          <li
            key={row.category}
            className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 text-sm dark:border-white/10"
          >
            <span className="inline-flex min-w-0 items-center gap-2.5 capitalize text-ink dark:text-white/85">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={dotColor(t.catColors[i % t.catColors.length])}
              />
              <span className="truncate">{row.category}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink-muted dark:text-white/60">
              <span className="mr-2 hidden text-xs sm:inline">
                {formatCompactCurrency(row.year)}
              </span>
              <span className="font-medium text-ink dark:text-white">
                {row.yearPct}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =====================================================
// P&L per lahan: batang pendapatan vs biaya + tabel ringkas
// (margin ditampilkan di tabel, bukan garis di sumbu kedua)
// =====================================================
export function PnLChart({
  rows,
  allTimeMargin,
}: {
  rows: PnlRow[];
  allTimeMargin: number;
}) {
  const t = useChartTheme();
  const tick = axisTick(t.muted);
  const tickInk = axisTick(t.text);
  const buildTip = (row: PnlRow): TipContent => ({
    title: row.field,
    rows: [
      {
        label: "Pendapatan",
        value: formatCurrency(row.revenue),
        color: t.revenue,
      },
      { label: "Biaya", value: formatCurrency(row.cost), color: t.expense },
      { label: "Laba", value: formatCurrency(row.profit), color: t.profit },
      { label: "Margin", value: `${formatNumber(row.margin)}%`, color: t.margin },
    ],
  });
  const tone = (v: number) =>
    v < 0
      ? "text-red-600 dark:text-[#E97366]"
      : v > 0
        ? "text-leaf-700 dark:text-[#8fdcae]"
        : "text-ink-muted dark:text-white/60";

  return (
    <div>
      <div className="mb-4">
        <ChartLegend
          items={[
            { label: "Pendapatan", color: t.revenue },
            { label: "Biaya", color: t.expense },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={rows}
          margin={chartMargin}
          barGap={4}
          barCategoryGap="32%"
        >
          <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 4" />
          <XAxis
            dataKey="field"
            tick={tickInk}
            tickFormatter={(v: string) => String(v).replace(/^Lahan /, "")}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={tick}
            tickFormatter={fmtRpAxis}
            width={46}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={0} stroke={t.zero} />
          <Tooltip
            content={<ChartTip build={buildTip} />}
            cursor={{ fill: t.cursorFill }}
          />
          <Bar
            dataKey="revenue"
            name="Pendapatan"
            fill={t.revenue}
            radius={barRadius}
            maxBarSize={26}
          />
          <Bar
            dataKey="cost"
            name="Biaya"
            fill={t.expense}
            radius={barRadius}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-5 overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm sm:min-w-[420px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-ink-muted dark:border-white/10 dark:text-white/50">
              <th className="py-2 pr-2 font-medium">Lahan</th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Pendapatan</th>
              <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Biaya</th>
              <th className="px-2 py-2 text-right font-medium">Laba</th>
              <th className="py-2 pl-2 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.field}
                className="border-b border-slate-100 last:border-b-0 dark:border-white/[0.07]"
              >
                <td className="whitespace-nowrap py-2.5 pr-2 font-medium text-ink dark:text-white">
                  {r.field.replace(/^Lahan /, "")}
                </td>
                <td className="hidden whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-ink-muted dark:text-white/70 sm:table-cell">
                  {formatCompactCurrency(r.revenue)}
                </td>
                <td className="hidden whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-ink-muted dark:text-white/70 sm:table-cell">
                  {formatCompactCurrency(r.cost)}
                </td>
                <td
                  className={`whitespace-nowrap px-2 py-2.5 text-right font-medium tabular-nums ${tone(r.profit)}`}
                >
                  {formatCompactCurrency(r.profit)}
                </td>
                <td
                  className={`whitespace-nowrap py-2.5 pl-2 text-right font-medium tabular-nums ${tone(r.margin)}`}
                >
                  {formatNumber(r.margin)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted dark:text-white/50">
        Margin bersih all-time seluruh lahan:{" "}
        <span className="font-medium text-ink dark:text-white/80">
          {formatNumber(allTimeMargin)}%
        </span>
      </p>
    </div>
  );
}

// =====================================================
// Durasi tanam–panen: deviasi hari terhadap target (diverging bar)
// Dibuat dengan baris HTML/CSS (bukan sumbu recharts) agar label
// nama lahan tidak terpotong dan tetap rapi di layar kecil.
// =====================================================
export function HarvestDeviationChart({
  data,
}: {
  data: HarvestDeviationRow[];
}) {
  const t = useChartTheme();
  const negMax = Math.max(0, ...data.map((d) => -d.deviationDays));
  const posMax = Math.max(0, ...data.map((d) => d.deviationDays));
  const span = negMax + posMax || 1;
  const zeroPct = (negMax / span) * 100;

  return (
    <div className="flex h-full flex-col">
      <ul className="mb-6 space-y-6">
        {data.map((row) => {
          const v = row.deviationDays;
          const w = Math.max((Math.abs(v) / span) * 100, v === 0 ? 0 : 1.5);
          const left = v >= 0 ? zeroPct : zeroPct - w;
          const color = t.devColors[row.category];
          return (
            <li key={row.field}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-sm font-medium text-ink dark:text-white">
                  {row.field}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium"
                  style={textColor(color)}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={dotColor(color)}
                  />
                  {DEV_LABEL[row.category]} · {fmtSignedDays(v)}
                </span>
              </div>
              <div
                className="relative mt-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: t.track }}
              >
                <span
                  className="absolute -bottom-1 -top-1 w-px"
                  style={{ left: `${zeroPct}%`, backgroundColor: t.zero }}
                />
                <span
                  className="absolute top-0 h-full rounded-full"
                  style={{
                    ...barWidth(w),
                    left: `${left}%`,
                    backgroundColor: color,
                    minWidth: v === 0 ? 3 : undefined,
                  }}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted dark:text-white/55">
                {row.detail}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
        <ChartLegend
          items={DEV_LEGEND.map((cat) => ({
            label: DEV_LABEL[cat],
            color: t.devColors[cat],
          }))}
        />
      </div>
    </div>
  );
}

// =====================================================
// Arus kas bulanan: uang masuk vs keluar + laba kumulatif
// =====================================================
export function MonthlyCashflowChart({ data }: { data: CashflowRow[] }) {
  const t = useChartTheme();
  const tick = axisTick(t.muted);
  const tickInk = axisTick(t.text);
  // Pengeluaran digambar sebagai nilai negatif agar batangnya turun ke bawah garis nol.
  const chartData = data.map((r) => ({ ...r, expensesNeg: -r.expenses }));
  const buildTip = (row: CashflowRow): TipContent => ({
    title: row.label,
    rows: [
      { label: "Uang masuk", value: formatCurrency(row.revenue), color: t.revenue },
      {
        label: "Uang keluar",
        value: row.expenses > 0 ? `−${formatCurrency(row.expenses)}` : formatCurrency(0),
        color: t.expense,
      },
      { label: "Selisih bulan ini", value: formatCurrency(row.net) },
      {
        label: "Laba kumulatif",
        value: formatCurrency(row.cumulative),
        color: t.profit,
      },
    ],
    note:
      row.cumulative < 0
        ? "Secara kumulatif belum mencapai titik impas."
        : "Secara kumulatif sudah melewati titik impas.",
    noteColor: row.cumulative < 0 ? t.muted : t.revenue,
  });
  return (
    <div>
      <div className="mb-4">
        <ChartLegend
          items={[
            { label: "Uang masuk (di atas nol)", color: t.revenue },
            { label: "Uang keluar (di bawah nol)", color: t.expense },
            { label: "Laba kumulatif", color: t.profit, shape: "line" },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={chartData}
          margin={chartMargin}
          stackOffset="sign"
          barCategoryGap="30%"
        >
          <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 4" />
          <XAxis
            dataKey="label"
            tick={tickInk}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={tick}
            tickFormatter={fmtRpAxis}
            width={46}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={0} stroke={t.zero} />
          <Tooltip
            content={<ChartTip build={buildTip} />}
            cursor={{ fill: t.cursorFill }}
          />
          <Bar
            dataKey="revenue"
            name="Uang masuk"
            stackId="cash"
            fill={t.revenue}
            radius={[5, 5, 0, 0]}
            maxBarSize={26}
          />
          <Bar
            dataKey="expensesNeg"
            name="Uang keluar"
            stackId="cash"
            fill={t.expense}
            radius={[5, 5, 0, 0]}
            maxBarSize={26}
          />
          <Line
            type="monotone"
            dataKey="cumulative"
            name="Laba kumulatif"
            stroke={t.profit}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, stroke: t.profit, fill: t.surface }}
            activeDot={activeDotCfg}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// =====================================================
// Biaya per kategori tiap tahun (batang bertumpuk)
// =====================================================
export function CostByYearChart({
  keys,
  data,
}: {
  keys: string[];
  data: Array<Record<string, number>>;
}) {
  const t = useChartTheme();
  const tick = axisTick(t.muted);
  const tickInk = axisTick(t.text);
  const buildTip = (row: Record<string, number>): TipContent => {
    const total = keys.reduce((s, k) => s + (row[k] ?? 0), 0);
    return {
      title: `Tahun ${row.year}`,
      rows: [
        ...keys
          .map((k, i) => ({
            label: k,
            raw: row[k] ?? 0,
            color: t.catColors[i % t.catColors.length],
          }))
          .filter((r) => r.raw > 0)
          .sort((a, b) => b.raw - a.raw)
          .map((r) => ({
            label: r.label,
            value: formatCompactCurrency(r.raw),
            color: r.color,
          })),
        { label: "Total", value: formatCompactCurrency(total) },
      ],
    };
  };
  return (
    <div>
      <div className="mb-4">
        <ChartLegend
          items={keys.map((k, i) => ({
            label: k,
            color: t.catColors[i % t.catColors.length],
          }))}
        />
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={chartMargin} barCategoryGap="38%">
          <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 4" />
          <XAxis dataKey="year" tick={tickInk} tickLine={false} axisLine={false} />
          <YAxis
            tick={tick}
            tickFormatter={fmtRpAxis}
            width={46}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<ChartTip build={buildTip} />}
            cursor={{ fill: t.cursorFill }}
          />
          {keys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              stackId="cost"
              fill={t.catColors[i % t.catColors.length]}
              maxBarSize={48}
              radius={i === keys.length - 1 ? barRadius : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// =====================================================
// Perjalanan balik modal: total pendapatan vs total biaya kumulatif
// =====================================================
export function PaybackChart({ data }: { data: YearlyRow[] }) {
  const t = useChartTheme();
  const tick = axisTick(t.muted);
  const tickInk = axisTick(t.text);
  const buildTip = (row: YearlyRow): TipContent => {
    const gap = row.cumRevenue - row.cumExpenses;
    const pct = row.cumExpenses > 0 ? (row.cumRevenue / row.cumExpenses) * 100 : 0;
    return {
      title: `Sampai akhir ${row.year}`,
      rows: [
        { label: "Pendapatan kumulatif", value: formatCurrency(row.cumRevenue), color: t.revenue },
        { label: "Biaya kumulatif", value: formatCurrency(row.cumExpenses), color: t.expense },
        { label: "Selisih", value: formatCurrency(gap) },
      ],
      note: `Balik modal ${formatNumber(Math.round(pct * 10) / 10)}%`,
      noteColor: gap >= 0 ? t.revenue : t.loss,
    };
  };
  return (
    <div>
      <div className="mb-4">
        <ChartLegend
          items={[
            { label: "Pendapatan kumulatif", color: t.revenue, shape: "line" },
            { label: "Biaya kumulatif", color: t.expense, shape: "line" },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 4" />
          <XAxis dataKey="year" tick={tickInk} tickLine={false} axisLine={false} />
          <YAxis
            tick={tick}
            tickFormatter={fmtRpAxis}
            width={46}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<ChartTip build={buildTip} />}
            cursor={{ stroke: t.zero, strokeDasharray: "3 3" }}
          />
          <Line
            type="monotone"
            dataKey="cumRevenue"
            name="Pendapatan kumulatif"
            stroke={t.revenue}
            strokeWidth={2}
            dot={{ r: 3.5, strokeWidth: 2, stroke: t.revenue, fill: t.surface }}
            activeDot={activeDotCfg}
          />
          <Line
            type="monotone"
            dataKey="cumExpenses"
            name="Biaya kumulatif"
            stroke={t.expense}
            strokeWidth={2}
            dot={{ r: 3.5, strokeWidth: 2, stroke: t.expense, fill: t.surface }}
            activeDot={activeDotCfg}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// =====================================================
// Tabel rekap per tahun
// =====================================================
function GrowthPill({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean }) {
  if (value === null) return <span className="text-ink-muted/50 dark:text-white/30">—</span>;
  if (value === 0) return <span className="text-ink-muted dark:text-white/50">0%</span>;
  const up = value > 0;
  const good = up === goodWhenUp;
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
        good
          ? "bg-leaf-50 text-leaf-700 dark:bg-[#72BC8F]/15 dark:text-[#8fdcae]"
          : "bg-red-50 text-red-700 dark:bg-[#E97366]/15 dark:text-[#f0a59c]"
      }`}
    >
      {up ? "\u25B2" : "\u25BC"} {formatNumber(Math.abs(value))}%
    </span>
  );
}

const th = "px-2 sm:px-3 py-2.5 text-right font-medium whitespace-nowrap";
const td = "px-2 sm:px-3 py-3 text-right tabular-nums whitespace-nowrap";
const signTone = (v: number) =>
  v < 0
    ? "text-red-600 dark:text-[#E97366]"
    : v > 0
      ? "text-leaf-700 dark:text-[#8fdcae]"
      : "text-ink-muted dark:text-white/60";

export function YearlySummaryTable({ rows }: { rows: YearlyRow[] }) {
  const list = [...rows].sort((a, b) => b.year - a.year);
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm sm:min-w-[760px]">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-ink-muted dark:border-white/10 dark:text-white/50">
            <th className="py-2.5 pr-3 text-left font-medium">Tahun</th>
            <th className={th}>Pendapatan</th>
            <th className={th}>Biaya</th>
            <th className={th}>Laba</th>
            <th className={`${th} hidden sm:table-cell`}>Margin</th>
            <th className={`${th} hidden sm:table-cell`}>ROI</th>
            <th className={th}>R/C</th>
            <th className={`${th} hidden sm:table-cell`}>Δ Pendapatan</th>
            <th className={`${th} hidden sm:table-cell`}>Δ Biaya</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr
              key={r.year}
              className="border-b border-slate-100 last:border-b-0 dark:border-white/[0.07]"
            >
              <td className="py-3 pr-3 font-medium text-ink dark:text-white">{r.year}</td>
              <td className={`${td} text-ink-muted dark:text-white/70`}>
                {formatCompactCurrency(r.revenue)}
              </td>
              <td className={`${td} text-ink-muted dark:text-white/70`}>
                {formatCompactCurrency(r.expenses)}
              </td>
              <td className={`${td} font-medium ${signTone(r.profit)}`}>
                {formatCompactCurrency(r.profit)}
              </td>
              <td className={`${td} hidden sm:table-cell ${signTone(r.margin)}`}>{formatNumber(r.margin)}%</td>
              <td className={`${td} hidden sm:table-cell ${signTone(r.roi)}`}>{formatNumber(r.roi)}%</td>
              <td className={`${td} text-ink dark:text-white/85`}>
                {formatNumber(r.rc)}×
              </td>
              <td className={`${td} hidden sm:table-cell`}>
                <GrowthPill value={r.revenueGrowth} goodWhenUp />
              </td>
              <td className={`${td} hidden sm:table-cell`}>
                <GrowthPill value={r.expenseGrowth} goodWhenUp={false} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =====================================================
// Perbandingan antar lahan (dipakai halaman admin Field Comparison)
// =====================================================
export function FieldComparisonChart({
  data,
}: {
  data: Array<{ name: string; revenue: number; cost: number; profit: number }>;
}) {
  const t = useChartTheme();
  const tick = axisTick(t.muted);
  const tickInk = axisTick(t.text);
  const buildTip = (row: { name: string; revenue: number; cost: number; profit: number }): TipContent => ({
    title: row.name,
    rows: [
      { label: "Pendapatan", value: formatCurrency(row.revenue), color: t.revenue },
      { label: "Biaya", value: formatCurrency(row.cost), color: t.expense },
      { label: "Laba", value: formatCurrency(row.profit), color: t.profit },
    ],
  });
  return (
    <div>
      <div className="mb-4">
        <ChartLegend
          items={[
            { label: "Pendapatan", color: t.revenue },
            { label: "Biaya", color: t.expense },
            { label: "Laba", color: t.profit, shape: "line" },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={chartMargin} barGap={4} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 4" />
          <XAxis
            dataKey="name"
            tick={tickInk}
            tickFormatter={(v: string) => String(v).replace(/^Lahan /, "")}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={tick}
            tickFormatter={fmtRpAxis}
            width={46}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={0} stroke={t.zero} />
          <Tooltip
            content={<ChartTip build={buildTip} />}
            cursor={{ fill: t.cursorFill }}
          />
          <Bar dataKey="revenue" name="Pendapatan" fill={t.revenue} radius={barRadius} maxBarSize={30} />
          <Bar dataKey="cost" name="Biaya" fill={t.expense} radius={barRadius} maxBarSize={30} />
          <Line
            type="monotone"
            dataKey="profit"
            name="Laba"
            stroke={t.profit}
            strokeWidth={2}
            dot={{ r: 3.5, strokeWidth: 2, stroke: t.profit, fill: t.surface }}
            activeDot={activeDotCfg}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
