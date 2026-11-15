import { FiMapPin, FiArrowUpRight } from "react-icons/fi";
import type { Field, Season } from "../../types";
import { haFromM2 } from "../../data";
import { formatNumber } from "../../utils/format";
import { growthProgress } from "../../utils/harvest";
import { WeatherBadge } from "./WeatherBadge";
import { StatusChip } from "./DetailPrimitives";

const progressStyle = (pct: number) => ({
  width: `${Math.min(100, Math.max(0, pct))}%`,
});
const ownershipLabel: Record<string, string> = {
  owned: "Milik Sendiri",
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
  // Progress berbasis tanggal (sinkron dengan detail modal), bukan angka manual.
  const progressPct = growthProgress(season);
  const overdue = progressPct > 100;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Buka detail ${field.name}`}
      className="group flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left transition duration-300 hover:-translate-y-0.5 hover:border-tulus-200 hover:shadow-[0_20px_40px_-28px_rgba(16,35,66,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-tulus-600/40 dark:border-white/10 dark:bg-[#202020] dark:hover:border-[#5E9FE8]/40 dark:hover:shadow-[0_20px_40px_-24px_rgba(0,0,0,0.8)]"
    >
      <div className="flex items-center justify-between gap-3">
        <StatusChip status={season.status} />
        {/* Cuaca hari ini */}
        <WeatherBadge bmkgCode={field.bmkgCode} seed={field.location} />
      </div>

      <div className="mt-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-medium leading-snug text-ink dark:text-white">
            {field.name}
          </h3>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted dark:text-white/60">
            <FiMapPin size={13} /> {field.location}
          </p>
        </div>
        <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-muted opacity-50 ring-1 ring-slate-200 transition group-hover:bg-tulus-50 group-hover:text-tulus-700 group-hover:opacity-100 dark:text-white/60 dark:ring-white/15 dark:group-hover:bg-[#5E9FE8]/15 dark:group-hover:text-[#8fbdf0]">
          <FiArrowUpRight size={15} />
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 py-3.5 text-sm dark:divide-white/10 dark:border-white/10">
        <div className="min-w-0 pr-3">
          <dt className="text-xs text-ink-muted dark:text-white/50">
            Komoditas
          </dt>
          <dd className="mt-1 truncate font-medium text-ink dark:text-white">
            {season.crop}
          </dd>
        </div>
        <div className="min-w-0 px-3">
          <dt className="text-xs text-ink-muted dark:text-white/50">Luas</dt>
          <dd className="mt-1 truncate font-medium tabular-nums text-ink dark:text-white">
            {formatNumber(haFromM2(field.areaM2))} ha
          </dd>
        </div>
        <div className="min-w-0 pl-3">
          <dt className="text-xs text-ink-muted dark:text-white/50">
            Kepemilikan
          </dt>
          <dd className="mt-1 truncate font-medium text-ink dark:text-white">
            {ownershipLabel[field.ownership]}
          </dd>
        </div>
      </dl>

      <div className="mt-auto pt-5">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="min-w-0 flex-1 truncate text-ink-muted dark:text-white/50">
            Progress · {season.label}
          </span>
          <span
            className={`shrink-0 font-semibold tabular-nums ${
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
