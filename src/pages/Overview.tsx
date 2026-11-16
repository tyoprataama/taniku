import { useMemo, useState } from "react";
import {
  FiGrid,
  FiMaximize,
  FiActivity,
  FiAlertTriangle,
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiPercent,
  FiTarget,
} from "react-icons/fi";
import { PageTransition } from "../components/ui/PageTransition";
import { PageHeader } from "../components/ui/PageHeader";
import { StatisticCard } from "../components/cards/StatisticCard";
import { ActivityCard } from "../components/cards/ActivityCard";
import { Card, CardHeader } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { PeriodFilter } from "../components/ui/PeriodFilter";
import type { Period } from "../components/ui/PeriodFilter";
import {
  tableWrap,
  theadClass,
  thClass,
  tdClass,
  trClass,
  signTone,
} from "../components/ui/styles";
import { StatusChip } from "../client/components/DetailPrimitives";
import {
  fields,
  activities,
  getRevenuesByField,
  getExpensesByField,
  getLatestSeason,
  getSeasonByFieldYear,
  fieldsByYear,
  seasonsByYear,
  totalRevenueBySeason,
  totalExpensesBySeason,
  getAvailableYears,
  getLatestYear,
  useDataVersion,
} from "../data";
import { formatNumber, formatCompactCurrency } from "../utils/format";
import { harvestInfo } from "../utils/harvest";
import { periodIsRunning } from "../client/utils/analytics";

export default function Overview() {
  // Reaktif terhadap store agar ringkasan selalu mengikuti input terbaru.
  const version = useDataVersion();
  const years = getAvailableYears();
  const [period, setPeriod] = useState<Period>(() => getLatestYear());
  const isAll = period === "all";
  const running = periodIsRunning(period);

  const rows = useMemo(() => {
    // Total lahan & luas ikut periode: satu musim => hanya lahan yang punya
    // musim di tahun itu; all-time => seluruh lahan.
    const list = isAll ? fields : fieldsByYear(period as number);
    return list.map((f) => {
      const season = isAll
        ? getLatestSeason(f.id)
        : getSeasonByFieldYear(f.id, period as number);
      let revenue: number;
      let expense: number;
      if (isAll) {
        revenue = getRevenuesByField(f.id).reduce((s, r) => s + r.amount, 0);
        expense = getExpensesByField(f.id).reduce((s, e) => s + e.amount, 0);
      } else {
        revenue = season ? totalRevenueBySeason(season.id) : 0;
        expense = season ? totalExpensesBySeason(season.id) : 0;
      }
      const info = season
        ? harvestInfo({
            status: season.status,
            harvestDate: season.harvestDate,
          })
        : null;
      return {
        field: f,
        season,
        info,
        revenue,
        expense,
        profit: revenue - expense,
      };
    });
  }, [period, isAll, version]);

  const totalAreaM2 = rows.reduce((s, r) => s + r.field.areaM2, 0);
  const activeCount = rows.filter((r) => r.season?.status === "active").length;
  const overdueCount = rows.filter((r) => r.info?.state === "overdue").length;

  const totals = rows.reduce(
    (acc, r) => {
      acc.revenue += r.revenue;
      acc.expense += r.expense;
      acc.profit += r.profit;
      return acc;
    },
    { revenue: 0, expense: 0, profit: 0 },
  );

  // Margin = laba/pendapatan; Yield/ROI = laba/biaya (nama kontekstual:
  // "Yield" untuk satu musim, "ROI" untuk seluruh waktu).
  const marginPct =
    totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const returnPct =
    totals.expense > 0 ? (totals.profit / totals.expense) * 100 : 0;
  const pct1 = (n: number) => formatNumber(Math.round(n * 10) / 10);

  const recent = useMemo(() => {
    let list = activities;
    if (!isAll) {
      const ids = new Set(seasonsByYear(period as number).map((s) => s.id));
      list = activities.filter((a) => ids.has(a.seasonId));
    }
    return [...list]
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 5);
  }, [period, isAll, version]);

  const periodLabel = isAll ? "seluruh waktu" : `musim ${period}`;

  return (
    <PageTransition>
      <PageHeader
        title="Overview"
        description={`Inti dari seluruh data yang diinput: ringkasan operasional, finansial, dan status panen tiap lahan · ${periodLabel}.`}
        actions={
          <PeriodFilter value={period} onChange={setPeriod} years={years} />
        }
      />

      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted/80">
        Operasional
      </p>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatisticCard
          label="Total Lahan"
          value={`${rows.length}`}
          icon={FiGrid}
        />
        <StatisticCard
          label="Total Luas"
          value={`${formatNumber(totalAreaM2)} m²`}
          icon={FiMaximize}
          tone="blue"
        />
        <StatisticCard
          label={isAll ? "Lahan Aktif (kini)" : "Lahan Aktif"}
          value={`${activeCount}`}
          icon={FiActivity}
          tone="amber"
        />
        <StatisticCard
          label="Panen Overdue"
          value={`${overdueCount}`}
          icon={FiAlertTriangle}
          tone={overdueCount > 0 ? "red" : "green"}
          negative={overdueCount > 0}
        />
      </div>

      <p className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted/80">
        Keuangan
      </p>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatisticCard
          label="Total Pendapatan"
          value={formatCompactCurrency(totals.revenue)}
          icon={FiTrendingUp}
          tone="green"
        />
        <StatisticCard
          label="Total Biaya"
          value={formatCompactCurrency(totals.expense)}
          icon={FiTrendingDown}
          tone="blue"
        />
        <StatisticCard
          label="Laba Bersih"
          value={formatCompactCurrency(totals.profit)}
          icon={FiDollarSign}
          tone={totals.profit < 0 && !running ? "red" : "green"}
          negative={totals.profit < 0}
          provisional={running}
        />
        <StatisticCard
          label="Margin"
          value={`${pct1(marginPct)}%`}
          icon={FiPercent}
          tone="amber"
          hint="Laba ÷ pendapatan"
          negative={marginPct < 0}
          provisional={running}
        />
        <StatisticCard
          label={isAll ? "ROI" : "Yield"}
          value={`${pct1(returnPct)}%`}
          icon={FiTarget}
          tone="violet"
          hint="Laba ÷ modal"
          negative={returnPct < 0}
          provisional={running}
        />
      </div>

      <Card className="mt-8 p-6">
        <CardHeader
          title="Ringkasan per lahan"
          description="Status panen, luas, dan hasil keuangan tiap lahan pada periode terpilih."
        />
        <div className={tableWrap}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className={theadClass}>
              <tr>
                <th className={`${thClass} pl-0`}>Lahan</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Panen</th>
                <th className={`${thClass} text-right`}>Luas (m²)</th>
                <th className={`${thClass} text-right`}>Pendapatan</th>
                <th className={`${thClass} text-right`}>Biaya</th>
                <th className={`${thClass} pr-0 text-right`}>Laba</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ field, season, info, revenue, expense, profit }) => (
                <tr key={field.id} className={trClass}>
                  <td
                    className={`${tdClass} whitespace-nowrap pl-0 font-medium text-ink dark:text-white`}
                  >
                    {field.name}
                  </td>
                  <td className={tdClass}>
                    <StatusChip status={season?.status ?? "fallow"} />
                  </td>
                  <td className={`${tdClass} max-w-[220px]`}>
                    {info && info.state === "overdue" ? (
                      <span className="text-xs font-medium text-red-600 dark:text-[#E97366]">
                        Overdue · {info.detail}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-muted dark:text-white/55">
                        {info ? info.label : "—"}
                      </span>
                    )}
                  </td>
                  <td
                    className={`${tdClass} text-right tabular-nums text-ink-muted`}
                  >
                    {formatNumber(field.areaM2)}
                  </td>
                  <td
                    className={`${tdClass} whitespace-nowrap text-right tabular-nums text-ink-muted`}
                  >
                    {formatCompactCurrency(revenue)}
                  </td>
                  <td
                    className={`${tdClass} whitespace-nowrap text-right tabular-nums text-ink-muted`}
                  >
                    {formatCompactCurrency(expense)}
                  </td>
                  <td
                    className={`${tdClass} whitespace-nowrap pr-0 text-right font-medium tabular-nums ${signTone(profit)}`}
                  >
                    {formatCompactCurrency(profit)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold text-ink dark:border-white/15 dark:text-white">
                <td className={`${tdClass} pl-0`} colSpan={3}>
                  Total semua lahan
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {formatNumber(totalAreaM2)}
                </td>
                <td
                  className={`${tdClass} whitespace-nowrap text-right tabular-nums`}
                >
                  {formatCompactCurrency(totals.revenue)}
                </td>
                <td
                  className={`${tdClass} whitespace-nowrap text-right tabular-nums`}
                >
                  {formatCompactCurrency(totals.expense)}
                </td>
                <td
                  className={`${tdClass} whitespace-nowrap pr-0 text-right tabular-nums ${signTone(totals.profit)}`}
                >
                  {formatCompactCurrency(totals.profit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <h2 className="mb-4 mt-10 font-display text-xl font-medium text-ink">
        Aktivitas terbaru
      </h2>
      {recent.length ? (
        <div className="space-y-3">
          {recent.map((a) => (
            <ActivityCard key={a.id} activity={a} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Belum ada aktivitas"
          description="Aktivitas yang dicatat pada periode ini akan muncul di sini."
        />
      )}
    </PageTransition>
  );
}
