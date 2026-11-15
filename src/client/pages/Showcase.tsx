import { useState } from "react";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { SectionTitle } from "../components/SectionTitle";
import { FieldShowcaseCard } from "../components/FieldShowcaseCard";
import { FieldDetailModal } from "../components/FieldDetailModal";
import {
  KpiCards,
  ChartCard,
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
import { formatCompactCurrency, formatCurrency } from "../../utils/format";
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

  const allTimeStats = [
    {
      label: "Total pendapatan",
      value: formatCompactCurrency(allTime.revenue),
      full: formatCurrency(allTime.revenue),
      negative: false,
    },
    {
      label: "Total modal",
      value: formatCompactCurrency(allTime.expenses),
      full: formatCurrency(allTime.expenses),
      negative: false,
    },
    {
      label: "Laba bersih",
      value: formatCompactCurrency(allTime.profit),
      full: formatCurrency(allTime.profit),
      negative: allTime.profit < 0,
    },
    {
      label: "Margin bersih",
      value: `${allTime.margin}%`,
      full: `${allTime.margin}%`,
      negative: allTime.margin < 0,
    },
    {
      label: "ROI",
      value: `${allTime.roiPct}%`,
      full: `${allTime.roiPct}%`,
      negative: allTime.roiPct < 0,
    },
  ];

  return (
    <>
      {/* ---------- Header + KPI ---------- */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-tulus-50/70 to-white dark:border-white/10 dark:from-[#202020] dark:to-[#191919]">
        <Container className="py-14 lg:py-20">
          <Reveal>
            <SectionTitle
              eyebrow="Showcase Data"
              title="Dashboard kinerja lapangan"
              description="Indikator utama musim terpilih, dibandingkan dengan tahun sebelumnya sebagai bahan keputusan ke depan."
            />
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-10">
              <KpiCards items={kpis} />
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ---------- Portofolio lahan ---------- */}
      <section className="bg-white py-16 dark:bg-[#191919] lg:py-20">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Portofolio lahan"
              title={`Lahan musim ${year}`}
              description="Pilih salah satu lahan untuk melihat ringkasan, keuangan, aktivitas, dan dokumentasinya."
            />
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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

      {/* ---------- Keuangan musim terpilih ---------- */}
      <section className="border-t border-slate-200 bg-slate-50/60 py-16 dark:border-white/10 dark:bg-[#1c1c1c] lg:py-20">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Keuangan"
              title={`Pendapatan & biaya musim ${year}`}
              description="Perbandingan pendapatan dan biaya tiap lahan, serta ke mana biaya mengalir menurut kategori."
            />
          </Reveal>
          <div className="mt-10 grid gap-5">
            <Reveal>
              <ChartCard
                title="Pendapatan vs biaya per lahan"
                description="Arahkan kursor ke batang untuk melihat laba dan margin."
              >
                <PnLChart rows={pnl.rows} allTimeMargin={pnl.allTimeMargin} />
              </ChartCard>
            </Reveal>
            <Reveal>
              <ChartCard
                title="Komposisi biaya"
                description={`Total pengeluaran musim ${year}: ${formatCompactCurrency(cost.yearTotal)}.`}
              >
                <CostDonutChart data={cost.data} year={year} />
              </ChartCard>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ---------- Durasi tanam–panen ---------- */}
      <section className="bg-white py-16 dark:bg-[#191919] lg:py-20">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Durasi tanam–panen"
              title={`Ketepatan panen ${year}`}
              description="Selisih hari antara tanggal panen aktual dan target. Ke kiri berarti lebih cepat, ke kanan berarti telat."
            />
          </Reveal>
          <Reveal>
            <div className="mt-10">
              <ChartCard>
                <HarvestDeviationChart data={deviation} />
              </ChartCard>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ---------- All-time ---------- */}
      <section className="border-t border-slate-200 bg-slate-50/60 py-16 dark:border-white/10 dark:bg-[#1c1c1c] lg:py-20">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="All-time"
              title="Akumulasi seluruh musim"
              description="Seluruh musim yang tercatat sejak 2023, termasuk musim yang belum panen (biayanya sudah masuk, pendapatannya belum). ROI = laba bersih ÷ total modal."
            />
          </Reveal>

          <Reveal>
            <dl className="mt-10 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#202020] md:grid-cols-5">
              {allTimeStats.map((s, i) => (
                <div
                  key={s.label}
                  title={s.full}
                  className={`px-5 py-5 ${
                    i > 0
                      ? "border-t border-slate-100 dark:border-white/10 md:border-l md:border-t-0"
                      : ""
                  } ${i % 2 === 1 ? "max-md:border-l max-md:border-slate-100 dark:max-md:border-white/10" : ""} ${
                    i === 4 ? "max-md:col-span-2" : ""
                  }`}
                >
                  <dt className="text-xs text-ink-muted dark:text-white/55">
                    {s.label}
                  </dt>
                  <dd
                    className={`mt-1.5 font-display text-2xl font-medium leading-none ${
                      s.negative
                        ? "text-red-600 dark:text-[#E97366]"
                        : "text-ink dark:text-white"
                    }`}
                  >
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal>
            <div className="mt-5">
              <ChartCard
                title="Tren per tahun"
                description="Batang menunjukkan pendapatan dan pengeluaran, garis menunjukkan laba bersih. Margin dan ROI ada di panel terpisah di bawahnya."
              >
                <AllTimeTrendChart data={allTimeTrendData} />
              </ChartCard>
            </div>
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
