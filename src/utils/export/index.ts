// =====================================================
// Titik masuk ekspor keuangan: PDF, Excel (.xlsx), Word (.docx).
//
// Ketiga format memakai satu sumber data (dataset.ts) dan tata letak yang
// sama: dipisah per periode lalu per lahan, tanpa kolom Musim/Lahan yang
// berulang, ditutup subtotal lahan, total periode, dan total keseluruhan.
// Tidak ada dependensi npm tambahan — semua berkas dibuat sendiri.
// =====================================================
import {
  buildFinanceExport,
  exportFileBase,
  dmy,
  num,
  pct,
  rp,
  stamp,
  type ExportDataset,
  type ExportFormat,
  type ExportOptions,
  type ExportTotals,
} from "./dataset";
import { renderPdf, type PdfBlock, type PdfColumn } from "./pdf";
import { buildXlsx } from "./xlsx";
import { buildDocx } from "./docx";

export type { ExportFormat, ExportKind, ExportOptions } from "./dataset";
export { buildFinanceExport, stamp };

/** Ekstensi berkas per format — kini OOXML asli untuk Excel & Word. */
const EXT: Record<ExportFormat, string> = {
  pdf: "pdf",
  excel: "xlsx",
  word: "docx",
};

export const formatLabel: Record<ExportFormat, string> = {
  pdf: "PDF",
  excel: "Excel",
  word: "Word",
};

// Total lebar 523 pt = A4 portrait (595) dikurangi margin kiri+kanan (2 × 36).
const PDF_COLUMNS: PdfColumn[] = [
  { header: "Tanggal", width: 62 },
  { header: "Jenis", width: 70 },
  { header: "Kategori / Produk", width: 96 },
  { header: "Keterangan", width: 195 },
  { header: "Nominal", width: 100, align: "right" },
];

/** Ringkasan total sebagai pasangan label–nilai. */
function totalsKv(
  totals: ExportTotals,
  withRoi = true,
): Array<[string, string]> {
  const items: Array<[string, string]> = [
    ["Total Pendapatan", rp(totals.revenue)],
    ["Total Pengeluaran", rp(totals.expense)],
    [totals.profit < 0 ? "Rugi" : "Untung", rp(totals.profit)],
    ["Jumlah transaksi", `${num(totals.count)} transaksi`],
  ];
  if (withRoi) {
    items.push(["Margin", pct(totals.margin)]);
    items.push(["ROI", pct(totals.roi)]);
  }
  return items;
}

/** Susun blok-blok tata letak PDF dari data ekspor. */
export function pdfBlocks(data: ExportDataset): PdfBlock[] {
  const blocks: PdfBlock[] = [
    {
      kind: "title",
      text: "Laporan Keuangan Lahan \u2014 Taniku",
      subtitle: "Rekap pendapatan & pengeluaran per periode dan per lahan",
    },
    {
      kind: "meta",
      items: [
        ["Dibuat pada", stamp(data.generatedAt)],
        ["Periode", data.periodLabel],
        ["Lahan", data.fieldLabel],
        ["Jenis data", data.kindLabel],
      ],
    },
    { kind: "heading", text: "Ikhtisar" },
    { kind: "kv", items: totalsKv(data.totals) },
  ];

  if (data.periods.length === 0) {
    blocks.push({
      kind: "paragraph",
      text: "Tidak ada transaksi pada cakupan yang dipilih.",
    });
    return blocks;
  }

  // Tiap periode dan tiap lahan selalu diawali lembar baru, sehingga tabel
  // lahan berikutnya tidak menyambung di sisa halaman lahan sebelumnya.
  let firstSection = true;
  for (const period of data.periods) {
    if (!firstSection) blocks.push({ kind: "pageBreak" });
    firstSection = false;
    blocks.push({
      kind: "bar",
      level: 1,
      text: period.label.toUpperCase(),
      note: `${num(period.totals.count)} transaksi \u00b7 ${
        period.fieldGroups.length
      } lahan`,
    });

    let firstGroup = true;
    for (const group of period.fieldGroups) {
      if (!firstGroup) blocks.push({ kind: "pageBreak" });
      firstGroup = false;
      blocks.push({
        kind: "bar",
        level: 2,
        text: group.fieldName,
        note: group.seasonLabels.join(", ") || undefined,
      });
      blocks.push({
        kind: "table",
        columns: PDF_COLUMNS,
        // Header tabel cukup sekali di awal tiap lahan; saat tabel berlanjut
        // ke lembar berikutnya header tidak dicetak lagi.
        repeatHeader: false,
        rows: group.rows.map((row) => [
          dmy(row.date),
          row.typeLabel,
          row.category,
          row.description,
          rp(row.amount),
        ]),
        totalRow: [
          `Subtotal ${group.fieldName}`,
          "",
          "",
          `${num(group.totals.count)} transaksi`,
          rp(group.totals.profit),
        ],
      });
      blocks.push({ kind: "kv", items: totalsKv(group.totals, false) });
    }

    blocks.push({
      kind: "bar",
      level: 1,
      text: `TOTAL ${period.label.toUpperCase()}`,
    });
    blocks.push({ kind: "kv", items: totalsKv(period.totals) });
  }

  // Total keseluruhan hanya dicetak bila ada lebih dari satu periode. Untuk
  // satu periode angkanya identik dengan "TOTAL <periode>" di atas, jadi tidak
  // perlu diulang.
  if (data.periods.length > 1) {
    blocks.push({ kind: "heading", text: "Total Keseluruhan" });
    blocks.push({ kind: "kv", items: totalsKv(data.totals) });
  }

  return blocks;
}

/** Picu unduhan berkas di peramban. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Beri jeda agar unduhan sempat dimulai sebelum URL dilepas.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Bangun dan unduh berkas ekspor keuangan.
 *
 * @returns Nama berkas dan jumlah transaksi yang tercetak.
 */
export function runFinanceExport(
  format: ExportFormat,
  opts: ExportOptions,
): { filename: string; rows: number } {
  const data = buildFinanceExport(opts);
  const filename = `${exportFileBase(data, opts)}.${EXT[format]}`;

  const blob =
    format === "excel"
      ? buildXlsx(data)
      : format === "word"
        ? buildDocx(data)
        : renderPdf(
            pdfBlocks(data),
            `Laporan Keuangan Taniku \u2014 ${data.periodLabel} \u00b7 ${data.fieldLabel}`,
            `Dibuat otomatis oleh Taniku pada ${stamp(data.generatedAt)}`,
          );

  downloadBlob(blob, filename);
  return { filename, rows: data.totals.count };
}
