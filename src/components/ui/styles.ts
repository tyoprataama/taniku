// =====================================================
// Kelas Tailwind bersama untuk seluruh halaman admin, supaya form,
// tabel, dan filter tampil seragam (tidak lagi diulang di tiap halaman).
// =====================================================

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-tulus-600 focus:ring-2 focus:ring-tulus-600/20 dark:focus:border-[#5E9FE8] dark:focus:ring-[#5E9FE8]/25";

export const labelClass =
  "mb-1.5 block text-xs font-medium text-ink-muted dark:text-white/60";

export const helpClass = "mt-1.5 text-xs text-ink-muted dark:text-white/50";

export const errorClass = "mt-1.5 text-xs text-red-600 dark:text-[#E97366]";

/** Select kecil untuk filter di header kartu. */
export const selectSmClass =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-ink-muted outline-none transition focus:border-tulus-600 focus:ring-2 focus:ring-tulus-600/20";

// ---- Tabel ----
export const tableWrap = "overflow-x-auto scrollbar-thin";
export const theadClass =
  "border-b border-slate-200 text-xs text-ink-muted dark:border-white/10 dark:text-white/50";
export const thClass = "px-4 py-3 font-medium whitespace-nowrap";
export const tdClass = "px-4 py-3.5";
export const trClass =
  "border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-50/70 dark:border-white/[0.07] dark:hover:bg-white/[0.03]";

/** Warna nilai berdasarkan tanda (laba/rugi). */
export const signTone = (v: number) =>
  v < 0
    ? "text-red-600 dark:text-[#E97366]"
    : v > 0
      ? "text-leaf-700 dark:text-[#8fdcae]"
      : "text-ink-muted dark:text-white/60";

/** Tombol ikon bulat kecil (edit / hapus) pada baris daftar. */
export const iconButton =
  "grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-slate-100 hover:text-ink dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white";
export const iconButtonDanger =
  "grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-red-50 hover:text-red-600 dark:text-white/55 dark:hover:bg-[#E97366]/15 dark:hover:text-[#f0a59c]";
