import type { ReactNode } from "react";

// =====================================================
// Blok pembangun grafik yang dipakai bersama oleh halaman Showcase
// dan modal detail lahan, supaya semua grafik punya "bahasa visual"
// yang sama: judul, toggle tampilan, legend, dan kartu pembungkus.
// =====================================================

// ---------- Kartu pembungkus grafik ----------
export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#202020] sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-medium text-ink dark:text-white">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-muted dark:text-white/60">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5 flex-1">{children}</div>
    </div>
  );
}

// ---------- Toggle tampilan (mis. Rupiah | ROI) ----------
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex rounded-full bg-slate-100 p-0.5 dark:bg-white/10"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-tulus-600/40 ${
              active
                ? "bg-white text-ink shadow-sm dark:bg-white/15 dark:text-white"
                : "text-ink-muted hover:text-ink dark:text-white/55 dark:hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Legend ringkas (pengganti legend bawaan recharts) ----------
export type LegendItem = {
  label: string;
  color: string;
  shape?: "bar" | "line" | "dash";
};

const swatchStyle = (color: string) => ({ backgroundColor: color });
const dashStyle = (color: string) => ({ borderColor: color });

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-muted dark:text-white/60">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          {it.shape === "line" ? (
            <span
              className="h-0.5 w-3.5 rounded-full"
              style={swatchStyle(it.color)}
            />
          ) : it.shape === "dash" ? (
            <span
              className="w-3.5 border-t-2 border-dashed"
              style={dashStyle(it.color)}
            />
          ) : (
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={swatchStyle(it.color)}
            />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}
