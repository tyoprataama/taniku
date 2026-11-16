import type { IconType } from "react-icons";
import { Card } from "../ui/Card";

export type StatTone =
  | "default"
  | "green"
  | "red"
  | "blue"
  | "amber"
  | "violet";

const iconTone: Record<StatTone, string> = {
  default: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/60",
  green: "bg-leaf-50 text-leaf-700 dark:bg-[#72BC8F]/15 dark:text-[#8fdcae]",
  red: "bg-red-50 text-red-600 dark:bg-[#E97366]/15 dark:text-[#f0a59c]",
  blue: "bg-tulus-50 text-tulus-700 dark:bg-[#5E9FE8]/15 dark:text-[#8fbdf0]",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-[#e8c07a]",
  violet:
    "bg-violet-50 text-violet-600 dark:bg-[#B794F4]/15 dark:text-[#B794F4]",
};

interface StatisticCardProps {
  label: string;
  value: string;
  icon: IconType;
  trend?: { value: string; positive: boolean };
  /** Warna chip ikon. */
  tone?: StatTone;
  /** Penjelasan singkat di bawah angka (rumus / cara baca). */
  hint?: string;
  /** Warnai angka merah bila negatif. */
  negative?: boolean;
  /** Musim belum selesai: angka masih sementara (tidak diwarnai merah). */
  provisional?: boolean;
}

export function StatisticCard({
  label,
  value,
  icon: Icon,
  trend,
  tone = "default",
  hint,
  negative,
  provisional,
}: StatisticCardProps) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted dark:text-white/60">
          {label}
          {provisional ? (
            <span className="rounded-full bg-tulus-50 px-2 py-0.5 text-[10px] font-medium text-tulus-700 dark:bg-[#5E9FE8]/15 dark:text-[#8fbdf0]">
              Sementara
            </span>
          ) : null}
        </p>
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${iconTone[tone]}`}
        >
          <Icon size={16} />
        </span>
      </div>
      <p
        className={`mt-3 font-display text-[1.75rem] font-medium leading-none tabular-nums ${
          negative && !provisional
            ? "text-red-600 dark:text-[#E97366]"
            : "text-ink dark:text-white"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-snug text-ink-muted dark:text-white/45">
          {hint}
        </p>
      ) : null}
      {trend && (
        <p
          className={`mt-3 text-xs font-medium ${
            trend.positive
              ? "text-leaf-700 dark:text-[#8fdcae]"
              : "text-red-600 dark:text-[#E97366]"
          }`}
        >
          {trend.positive ? "▲" : "▼"} {trend.value}
        </p>
      )}
    </Card>
  );
}
