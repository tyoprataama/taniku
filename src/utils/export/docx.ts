// =====================================================
// Generator Word (.docx) asli — TANPA library eksternal.
//
// Menulis paket OOXML WordprocessingML di dalam arsip ZIP, sehingga ekstensi
// .docx cocok dengan isinya (tidak lagi memicu peringatan "format and
// extension don't match" seperti pada .doc berbasis HTML).
//
// Tata letak sama seperti PDF & Excel: portrait, dipisah per periode lalu per
// lahan, kolom Musim/Lahan tidak diulang tiap baris, header tabel hanya dibuat
// sekali per lahan (tidak diulang saat tabel berlanjut ke lembar berikutnya),
// ditutup subtotal lahan, total periode, dan total keseluruhan.
// =====================================================
import { createZip, MIME, xmlEsc, type ZipEntry } from "./zip";
import {
  dmy,
  num,
  pct,
  rp,
  stamp,
  type ExportDataset,
  type ExportTotals,
} from "./dataset";

// ---------- Palet tema (biru "tulus") ----------
const C = {
  dark: "214E8A",
  mid: "3263A6",
  head: "5181C0",
  tint: "D6E3F4",
  soft: "EEF3FB",
  muted: "5B6675",
  white: "FFFFFF",
  ink: "0C111B",
};

// Lebar kolom dalam twips. Total = 9638 (A4 portrait dikurangi margin 2 cm).
const COL_W = [1150, 1250, 1750, 3688, 1800];
const FULL_W = 9638;
const LABEL_W = COL_W[0] + COL_W[1] + COL_W[2] + COL_W[3];

type RunOpts = {
  bold?: boolean;
  size?: number; // dalam pt
  color?: string;
  italic?: boolean;
};

const run = (text: string, opts: RunOpts = {}): string => {
  const props =
    "<w:rPr>" +
    (opts.bold ? "<w:b/>" : "") +
    (opts.italic ? "<w:i/>" : "") +
    (opts.color ? `<w:color w:val="${opts.color}"/>` : "") +
    (opts.size ? `<w:sz w:val="${Math.round(opts.size * 2)}"/>` : "") +
    "</w:rPr>";
  return `<w:r>${props}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
};

type ParaOpts = RunOpts & {
  shade?: string;
  align?: "left" | "center" | "right";
  spaceBefore?: number;
  spaceAfter?: number;
};

const para = (text: string, opts: ParaOpts = {}): string => {
  const props =
    "<w:pPr>" +
    (opts.shade
      ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shade}"/>`
      : "") +
    `<w:spacing w:before="${opts.spaceBefore ?? 0}" w:after="${
      opts.spaceAfter ?? 60
    }"/>` +
    (opts.align && opts.align !== "left"
      ? `<w:jc w:val="${opts.align}"/>`
      : "") +
    (opts.shade ? '<w:ind w:left="113" w:right="113"/>' : "") +
    "</w:pPr>";
  return `<w:p>${props}${run(text, opts)}</w:p>`;
};

/** Judul kelompok berlatar biru: level 1 = periode, level 2 = lahan. */
const bar = (text: string, level: 1 | 2, note?: string): string =>
  para(note ? `${text}  \u2014  ${note}` : text, {
    shade: level === 1 ? C.dark : C.mid,
    bold: true,
    color: C.white,
    size: level === 1 ? 12.5 : 11,
    spaceBefore: level === 1 ? 240 : 160,
    spaceAfter: 80,
  });

type CellOpts = RunOpts & {
  shade?: string;
  align?: "left" | "center" | "right";
};

const cell = (text: string, width: number, opts: CellOpts = {}): string => {
  const props =
    "<w:tcPr>" +
    `<w:tcW w:w="${width}" w:type="dxa"/>` +
    (opts.shade
      ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shade}"/>`
      : "") +
    '<w:vAlign w:val="center"/>' +
    "</w:tcPr>";
  const paraProps =
    '<w:pPr><w:spacing w:before="20" w:after="20"/>' +
    (opts.align && opts.align !== "left"
      ? `<w:jc w:val="${opts.align}"/>`
      : "") +
    "</w:pPr>";
  return `<w:tc>${props}<w:p>${paraProps}${run(text, opts)}</w:p></w:tc>`;
};

/**
 * Baris tabel. Atribut w:tblHeader sengaja TIDAK dipakai supaya header tidak
 * diulang saat tabel melanjut ke lembar berikutnya (header cukup sekali di
 * awal tiap lahan).
 */
const tableRow = (cells: string[]): string =>
  `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.join("")}</w:tr>`;

const tableProps = (widths: number[]): string =>
  "<w:tblPr>" +
  `<w:tblW w:w="${FULL_W}" w:type="dxa"/>` +
  "<w:tblBorders>" +
  '<w:top w:val="single" w:sz="4" w:color="AEC6E8"/>' +
  '<w:left w:val="single" w:sz="4" w:color="AEC6E8"/>' +
  '<w:bottom w:val="single" w:sz="4" w:color="AEC6E8"/>' +
  '<w:right w:val="single" w:sz="4" w:color="AEC6E8"/>' +
  '<w:insideH w:val="single" w:sz="4" w:color="AEC6E8"/>' +
  '<w:insideV w:val="single" w:sz="4" w:color="AEC6E8"/>' +
  "</w:tblBorders>" +
  '<w:tblLayout w:type="fixed"/>' +
  "</w:tblPr>" +
  "<w:tblGrid>" +
  widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("") +
  "</w:tblGrid>";

const table = (rows: string[], widths: number[] = COL_W): string =>
  `<w:tbl>${tableProps(widths)}${rows.join("")}</w:tbl>`;

/** Ringkasan total dua kolom, mengikuti blok "kv" pada PDF. */
function kvTable(
  items: Array<[string, string]>,
  labelShade = C.soft,
  labelColor = C.dark,
): string {
  const half = Math.floor(FULL_W / 2);
  return table(
    items.map(([label, value]) =>
      tableRow([
        cell(label, half, {
          size: 9.5,
          color: labelColor,
          shade: labelShade,
          bold: true,
        }),
        cell(value, FULL_W - half, {
          size: 9.5,
          color: C.ink,
          align: "right",
          bold: true,
        }),
      ]),
    ),
    [half, FULL_W - half],
  );
}

function totalKv(
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

/** Satu baris subtotal lahan, sama dengan totalRow pada PDF. */
function fieldSubtotalRow(fieldName: string, totals: ExportTotals): string {
  return tableRow([
    cell(`Subtotal ${fieldName}`, COL_W[0], {
      size: 9.5,
      bold: true,
      shade: C.tint,
      color: C.dark,
    }),
    cell("", COL_W[1], { shade: C.tint }),
    cell("", COL_W[2], { shade: C.tint }),
    cell(`${num(totals.count)} transaksi`, COL_W[3], {
      size: 9.5,
      bold: true,
      shade: C.tint,
      color: C.dark,
    }),
    cell(rp(totals.profit), COL_W[4], {
      size: 9.5,
      bold: true,
      shade: C.tint,
      color: C.dark,
      align: "right",
    }),
  ]);
}

function headerRow(): string {
  const style: CellOpts = {
    bold: true,
    color: C.white,
    shade: C.head,
    size: 9.5,
  };
  return tableRow([
    cell("Tanggal", COL_W[0], style),
    cell("Jenis", COL_W[1], style),
    cell("Kategori / Produk", COL_W[2], style),
    cell("Keterangan", COL_W[3], style),
    cell("Nominal", COL_W[4], { ...style, align: "right" }),
  ]);
}

/** Pemisah halaman: dipakai agar tiap lahan mulai di lembar baru. */
const pageBreak = (): string =>
  '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

function buildBody(data: ExportDataset): string {
  const parts: string[] = [];

  // --- Kop laporan: sama dengan blok title PDF ---
  parts.push(
    para("Laporan Keuangan Lahan — Taniku", {
      shade: C.dark,
      bold: true,
      color: C.white,
      size: 17,
      spaceAfter: 0,
    }),
  );
  parts.push(
    para("Rekap pendapatan & pengeluaran per periode dan per lahan", {
      shade: C.dark,
      color: C.tint,
      size: 9.5,
      spaceAfter: 160,
    }),
  );

  // --- Metadata: sama urutan dan isi dengan PDF ---
  const metaWidth = 2400;
  const metaValueWidth = FULL_W - metaWidth;
  parts.push(
    table(
      [
        ["Dibuat pada", stamp(data.generatedAt)],
        ["Periode", data.periodLabel],
        ["Lahan", data.fieldLabel],
        ["Jenis data", data.kindLabel],
      ].map(([label, value]) =>
        tableRow([
          cell(label, metaWidth, {
            size: 9.5,
            bold: true,
            color: C.dark,
            shade: C.soft,
          }),
          cell(value, metaValueWidth, { size: 9.5, color: C.ink }),
        ]),
      ),
      [metaWidth, metaValueWidth],
    ),
  );

  // --- Ikhtisar: pasangan label-nilai seperti block "kv" PDF ---
  parts.push(bar("Ikhtisar", 1));
  parts.push(kvTable(totalKv(data.totals)));

  if (data.periods.length === 0) {
    parts.push(
      para("Tidak ada transaksi pada cakupan yang dipilih.", {
        size: 9.5,
        italic: true,
        color: C.muted,
        spaceBefore: 160,
      }),
    );
  }

  // --- Data utama: periode -> lahan, mengikuti urutan pdfBlocks() ---
  let firstSection = true;
  for (const period of data.periods) {
    if (!firstSection) parts.push(pageBreak());
    firstSection = false;

    parts.push(
      bar(
        period.label.toUpperCase(),
        1,
        `${num(period.totals.count)} transaksi · ${period.fieldGroups.length} lahan`,
      ),
    );

    let firstGroup = true;
    for (const group of period.fieldGroups) {
      if (!firstGroup) parts.push(pageBreak());
      firstGroup = false;

      parts.push(
        bar(
          group.fieldName,
          2,
          group.seasonLabels.length ? group.seasonLabels.join(", ") : undefined,
        ),
      );

      const rows: string[] = [headerRow()];
      group.rows.forEach((row, index) => {
        const zebra = index % 2 === 1 ? C.soft : undefined;
        rows.push(
          tableRow([
            cell(dmy(row.date), COL_W[0], {
              size: 9,
              shade: zebra,
              align: "center",
            }),
            cell(row.typeLabel, COL_W[1], { size: 9, shade: zebra }),
            cell(row.category, COL_W[2], { size: 9, shade: zebra }),
            cell(row.description, COL_W[3], { size: 9, shade: zebra }),
            cell(rp(row.amount), COL_W[4], {
              size: 9,
              shade: zebra,
              align: "right",
            }),
          ]),
        );
      });

      // Sama dengan PDF: satu subtotal di footer tabel, lalu ringkasan terpisah.
      rows.push(fieldSubtotalRow(group.fieldName, group.totals));
      parts.push(table(rows));
      parts.push(
        kvTable([
          ["Total Pendapatan", rp(group.totals.revenue)],
          ["Total Pengeluaran", rp(group.totals.expense)],
          [group.totals.profit < 0 ? "Rugi" : "Untung", rp(group.totals.profit)],
        ]),
      );
    }

    // Total periode: bar + ringkasan, sama seperti PDF.
    parts.push(
      bar(`TOTAL ${period.label.toUpperCase()}`, 1),
    );
    parts.push(kvTable(totalKv(period.totals)));
  }

  // Total keseluruhan hanya bila lebih dari satu periode.
  if (data.periods.length > 1) {
    parts.push(bar("Total Keseluruhan", 1));
    parts.push(kvTable(totalKv(data.totals)));
  }

  parts.push(
    para(
      `Dokumen dibuat otomatis oleh Taniku pada ${stamp(data.generatedAt)}.`,
      { size: 8.5, italic: true, color: C.muted, spaceBefore: 200 },
    ),
  );

  // Portrait A4 dengan margin 2 cm, sama orientasi PDF.
  const sectPr =
    "<w:sectPr>" +
    '<w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" ' +
    'w:header="567" w:footer="567" w:gutter="0"/>' +
    "</w:sectPr>";

  return parts.join("") + sectPr;
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  "</Types>";

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const DOC_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  "<w:docDefaults><w:rPrDefault><w:rPr>" +
  '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' +
  '<w:sz w:val="20"/><w:szCs w:val="20"/>' +
  "</w:rPr></w:rPrDefault>" +
  '<w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
  "</w:docDefaults>" +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
  '<w:name w:val="Normal"/><w:qFormat/></w:style>' +
  "</w:styles>";

/** Bangun berkas .docx dari data ekspor. */
export function buildDocx(data: ExportDataset): Blob {
  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${buildBody(data)}</w:body>` +
    "</w:document>";

  const entries: ZipEntry[] = [
    { path: "[Content_Types].xml", content: CONTENT_TYPES },
    { path: "_rels/.rels", content: ROOT_RELS },
    { path: "word/document.xml", content: document },
    { path: "word/_rels/document.xml.rels", content: DOC_RELS },
    { path: "word/styles.xml", content: STYLES },
  ];
  return createZip(entries, MIME.docx, data.generatedAt);
}
