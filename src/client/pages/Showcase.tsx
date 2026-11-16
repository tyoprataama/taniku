import { useState } from "react";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { SectionTitle } from "../components/SectionTitle";
import { FieldShowcaseCard } from "../components/FieldShowcaseCard";
import { FieldDetailModal } from "../components/FieldDetailModal";
import { ChartCard } from "../components/ChartCard";
import {
  KpiCards,
  CostDonutChart,
  PnLChart,
  HarvestDeviationChart,
  AllTimeTrendChart,
  MonthlyCashflowChart,
  CostByYearChart,
  YearlySummaryTable,
  PaybackChart,
} from "../components/Charts";
import { useSeason } from "../../context/SeasonContext";
import { useDataVersion, fieldsByYear, getSeasonByFieldYear } from "../../data";
import {
  kpiSummary,
  costComposition,
  pnlByField,
  harvestDeviationByField,
  allTimeSummary,
  allTimeTrend,
  efficiencyKpis,
  periodIsRunning,
  yearlySummary,
  costByYear,
  monthlyCashflow,
} from "../utils/analytics";
import { formatCompactCurrency } from "../../utils/format";
import type { Field, Season } from "../../types";

export default function Showcase() {
  useDataVersion();
  const { year } = useSeason();
  const [selected, setSelected] = useState<{
    field: Field;
    season: Season;
  } | null>(null);

  const pairs = fieldsByYear(year)
    .map((field) => ({ field, season: getSeasonByFieldYear(field.id, year) }))
    .filter(
      (x): x is { field: Field; season: Season } => x.season !== undefined,
    );

  const kpis = kpiSummary(year);
  const effKpis = efficiencyKpis(year);
  const yearly = yearlySummary();
  const costYears = costByYear();
  const cashflow = monthlyCashflow(year);
  const running = periodIsRunning(year);
  const runningCount = pairs.filter(
    (p) => p.season.status !== "harvested",
  ).length;
  const cost = costComposition(year);
  const pnl = pnlByField(year);
  const deviation = harvestDeviationByField(year);
  const allTime = allTimeSummary();
  const allTimeTrendData = allTimeTrend();
  const firstYear = allTimeTrendData[0]?.year;
  const lastYear = allTimeTrendData[allTimeTrendData.length - 1]?.year;

  const allTimeRunning = periodIsRunning("all");
  const allTimeStats = [
    {
      label: "Total pendapatan",
      value: formatCompactCurrency(allTime.revenue),
    },
    { label: "Total modal", value: formatCompactCurrency(allTime.expenses) },
    {
      label: "Laba bersih",
      value: formatCompactCurrency(allTime.profit),
      negative: allTime.profit < 0,
      provisional: allTimeRunning,
    },
    {
      label: "Margin bersih",
      value: `${allTime.margin}%`,
      negative: allTime.margin < 0,
      provisional: allTimeRunning,
    },
    {
      label: "ROI all-time",
      value: `${allTime.roiPct}%`,
      negative: allTime.roiPct < 0,
      provisional: allTimeRunning,
    },
  ];

  return (
    <>
      {/* Header + KPI hero */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-tulus-50/70 to-white dark:border-white/10 dark:from-[#202020] dark:to-[#191919]">
        <Container className="py-16 lg:py-20">
          <Reveal>
            <SectionTitle
              eyebrow="Showcase Data"
              title="Dashboard kinerja lapangan"
              description="Beberapa indikator utama mengikuti musim yang dipilih dan dibandingkan dengan tahun sebelumnya. Data yang ditampilkan dapat menjadi insight untuk pengambilan keputusan kedepannya."
            />
          </Reveal>
          {running ? (
            <Reveal>
              <div className="mt-8 flex items-start gap-3 rounded-2xl bg-tulus-50 px-5 py-4 text-sm leading-relaxed text-tulus-800 dark:bg-[#5E9FE8]/15 dark:text-[#bcd7f6]">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-tulus-600 dark:bg-[#5E9FE8]" />
                <p>
                  <span className="font-semibold">
                    Musim {year} masih berjalan
                  </span>{" "}
                  ({runningCount} dari {pairs.length} lahan belum panen).
                  Pendapatan baru tercatat setelah panen dan penjualan selesai,
                  jadi angka laba atau margin yang minus saat ini bersifat
                  sementara dan belum berarti rugi.
                </p>
              </div>
            </Reveal>
          ) : null}
          <div className="mt-10">
            <Reveal>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted dark:text-white/45">
                Kinerja utama
              </p>
              <KpiCards items={kpis} />
            </Reveal>
          </div>
          <div className="mt-10">
            <Reveal>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted dark:text-white/45">
                  Efisiensi &amp; kelayakan usaha
                </p>
                <p className="text-xs text-ink-muted dark:text-white/45">
                  Dihitung dari pemasukan dan pengeluaran musim {year}
                </p>
              </div>
              <KpiCards items={effKpis} />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Portofolio lahan */}
      <section className="bg-white py-20 dark:bg-[#191919]">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Portofolio lahan"
              title={`Lahan aktif musim ${year}`}
              description="Klik kartu lahan untuk membuka detail lengkap dalam tampilan modal."
            />
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pairs.map((p, i) => (
              <Reveal key={p.field.id} delay={(i % 3) * 0.07}>
                <FieldShowcaseCard
                  field={p.field}
                  season={p.season}
                  onSelect={() => setSelected(p)}
                />
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Analisis musim terpilih: biaya, profitabilitas, durasi panen */}
      <section className="border-t border-slate-200 bg-slate-50/60 py-20 dark:border-white/10 dark:bg-[#1c1c1c]">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Analisis musim"
              title={`Biaya, profitabilitas, dan jadwal panen ${year}`}
              description="Tiga sudut pandang untuk musim terpilih: ke mana biaya mengalir, seberapa untung tiap lahan, dan seberapa tepat waktu panennya."
            />
          </Reveal>

          <div className="mt-12 space-y-6">
            <Reveal>
              <ChartCard
                title="Komposisi biaya"
                subtitle={`Pengeluaran per kategori pada musim ${year}, dihitung langsung dari rincian biaya nyata tiap lahan.`}
              >
                <CostDonutChart
                  data={cost.data}
                  year={year}
                  total={cost.yearTotal}
                />
              </ChartCard>
            </Reveal>

            <div className="grid gap-6 lg:grid-cols-2">
              <Reveal className="min-w-0">
                <ChartCard
                  className="h-full"
                  title="Pendapatan, biaya, dan margin per lahan"
                  subtitle="Batang membandingkan pendapatan dan biaya tiap lahan; margin ada di tabel di bawah grafik."
                >
                  <PnLChart rows={pnl.rows} allTimeMargin={pnl.allTimeMargin} />
                </ChartCard>
              </Reveal>
              <Reveal delay={0.07} className="min-w-0">
                <ChartCard
                  className="h-full"
                  title={`Durasi tanam–panen per lahan (${year})`}
                  subtitle="Tanggal panen aktual dibandingkan target: bar ke kiri berarti lebih cepat, ke kanan berarti telat/overdue."
                >
                  <HarvestDeviationChart data={deviation} />
                </ChartCard>
              </Reveal>
            </div>

            {cashflow.length ? (
              <Reveal>
                <ChartCard
                  title="Arus kas bulanan"
                  subtitle={`Uang masuk dan uang keluar tiap bulan pada musim ${year}. Garis menunjukkan laba kumulatif: saat melewati angka nol, modal sudah kembali.`}
                >
                  <MonthlyCashflowChart data={cashflow} />
                </ChartCard>
              </Reveal>
            ) : null}
          </div>
        </Container>
      </section>

      {/* All-time (ditempatkan di akhir) */}
      <section className="border-t border-slate-200 bg-white py-20 dark:border-white/10 dark:bg-[#191919]">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="All-time"
              title="Pendapatan, biaya, margin, dan ROI all-time"
              description="Akumulasi seluruh musim yang tercatat mulai tahun 2023, termasuk musim yang masih berjalan/belum panen — biaya investasinya sudah masuk meski pendapatannya belum. ROI = laba bersih dibagi total modal, lebih tepat untuk mengukur akumulasi lintas tahun (yield lebih cocok untuk satu musim/tahun)."
            />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-5">
              {allTimeStats.map((s, i) => (
                <div
                  key={s.label}
                  className={`rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#202020] ${
                    i === allTimeStats.length - 1
                      ? "col-span-2 lg:col-span-1"
                      : ""
                  }`}
                >
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted dark:text-white/60">
                    {s.label}
                    {s.provisional ? (
                      <span className="rounded-full bg-tulus-50 px-2 py-0.5 text-[10px] font-medium text-tulus-700 dark:bg-[#5E9FE8]/15 dark:text-[#8fbdf0]">
                        Sementara
                      </span>
                    ) : null}
                  </p>
                  <p
                    className={`mt-2 font-display text-2xl font-medium leading-none tabular-nums ${
                      s.negative && !s.provisional
                        ? "text-red-600 dark:text-[#E97366]"
                        : "text-ink dark:text-white"
                    }`}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <ChartCard
              className="mt-4"
              title="Tren per tahun"
              subtitle={`Pendapatan, pengeluaran, dan laba bersih (Rupiah) atau margin dan ROI (%) sepanjang ${firstYear ?? ""}–${lastYear ?? ""}. Gunakan toggle untuk berpindah tampilan.`}
            >
              <AllTimeTrendChart data={allTimeTrendData} />
            </ChartCard>
          </Reveal>

          <Reveal delay={0.1}>
            <ChartCard
              className="mt-4"
              title="Rekap pemasukan dan pengeluaran per tahun"
              subtitle="Satu tabel untuk membaca semua tahun sekaligus. R/C = pendapatan ÷ biaya; Δ = perubahan dibanding tahun sebelumnya (hijau bila menguntungkan)."
            >
              <YearlySummaryTable rows={yearly} />
            </ChartCard>
          </Reveal>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Reveal>
              <ChartCard
                className="h-full"
                title="Biaya per kategori tiap tahun"
                subtitle="Melihat kategori biaya mana yang membesar atau mengecil dari tahun ke tahun."
              >
                <CostByYearChart keys={costYears.keys} data={costYears.data} />
              </ChartCard>
            </Reveal>
            <Reveal delay={0.07}>
              <ChartCard
                className="h-full"
                title="Perjalanan balik modal"
                subtitle="Total pendapatan vs total biaya sejak awal. Saat garis hijau menyalip garis biru, modal sudah kembali."
              >
                <PaybackChart data={yearly} />
              </ChartCard>
            </Reveal>
          </div>
        </Container>
      </section>

      <FieldDetailModal
        open={selected !== null}
        field={selected?.field ?? null}
        season={selected?.season ?? null}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
