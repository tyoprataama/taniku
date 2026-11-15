import type { KeyboardEvent, ReactNode } from "react";
import type { FieldStatus } from "../../types";
import { fieldStatusMeta } from "../constants/fieldMeta";

// =====================================================
// Primitif UI kecil untuk modal detail lahan & kartu lahan.
// Tujuannya satu: pola visual yang konsisten dan datar
// (garis tipis, sedikit kotak, tipografi yang jelas).
// =====================================================

export type Tone = "neutral" | "good" | "bad" | "info" | "warn";

const toneBox: Record<Tone, string> = {
  neutral: "bg-slate-50 text-ink-muted dark:bg-white/[0.05] dark:text-white/70",
  good: "bg-leaf-50 text-leaf-700 dark:bg-[#72BC8F]/15 dark:text-[#8fdcae]",
  bad: "bg-red-50 text-red-700 dark:bg-[#E97366]/15 dark:text-[#f0a59c]",
  info: "bg-tulus-50 text-tulus-700 dark:bg-[#5E9FE8]/15 dark:text-[#8fbdf0]",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-[#e8c07a]",
};

const toneRing: Record<Tone, string> = {
  neutral:
    "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-white/10 dark:text-white/70 dark:ring-white/20",
  good: "bg-leaf-50 text-leaf-700 ring-leaf-600/20 dark:bg-[#72BC8F]/15 dark:text-[#8fdcae] dark:ring-[#72BC8F]/30",
  bad: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-[#E97366]/15 dark:text-[#f0a59c] dark:ring-[#E97366]/30",
  info: "bg-tulus-50 text-tulus-700 ring-tulus-600/20 dark:bg-[#5E9FE8]/15 dark:text-[#8fbdf0] dark:ring-[#5E9FE8]/30",
  warn: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/15 dark:text-[#e8c07a] dark:ring-amber-400/25",
};

export type ValueTone = "default" | "pos" | "neg" | "info" | "roi";

const valueTone: Record<ValueTone, string> = {
  default: "text-ink dark:text-white",
  pos: "text-leaf-700 dark:text-[#8fdcae]",
  neg: "text-red-600 dark:text-[#E97366]",
  info: "text-tulus-700 dark:text-[#8fbdf0]",
  roi: "text-violet-700 dark:text-[#B794F4]",
};

// ---------- Chip status lahan (Aktif · Live, Persiapan, ...) ----------
export function StatusChip({ status }: { status: FieldStatus }) {
  const meta = fieldStatusMeta[status];
  const isLive = status === "active";
  return (
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
  );
}

// ---------- Pill kecil ----------
export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${toneRing[tone]}`}
    >
      {children}
    </span>
  );
}

// ---------- Section: judul kecil + petunjuk singkat ----------
// Antar-section dipisahkan garis tipis (bungkus dengan <Stack>).
export function Stack({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-white/10">
      {children}
    </div>
  );
}

export function Block({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="py-7 first:pt-0 last:pb-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[12rem] flex-1">
          <h3 className="text-[15px] font-semibold text-ink dark:text-white">
            {title}
          </h3>
          {hint ? (
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-muted dark:text-white/50">
              {hint}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

// ---------- Daftar fakta (label kecil di atas, nilai di bawah) ----------
export function Facts({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-ink-muted dark:text-white/50">
            {it.label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-ink dark:text-white">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- Baris angka utama (satu kotak, dibagi garis tipis) ----------
export function StatRow({
  items,
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    tone?: ValueTone;
  }>;
}) {
  const cols =
    items.length >= 4
      ? "grid-cols-2 sm:grid-cols-4"
      : items.length === 3
        ? "grid-cols-1 sm:grid-cols-3"
        : "grid-cols-2";
  return (
    <div
      className={`grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-white/10 dark:bg-white/10 ${cols}`}
    >
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-white px-4 py-3.5 dark:bg-[#1c1c1c]"
        >
          <p className="text-xs text-ink-muted dark:text-white/50">
            {it.label}
          </p>
          <p
            className={`mt-1 font-display text-xl font-medium leading-tight tabular-nums ${valueTone[it.tone ?? "default"]}`}
          >
            {it.value}
          </p>
          {it.sub ? (
            <p className="mt-1 text-[11px] leading-snug text-ink-muted dark:text-white/45">
              {it.sub}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ---------- Callout berwarna lembut ----------
export function Callout({
  tone = "neutral",
  title,
  children,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${toneBox[tone]}`}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children}
    </div>
  );
}

// ---------- Keadaan kosong ----------
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-ink-muted dark:border-white/15 dark:text-white/50">
      {children}
    </p>
  );
}

// ---------- Tab bar bergaris bawah ----------
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = tabs.findIndex((t) => t.value === value);
    const next =
      e.key === "ArrowRight"
        ? tabs[(i + 1) % tabs.length]
        : tabs[(i - 1 + tabs.length) % tabs.length];
    onChange(next.value);
    e.preventDefault();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="-mb-px flex gap-1 overflow-x-auto scrollbar-thin"
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-white/5 ${
              active
                ? "border-tulus-700 text-tulus-800 dark:border-[#5E9FE8] dark:text-white"
                : "border-transparent text-ink-muted hover:text-ink dark:text-white/55 dark:hover:text-white"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 ? (
              <span
                className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${
                  active
                    ? "bg-tulus-50 text-tulus-700 dark:bg-[#5E9FE8]/20 dark:text-[#8fbdf0]"
                    : "bg-slate-100 text-ink-muted dark:bg-white/10 dark:text-white/55"
                }`}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
