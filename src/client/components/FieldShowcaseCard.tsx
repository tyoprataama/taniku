import { FiMapPin, FiArrowUpRight } from "react-icons/fi";
import type { Field, Season } from "../../types";
import { fieldStatusMeta } from "../constants/fieldMeta";
import { haFromM2 } from "../../data";
import { formatNumber } from "../../utils/format";
import { growthProgress } from "../../utils/harvest";
import { WeatherBadge } from "./WeatherBadge";

const progressStyle = (pct: number) => ({
  width: `${Math.min(100, Math.max(0, pct))}%`,
});
const ownershipLabel: Record<string, string> = {
  owned: "Milik sendiri",
  rental: "Sewa",
};

export function FieldShowcaseCard({
  field,
  season,
  onSelect,
}: {
  field: Field;
  season: Season;
  onSelect: () => void;
}) {
  const meta = fieldStatusMeta[season.status];
  const isLive = season.status === "active";
  // Progress berbasis tanggal (sinkron dengan detail modal), bukan angka manual.
  const progressPct = growthProgress(season);
  const overdue = progressPct > 100;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-tulus-200 hover:shadow-[0_18px_40px_-26px_rgba(16,35,66,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-tulus-600/40 dark:border-white/10 dark:bg-[#202020] dark:hover:border-[#5E9FE8]/40 dark:hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.8)] sm:p-6"
    >
      {/* Baris atas: status + cuaca */}
      <div className="flex items-center justify-between gap-3">
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

      {/* Identitas lahan */}
      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-medium text-ink dark:text-white">
            {field.name}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted dark:text-white/60">
            <FiMapPin size={13} className="shrink-0" />
            <span className="truncate">{field.location}</span>
          </p>
        </div>
        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-ink-muted transition group-hover:bg-tulus-600 group-hover:text-white dark:bg-white/10 dark:text-white/60 dark:group-hover:bg-[#5E9FE8] dark:group-hover:text-[#0c111b]">
          <FiArrowUpRight size={16} />
        </span>
      </div>

      {/* Fakta utama: satu baris, tiga kolom */}
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm dark:border-white/10">
        <div className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted dark:text-white/45">
            Komoditas
          </dt>
          <dd className="mt-1 truncate font-medium text-ink dark:text-white">
            {season.crop}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted dark:text-white/45">
            Luas
          </dt>
          <dd className="mt-1 truncate font-medium text-ink dark:text-white">
            {formatNumber(haFromM2(field.areaM2))} ha
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-ink-muted dark:text-white/45">
            Status lahan
          </dt>
          <dd className="mt-1 truncate font-medium text-ink dark:text-white">
            {ownershipLabel[field.ownership]}
          </dd>
        </div>
      </dl>

      {/* Progress */}
      <div className="mt-auto pt-5">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="min-w-0 flex-1 truncate text-ink-muted dark:text-white/50">
            {season.label}
          </span>
          <span
            className={`shrink-0 text-sm font-semibold ${
              overdue
                ? "text-red-600 dark:text-[#E97366]"
                : "text-tulus-700 dark:text-[#8fbdf0]"
            }`}
          >
            {formatNumber(progressPct)}%
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${
              overdue ? "bg-red-500" : "bg-tulus-600 dark:bg-[#5E9FE8]"
            }`}
            style={progressStyle(progressPct)}
          />
        </div>
      </div>
    </button>
  );
}
