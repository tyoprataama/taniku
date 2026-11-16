import { Link, useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiLayers,
  FiDollarSign,
  FiClock,
  FiImage,
  FiTrendingUp,
  FiTrendingDown,
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
} from "react-icons/fi";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FieldCard } from "../components/cards/FieldCard";
import { StatisticCard } from "../components/cards/StatisticCard";
import { PageTransition } from "../components/ui/PageTransition";
import {
  fieldsByYear,
  getLatestYear,
  getSeasonByFieldYear,
  totalExpensesByYear,
  totalRevenueByYear,
  useDataVersion,
} from "../data";
import { formatCompactCurrency } from "../utils/format";
import { harvestInfo } from "../utils/harvest";
import { periodIsRunning } from "../client/utils/analytics";

const shortcuts = [
  {
    icon: FiLayers,
    title: "Kelola lahan",
    text: "Tambah lahan dan musim tanam.",
    to: "/admin/fields",
  },
  {
    icon: FiDollarSign,
    title: "Catat biaya & pendapatan",
    text: "Input transaksi dan target panen.",
    to: "/admin/economics",
  },
  {
    icon: FiClock,
    title: "Tambah aktivitas",
    text: "Catat kegiatan harian di lapangan.",
    to: "/admin/timeline",
  },
  {
    icon: FiImage,
    title: "Unggah dokumentasi",
    text: "Foto perkembangan tanaman.",
    to: "/admin/gallery",
  },
];

export default function Home() {
  useDataVersion();
  const navigate = useNavigate();
  const year = getLatestYear();
  const pairs = fieldsByYear(year)
    .map((field) => ({ field, season: getSeasonByFieldYear(field.id, year) }))
    .filter((p) => p.season !== undefined);

  const revenue = totalRevenueByYear(year);
  const expense = totalExpensesByYear(year);
  const profit = revenue - expense;
  const running = periodIsRunning(year);
  const activeCount = pairs.filter((p) => p.season?.status === "active").length;

  // Hal-hal yang perlu perhatian admin.
  const overdue = pairs.filter((p) => {
    if (!p.season) return false;
    return (
      harvestInfo({
        status: p.season.status,
        harvestDate: p.season.harvestDate,
      }).state === "overdue"
    );
  });
  const alerts: Array<{ tone: "bad" | "good" | "info"; text: string }> = [];
  if (overdue.length) {
    alerts.push({
      tone: "bad",
      text: `${overdue.length} lahan melewati perkiraan panen: ${overdue
        .map((o) => o.field.name.replace(/^Lahan /, ""))
        .join(", ")}.`,
    });
  }
  if (running) {
    alerts.push({
      tone: "info",
      text: `Musim ${year} masih berjalan. Pendapatan baru tercatat setelah panen, jadi laba minus saat ini (${formatCompactCurrency(profit)}) bersifat sementara dan belum berarti rugi.`,
    });
  } else if (profit < 0) {
    alerts.push({
      tone: "bad",
      text: `Musim ${year} belum menutup biaya: pendapatan ${formatCompactCurrency(Math.abs(profit))} di bawah total biaya.`,
    });
  }
  if (!alerts.length) {
    alerts.push({
      tone: "good",
      text: "Tidak ada peringatan. Semua lahan sesuai jadwal dan musim ini menguntungkan.",
    });
  }

  return (
    <PageTransition>
      <section className="overflow-hidden rounded-3xl bg-tulus-900 p-8 text-white lg:p-10">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="h-px w-6 bg-leaf-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-tulus-100">
              Dashboard Admin
            </span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-medium leading-tight lg:text-4xl">
            Field Management System
          </h1>
          <p className="mt-3 leading-relaxed text-tulus-100">
            Dokumentasi & manajemen operasi lapangan pertanian — menampilkan
            skill manajemen operasional, analisis data, dan pelaporan yang
            transferable ke industri seperti pertambangan.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/admin/fields")}
              className="inline-flex items-center gap-2 rounded-full bg-[#ffffff] px-6 py-3 text-sm font-medium text-[#102342] transition-colors hover:bg-[#eef3fb]"
            >
              Kelola Lahan <FiArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate("/admin/overview")}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Lihat Overview
            </button>
          </div>
        </div>
      </section>

      <div className="mb-4 mt-10 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-medium text-ink">
          Ringkasan musim {year}
        </h2>
        <Link
          to="/admin/economics"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-tulus-700 hover:text-tulus-800"
        >
          Detail keuangan <FiArrowRight size={15} />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatisticCard
          label="Total Pendapatan"
          value={formatCompactCurrency(revenue)}
          icon={FiTrendingUp}
          tone="green"
        />
        <StatisticCard
          label="Total Biaya"
          value={formatCompactCurrency(expense)}
          icon={FiTrendingDown}
          tone="blue"
        />
        <StatisticCard
          label="Laba Bersih"
          value={formatCompactCurrency(profit)}
          icon={FiDollarSign}
          tone={profit < 0 && !running ? "red" : "green"}
          negative={profit < 0}
          provisional={running}
        />
        <StatisticCard
          label="Lahan Aktif"
          value={`${activeCount} / ${pairs.length}`}
          icon={FiActivity}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <CardHeader
            title="Pintasan"
            description="Aksi yang paling sering dipakai."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {shortcuts.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="group flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-tulus-200 hover:bg-slate-50/70 dark:border-white/10 dark:hover:border-[#5E9FE8]/40 dark:hover:bg-white/[0.03]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tulus-50 text-tulus-700 dark:bg-[#5E9FE8]/15 dark:text-[#8fbdf0]">
                  <s.icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink dark:text-white">
                    {s.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted dark:text-white/55">
                    {s.text}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader
            title="Perlu perhatian"
            description="Dihitung otomatis dari data terbaru."
          />
          <ul className="space-y-3">
            {alerts.map((a, i) => (
              <li
                key={i}
                className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  a.tone === "bad"
                    ? "bg-red-50 text-red-700 dark:bg-[#E97366]/15 dark:text-[#f0a59c]"
                    : a.tone === "info"
                      ? "bg-tulus-50 text-tulus-700 dark:bg-[#5E9FE8]/15 dark:text-[#8fbdf0]"
                      : "bg-leaf-50 text-leaf-700 dark:bg-[#72BC8F]/15 dark:text-[#8fdcae]"
                }`}
              >
                {a.tone === "bad" ? (
                  <FiAlertTriangle className="mt-0.5 shrink-0" size={16} />
                ) : a.tone === "info" ? (
                  <FiActivity className="mt-0.5 shrink-0" size={16} />
                ) : (
                  <FiCheckCircle className="mt-0.5 shrink-0" size={16} />
                )}
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mb-4 mt-10 flex items-center justify-between">
        <h2 className="font-display text-xl font-medium text-ink">
          Lahan musim {year}
        </h2>
        <Link
          to="/admin/overview"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-tulus-700 hover:text-tulus-800"
        >
          Lihat semua <FiArrowRight size={15} />
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {pairs.slice(0, 3).map((p) => (
          <FieldCard
            key={p.field.id}
            field={p.field}
            onClick={() => navigate("/admin/fields")}
          />
        ))}
      </div>
      {pairs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-muted">
          Belum ada lahan pada musim ini.{" "}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/fields")}
          >
            Tambah lahan
          </Button>
        </Card>
      ) : null}
    </PageTransition>
  );
}
