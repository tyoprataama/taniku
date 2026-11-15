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
  const cost = costComposition(year);
  const pnl = pnlByField(year);
  const deviation = harvestDeviationByField(year);
  const allTime = allTimeSummary();
  const allTimeTrendData = allTimeTrend();
  const firstYear = allTimeTrendData[0]?.year;
  const lastYear = allTimeTrendData[allTimeTrendData.length - 1]?.year;

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
    },
    {
      label: "Margin bersih",
      value: `${allTime.margin}%`,
      negative: allTime.margin < 0,
    },
    {
      label: "ROI all-time",
      value: `${allTime.roiPct}%`,
      negative: allTime.roiPct < 0,
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
          <div className="mt-10">
            <Reveal>
              <KpiCards items={kpis} />
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
              <Reveal>
                <ChartCard
                  className="h-full"
                  title="Pendapatan, biaya, dan margin per lahan"
                  subtitle="Batang membandingkan pendapatan dan biaya tiap lahan; margin ada di tabel di bawah grafik."
                >
                  <PnLChart rows={pnl.rows} allTimeMargin={pnl.allTimeMargin} />
                </ChartCard>
              </Reveal>
              <Reveal delay={0.07}>
                <ChartCard
                  className="h-full"
                  title={`Durasi tanam–panen per lahan (${year})`}
                  subtitle="Tanggal panen aktual dibandingkan target: bar ke kiri berarti lebih cepat, ke kanan berarti telat/overdue."
                >
                  <HarvestDeviationChart data={deviation} />
                </ChartCard>
              </Reveal>
            </div>
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
                  <p className="text-sm text-ink-muted dark:text-white/60">
                    {s.label}
                  </p>
                  <p
                    className={`mt-2 font-display text-2xl font-medium leading-none tabular-nums ${
                      s.negative
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
