import type { ReactNode } from "react";
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
import type {
  KpiItem,
  YieldRow,
  CostRow,
  PnlRow,
  FieldFinanceRow,
  HarvestDeviationRow,
  HarvestDeviationCategory,
} from "../utils/analytics";

// =====================================================
// Palet & konvensi warna (konsisten di SEMUA grafik)
//   Pendapatan  = hijau (leaf)
//   Biaya       = biru (tulus)
//   Laba        = hitam/putih (ink) — merah bila rugi
//   Margin/ROI  = ungu / kuning (garis tipis, panel terpisah)
// =====================================================
const LIGHT = {
  text: "#0c111b",
  muted: "#5b6675",
  grid: "#e8edf3",
  zero: "#94a3b8",
  surface: "#ffffff",
  tipBorder: "#e2e8f0",
  revenue: "#1aa46a",
  cost: "#214e8a",
  profit: "#0c111b",
  loss: "#ef4444",
  roi: "#8b5cf6",
  margin: "#f59e0b",
  target: "#aec6e8",
  cursor: "rgba(33,78,138,0.06)",
  cats: [
    "#214e8a",
    "#1aa46a",
    "#f59e0b",
    "#5181c0",
    "#94a3b8",
    "#7ea4d6",
    "#138a58",
  ],
  dev: {
    cepat: "#1aa46a",
    sesuai: "#94a3b8",
    telat: "#ef4444",
    berjalan: "#214e8a",
  } as Record<HarvestDeviationCategory, string>,
};

const DARK: typeof LIGHT = {
  text: "#ffffff",
  muted: "rgba(255,255,255,0.6)",
  grid: "rgba(255,255,255,0.08)",
  zero: "rgba(255,255,255,0.3)",
  surface: "#202020",
  tipBorder: "rgba(255,255,255,0.14)",
  revenue: "#72BC8F",
  cost: "#5E9FE8",
  profit: "#ffffff",
  loss: "#E97366",
  roi: "#B794F4",
  margin: "#EAC26B",
  target: "#3a5170",
  cursor: "rgba(255,255,255,0.05)",
  cats: [
    "#5E9FE8",
    "#72BC8F",
    "#EAC26B",
    "#BF8EDA",
    "#9aa4b2",
    "#4FB9C9",
    "#DE9255",
  ],
  dev: {
    cepat: "#72BC8F",
    sesuai: "#9aa4b2",
    telat: "#E97366",
    berjalan: "#5E9FE8",
  } as Record<HarvestDeviationCategory, string>,
};

function useChartTheme() {
  const { isDark } = useTheme();
  return { isDark, ...(isDark ? DARK : LIGHT) };
}
type ChartTheme = ReturnType<typeof useChartTheme>;

const DEV_LABEL: Record<HarvestDeviationCategory, string> = {
  cepat: "Lebih cepat",
  sesuai: "Tepat target",
  telat: "Telat",
  berjalan: "Berjalan",
};
const DEV_LEGEND: HarvestDeviationCategory[] = [
  "cepat",
  "sesuai",
  "berjalan",
  "telat",
];

// ---------- Konstanta statis (hindari objek baru tiap render) ----------
const barMargin = { top: 8, right: 4, bottom: 0, left: 0 };
const lineMargin = { top: 14, right: 12, bottom: 0, left: 0 };
const hMargin = { top: 4, right: 16, bottom: 0, left: 0 };
const radiusTop: [number, number, number, number] = [6, 6, 0, 0];
const radiusRight: [number, number, number, number] = [0, 6, 6, 0];
const gridDash = "3 4";
const lineDot = { r: 3.5, strokeWidth: 0 };
const lineActiveDot = { r: 5.5, strokeWidth: 0 };

const fmtNum = (v: number) => formatNumber(Number(v));
const fmtPctAxis = (v: number) => `${formatNumber(Number(v))}%`;
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
const truncate = (s: string, n = 12) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

const tick = (fill: string, size = 12) => ({ fontSize: size, fill });

// =====================================================
// Blok pembangun bersama: legend, tooltip, kartu chart
// =====================================================
export interface LegendItem {
  label: string;
  color: string;
  /** "dot" (default), "bar" (kotak), atau "line". */
  shape?: "dot" | "bar" | "line";
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted dark:text-white/60">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className={
              it.shape === "line"
                ? "h-0.5 w-3.5 rounded-full"
                : it.shape === "bar"
                  ? "h-2.5 w-2.5 rounded-[3px]"
                  : "h-2 w-2 rounded-full"
            }
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted dark:text-white/50">
      {children}
    </p>
  );
}

interface TipRow {
  label: string;
  value: string;
  color?: string;
  strong?: boolean;
}

function TipCard({
  title,
  subtitle,
  rows,
  extra,
  theme,
}: {
  title?: string;
  subtitle?: string;
  rows: TipRow[];
  extra?: ReactNode;
  theme: ChartTheme;
}) {
  return (
    <div
      className="min-w-[180px] max-w-[260px] rounded-xl border px-3 py-2.5 text-xs shadow-lg"
      style={{
        background: theme.surface,
        borderColor: theme.tipBorder,
        color: theme.text,
      }}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {subtitle ? (
        <p className="mt-0.5" style={{ color: theme.muted }}>
          {subtitle}
        </p>
      ) : null}
      <div className={`space-y-1 ${title ? "mt-2" : ""}`}>
        {rows.map((r) => (
          <p key={r.label} className="flex items-center justify-between gap-4">
            <span
              className="inline-flex items-center gap-1.5"
              style={{ color: theme.muted }}
            >
              {r.color ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: r.color }}
                />
              ) : null}
              {r.label}
            </span>
            <span className={r.strong ? "font-semibold" : "font-medium"}>
              {r.value}
            </span>
          </p>
        ))}
      </div>
      {extra}
    </div>
  );
}

/** Tooltip generik: membaca payload recharts apa adanya. */
function makeListTip(
  theme: ChartTheme,
  format: (value: number, name: string) => string,
  title?: (label: unknown) => string,
) {
  return function ListTip(props: any) {
    const { active, payload, label } = props;
    if (!active || !payload || payload.length === 0) return null;
    return (
      <TipCard
        theme={theme}
        title={title ? title(label) : String(label ?? "")}
        rows={payload.map((p: any) => ({
          label: String(p.name),
          value: format(Number(p.value), String(p.name)),
          color: p.color || p.stroke || p.fill || p.payload?.fill,
        }))}
      />
    );
  };
}

/** Kartu pembungkus chart: judul, deskripsi, legend, lalu isi. */
export function ChartCard({
  title,
  description,
  legend,
  children,
}: {
  title?: string;
  description?: ReactNode;
  legend?: LegendItem[];
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#202020] sm:p-6">
      {title || legend ? (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            {title ? (
              <h3 className="font-display text-lg font-medium text-ink dark:text-white">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-muted dark:text-white/60">
                {description}
              </p>
            ) : null}
          </div>
          {legend ? <ChartLegend items={legend} /> : null}
        </div>
      ) : null}
      {children}
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
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={d} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
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
// Tren all-time per tahun
//  Panel 1: Pendapatan vs Pengeluaran (bar) + Laba bersih (garis)
//  Panel 2: Margin & ROI (%) — dipisah agar tidak bertumpuk
// =====================================================
export function AllTimeTrendChart({
  data,
}: {
  data: Array<{
    year: number;
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
    roi: number;
  }>;
}) {
  const t = useChartTheme();
  const tickMuted = tick(t.muted);
  const rpTip = makeListTip(
    t,
    (v) => formatCurrency(v),
    (l) => `Tahun ${l}`,
  );
  const pctTip = makeListTip(
    t,
    (v) => `${formatNumber(v)}%`,
    (l) => `Tahun ${l}`,
  );

  return (
    <div>
      <div className="mb-3">
        <ChartLegend
          items={[
            { label: "Pendapatan", color: t.revenue, shape: "bar" },
            { label: "Pengeluaran", color: t.cost, shape: "bar" },
            { label: "Laba bersih", color: t.profit, shape: "line" },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={barMargin} barGap={4}>
          <CartesianGrid
            vertical={false}
            stroke={t.grid}
            strokeDasharray={gridDash}
          />
          <XAxis
            dataKey="year"
            tick={tick(t.text)}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={tickMuted}
            tickFormatter={fmtRpAxis}
            width={44}
            axisLine={false}
            tickLine={false}
            tickCount={5}
          />
          <Tooltip content={rpTip} cursor={{ fill: t.cursor }} />
          <ReferenceLine y={0} stroke={t.zero} />
          <Bar
            dataKey="revenue"
            name="Pendapatan"
            fill={t.revenue}
            radius={radiusTop}
            maxBarSize={28}
          />
          <Bar
            dataKey="expenses"
            name="Pengeluaran"
            fill={t.cost}
            radius={radiusTop}
            maxBarSize={28}
          />
          <Line
            type="monotone"
            dataKey="profit"
            name="Laba bersih"
            stroke={t.profit}
            strokeWidth={2}
            dot={lineDot}
            activeDot={lineActiveDot}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-6 border-t border-slate-100 pt-5 dark:border-white/10">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <PanelLabel>Efisiensi (%)</PanelLabel>
          <ChartLegend
            items={[
              { label: "Margin bersih", color: t.margin, shape: "line" },
              { label: "ROI", color: t.roi, shape: "line" },
            ]}
          />
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={data} margin={lineMargin}>
            <CartesianGrid
              vertical={false}
              stroke={t.grid}
              strokeDasharray={gridDash}
            />
            <XAxis
              dataKey="year"
              tick={tick(t.text)}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={tickMuted}
              tickFormatter={fmtPctAxis}
              width={44}
              axisLine={false}
              tickLine={false}
              tickCount={4}
            />
            <Tooltip
              content={pctTip}
              cursor={{ stroke: t.zero, strokeWidth: 1 }}
            />
            <ReferenceLine y={0} stroke={t.zero} />
            <Line
              type="monotone"
              dataKey="margin"
              name="Margin bersih"
              stroke={t.margin}
              strokeWidth={2}
              dot={lineDot}
              activeDot={lineActiveDot}
            />
            <Line
              type="monotone"
              dataKey="roi"
              name="ROI"
              stroke={t.roi}
              strokeWidth={2}
              dot={lineDot}
              activeDot={lineActiveDot}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// =====================================================
// Riwayat keuangan SATU lahan (dipakai di modal detail)
//  Panel 1: Pendapatan vs Biaya per musim (bar)
//  Panel 2: ROI per musim (satu garis) — perbandingan ke musim
//           sebelumnya ada di tooltip, bukan garis putus-putus.
// =====================================================
function FieldFinanceTooltip(props: any) {
  const { active, payload, theme } = props as {
    active?: boolean;
    payload?: Array<{ payload?: FieldFinanceRow }>;
    theme: ChartTheme;
  };
  const row = payload && payload.length ? payload[0]?.payload : undefined;
  if (!active || !row) return null;
  const tone = (v: number) =>
    v < 0 ? theme.loss : v > 0 ? theme.revenue : theme.muted;
  return (
    <TipCard
      theme={theme}
      title={row.label}
      subtitle={`${row.crop} · ${row.year}`}
      rows={[
        {
          label: "Pendapatan",
          value: formatCurrency(row.revenue),
          color: theme.revenue,
        },
        {
          label: "Biaya",
          value: formatCurrency(row.expenses),
          color: theme.cost,
        },
        {
          label: row.profit < 0 ? "Rugi" : "Laba",
          value: formatCurrency(row.profit),
          strong: true,
        },
        { label: "Margin", value: `${formatNumber(row.margin)}%` },
        { label: "ROI", value: `${formatNumber(row.roi)}%`, color: theme.roi },
      ]}
      extra={
        <p
          className="mt-2 border-t pt-2"
          style={{
            borderColor: theme.tipBorder,
            color: row.roiDelta !== null ? tone(row.roiDelta) : theme.muted,
          }}
        >
          {row.roiDelta !== null
            ? `${row.roiDelta >= 0 ? "▲" : "▼"} ${formatNumber(Math.abs(row.roiDelta))} poin ROI vs musim sebelumnya`
            : "Musim pertama lahan ini."}
        </p>
      }
    />
  );
}

export function FieldFinanceChart({ data }: { data: FieldFinanceRow[] }) {
  const t = useChartTheme();
  const tipEl = <FieldFinanceTooltip theme={t} />;
  const showRoi = data.length > 1;
  return (
    <div>
      <div className="mb-3">
        <ChartLegend
          items={[
            { label: "Pendapatan", color: t.revenue, shape: "bar" },
            { label: "Biaya", color: t.cost, shape: "bar" },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={barMargin} barGap={4}>
          <CartesianGrid
            vertical={false}
            stroke={t.grid}
            strokeDasharray={gridDash}
          />
          <XAxis
            dataKey="year"
            tick={tick(t.text)}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={tick(t.muted)}
            tickFormatter={fmtRpAxis}
            width={44}
            axisLine={false}
            tickLine={false}
            tickCount={4}
          />
          <Tooltip content={tipEl} cursor={{ fill: t.cursor }} />
          <ReferenceLine y={0} stroke={t.zero} />
          <Bar
            dataKey="revenue"
            name="Pendapatan"
            fill={t.revenue}
            radius={radiusTop}
            maxBarSize={26}
          />
          <Bar
            dataKey="expenses"
            name="Biaya"
            fill={t.cost}
            radius={radiusTop}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>

      {showRoi ? (
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/10">
          <div className="mb-1 flex items-center justify-between gap-2">
            <PanelLabel>ROI per musim</PanelLabel>
            <ChartLegend
              items={[{ label: "ROI (%)", color: t.roi, shape: "line" }]}
            />
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={data} margin={lineMargin}>
              <CartesianGrid
                vertical={false}
                stroke={t.grid}
                strokeDasharray={gridDash}
              />
              <XAxis
                dataKey="year"
                tick={tick(t.text)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={tick(t.muted, 11)}
                tickFormatter={fmtPctAxis}
                width={44}
                axisLine={false}
                tickLine={false}
                tickCount={3}
              />
              <Tooltip
                content={tipEl}
                cursor={{ stroke: t.zero, strokeWidth: 1 }}
              />
              <ReferenceLine y={0} stroke={t.zero} />
              <Line
                type="monotone"
                dataKey="roi"
                name="ROI"
                stroke={t.roi}
                strokeWidth={2}
                dot={lineDot}
                activeDot={lineActiveDot}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
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

export function KpiCards({ items }: { items: KpiItem[] }) {
  const t = useChartTheme();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => {
        const delta =
          it.benchmark !== 0
            ? Math.round(
                ((it.current - it.benchmark) / Math.abs(it.benchmark)) * 100,
              )
            : 0;
        const up = delta >= 0;
        const negative = it.current < 0;
        return (
          <div
            key={it.key}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#202020]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-ink-muted dark:text-white/60">
                {it.label}
              </p>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  up
                    ? "bg-leaf-50 text-leaf-700 dark:bg-[#72BC8F]/15 dark:text-[#8fdcae]"
                    : "bg-red-50 text-red-600 dark:bg-[#E97366]/15 dark:text-[#f0a59c]"
                }`}
              >
                {up ? "▲" : "▼"} {Math.abs(delta)}%
              </span>
            </div>
            <p
              className={`mt-2 break-words font-display text-3xl font-medium leading-none ${
                negative
                  ? "text-red-600 dark:text-[#E97366]"
                  : "text-ink dark:text-white"
              }`}
            >
              {formatKpi(it)}
            </p>
            <p className="mt-1.5 text-xs text-ink-muted dark:text-white/50">
              vs {it.benchmarkLabel}
            </p>
            <div className="mt-3 h-9 opacity-80">
              <Sparkline
                data={it.series}
                color={negative ? t.loss : up ? t.revenue : t.cost}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Hasil panen per lahan (kg/m²) ----------
export function YieldBulletChart({ data }: { data: YieldRow[] }) {
  const t = useChartTheme();
  const tip = makeListTip(t, (v) => `${formatNumber(v)} kg/m²`);
  return (
    <div>
      <div className="mb-3">
        <ChartLegend
          items={[
            { label: "Target", color: t.target, shape: "bar" },
            { label: "Aktual", color: t.revenue, shape: "bar" },
          ]}
        />
      </div>
      <ResponsiveContainer
        width="100%"
        height={Math.max(200, data.length * 56)}
      >
        <BarChart data={data} layout="vertical" margin={hMargin} barGap={3}>
          <CartesianGrid
            horizontal={false}
            stroke={t.grid}
            strokeDasharray={gridDash}
          />
          <XAxis
            type="number"
            tick={tick(t.muted)}
            tickFormatter={fmtNum}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            width={96}
            tick={tick(t.text)}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={tip} cursor={{ fill: t.cursor }} />
          <Bar
            dataKey="target"
            name="Target"
            fill={t.target}
            radius={radiusRight}
            barSize={10}
          />
          <Bar
            dataKey="actual"
            name="Aktual"
            fill={t.revenue}
            radius={radiusRight}
            barSize={10}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// =====================================================
// Komposisi biaya: donut + daftar dengan bar proporsi
// =====================================================
export function CostDonutChart({
  data,
  year,
}: {
  data: CostRow[];
  year: number;
}) {
  const t = useChartTheme();
  const total = data.reduce((s, r) => s + r.year, 0);
  const tip = makeListTip(
    t,
    (v) => formatCompactCurrency(v),
    () => "",
  );
  return (
    <div className="grid items-center gap-8 md:grid-cols-[260px_1fr]">
      <div className="relative mx-auto h-[240px] w-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={tip} />
            <Pie
              data={data}
              dataKey="year"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={76}
              outerRadius={108}
              paddingAngle={2}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((row, i) => (
                <Cell key={row.category} fill={t.cats[i % t.cats.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] uppercase tracking-wider text-ink-muted dark:text-white/50">
            Total {year}
          </span>
          <span className="mt-0.5 font-display text-xl font-medium text-ink dark:text-white">
            {formatCompactCurrency(total)}
          </span>
        </div>
      </div>

      <ul className="space-y-3.5">
        {data.map((row, i) => {
          const color = t.cats[i % t.cats.length];
          return (
            <li key={row.category}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-2 capitalize text-ink dark:text-white">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {row.category}
                </span>
                <span className="text-ink-muted dark:text-white/60">
                  <span className="font-medium text-ink dark:text-white">
                    {formatCompactCurrency(row.year)}
                  </span>{" "}
                  · {row.yearPct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, row.yearPct))}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// =====================================================
// P&L per lahan: bar pendapatan vs biaya; margin jadi chip
// =====================================================
export function PnLChart({
  rows,
  allTimeMargin,
}: {
  rows: PnlRow[];
  allTimeMargin: number;
}) {
  const t = useChartTheme();
  const tip = (props: any) => {
    const { active, payload } = props;
    const row: PnlRow | undefined = payload?.[0]?.payload;
    if (!active || !row) return null;
    return (
      <TipCard
        theme={t}
        title={row.field}
        rows={[
          {
            label: "Pendapatan",
            value: formatCurrency(row.revenue),
            color: t.revenue,
          },
          { label: "Biaya", value: formatCurrency(row.cost), color: t.cost },
          {
            label: row.profit < 0 ? "Rugi" : "Laba",
            value: formatCurrency(row.profit),
            strong: true,
          },
          { label: "Margin", value: `${formatNumber(row.margin)}%` },
        ]}
      />
    );
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <ChartLegend
          items={[
            { label: "Pendapatan", color: t.revenue, shape: "bar" },
            { label: "Biaya", color: t.cost, shape: "bar" },
          ]}
        />
        <span className="text-xs text-ink-muted dark:text-white/50">
          Margin all-time{" "}
          <b className="font-semibold text-ink dark:text-white">
            {formatNumber(allTimeMargin)}%
          </b>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} margin={barMargin} barGap={4}>
          <CartesianGrid
            vertical={false}
            stroke={t.grid}
            strokeDasharray={gridDash}
          />
          <XAxis
            dataKey="field"
            tick={tick(t.text, 12)}
            tickFormatter={(v: string) => truncate(String(v), 14)}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis
            tick={tick(t.muted)}
            tickFormatter={fmtRpAxis}
            width={44}
            axisLine={false}
            tickLine={false}
            tickCount={5}
          />
          <Tooltip content={tip} cursor={{ fill: t.cursor }} />
          <ReferenceLine y={0} stroke={t.zero} />
          <Bar
            dataKey="revenue"
            name="Pendapatan"
            fill={t.revenue}
            radius={radiusTop}
            maxBarSize={28}
          />
          <Bar
            dataKey="cost"
            name="Biaya"
            fill={t.cost}
            radius={radiusTop}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>

      <ul className="mt-5 grid gap-2 border-t border-slate-100 pt-4 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li
            key={r.field}
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm dark:bg-white/5"
          >
            <span className="min-w-0 truncate text-ink-muted dark:text-white/60">
              {r.field}
            </span>
            <span
              className={`shrink-0 font-semibold ${
                r.margin < 0
                  ? "text-red-600 dark:text-[#E97366]"
                  : "text-ink dark:text-white"
              }`}
            >
              {formatNumber(r.margin)}%
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-muted dark:text-white/40">
        Angka di atas adalah margin bersih tiap lahan pada musim terpilih.
      </p>
    </div>
  );
}

// =====================================================
// Durasi tanam–panen: deviasi hari (diverging bar)
// =====================================================
export function HarvestDeviationChart({
  data,
}: {
  data: HarvestDeviationRow[];
}) {
  const t = useChartTheme();
  const tip = (props: any) => {
    const { active, payload } = props;
    const row: HarvestDeviationRow | undefined = payload?.[0]?.payload;
    if (!active || !row) return null;
    return (
      <TipCard
        theme={t}
        title={row.field}
        subtitle={DEV_LABEL[row.category]}
        rows={[]}
        extra={
          <p className="mt-1.5 leading-relaxed" style={{ color: t.muted }}>
            {row.detail}
          </p>
        }
      />
    );
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-ink-muted dark:text-white/50">
        <span>← Panen lebih cepat</span>
        <span>Telat / overdue →</span>
      </div>
      <ResponsiveContainer
        width="100%"
        height={Math.max(200, data.length * 56)}
      >
        <BarChart data={data} layout="vertical" margin={hMargin}>
          <CartesianGrid
            horizontal={false}
            stroke={t.grid}
            strokeDasharray={gridDash}
          />
          <XAxis
            type="number"
            tick={tick(t.muted)}
            tickFormatter={(v: number) => `${v} hr`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            width={96}
            tick={tick(t.text)}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={tip} cursor={{ fill: t.cursor }} />
          <ReferenceLine x={0} stroke={t.zero} />
          <Bar
            dataKey="deviationDays"
            name="Deviasi (hari)"
            radius={4}
            barSize={16}
          >
            {data.map((row) => (
              <Cell key={row.field} fill={t.dev[row.category]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4">
        <ChartLegend
          items={DEV_LEGEND.map((c) => ({
            label: DEV_LABEL[c],
            color: t.dev[c],
          }))}
        />
      </div>
    </div>
  );
}
