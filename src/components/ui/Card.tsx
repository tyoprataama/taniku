import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
}

// Kartu datar: garis tipis, tanpa bayangan berat (selaras dengan sisi client).
export function Card({ children, hover, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#202020] ${
        hover
          ? "transition hover:border-tulus-200 hover:shadow-[0_18px_36px_-26px_rgba(16,35,66,0.4)]"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/** Kepala kartu: judul + keterangan + aksi di kanan. */
export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink dark:text-white">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-muted dark:text-white/50">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
