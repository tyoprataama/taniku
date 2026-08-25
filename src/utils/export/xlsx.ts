// =====================================================
// Generator Excel (.xlsx) asli — TANPA library eksternal.
//
// Menulis paket OOXML SpreadsheetML (beberapa XML di dalam arsip ZIP) sehingga
// ekstensi .xlsx cocok dengan isi berkasnya; Excel tidak lagi menampilkan
// peringatan "file format and extension don't match".
//
// Tata letak: SATU sheet saja, data dipisah per periode lalu per lahan.
// Kolom "Musim"/"Lahan" tidak diulang tiap baris — cukup ditegaskan pada baris
// judul kelompoknya. Tiap lahan ditutup subtotal, tiap periode ditutup total,
// dan di paling bawah ada total keseluruhan.
// =====================================================
import { createZip, MIME, xmlEsc, type ZipEntry } from "./zip";
import { dmy, stamp, type ExportDataset, type ExportTotals } from "./dataset";

// ---------- Indeks gaya (harus sama dengan urutan cellXfs di styles.xml) ----------
const S = {
  default: 0,
  title: 1,
  subtitle: 2,
  metaLabel: 3,
  metaValue: 4,
  periodBar: 5,
  fieldBar: 6,
  colHeader: 7,
  text: 8,
  textWrap: 9,
  date: 10,
  money: 11,
  subtotalLabel: 12,
  subtotalMoney: 13,
  totalLabel: 14,
  totalMoney: 15,
  kpiLabel: 16,
  kpiMoney: 17,
  kpiPct: 18,
  note: 19,
};

const COLUMN_COUNT = 5; // A..E
const colLetter = (index: number) => String.fromCharCode(65 + index);

type Cell =
  | { kind: "text"; value: string; style: number }
  | { kind: "number"; value: number; style: number }
  | { kind: "blank"; style: number };

const t = (value: string, style = S.text): Cell => ({
  kind: "text",
  value,
  style,
});
const n = (value: number, style = S.money): Cell => ({
  kind: "number",
  value,
  style,
});
const blank = (style: number): Cell => ({ kind: "blank", style });

/**
 * Baris berlatar penuh: teks hanya di kolom pertama, tetapi seluruh kolom
 * diberi gaya yang sama supaya warnanya menyambung selebar tabel (tanpa perlu
 * menggabungkan sel).
 */
const bandRow = (label: string, style: number): Cell[] => [
  t(label, style),
  ...Array.from({ length: COLUMN_COUNT - 1 }, () => blank(style)),
];

const cellXml = (ref: string, cell: Cell): string => {
  if (cell.kind === "blank") return `<c r="${ref}" s="${cell.style}"/>`;
  if (cell.kind === "number") {
    return `<c r="${ref}" s="${cell.style}"><v>${cell.value}</v></c>`;
  }
  return (
    `<c r="${ref}" s="${cell.style}" t="inlineStr">` +
    `<is><t xml:space="preserve">${xmlEsc(cell.value)}</t></is></c>`
  );
};

const rowXml = (rowNumber: number, cells: Cell[]): string => {
  if (cells.length === 0) return `<row r="${rowNumber}"/>`;
  const body = cells
    .map((cell, i) => cellXml(`${colLetter(i)}${rowNumber}`, cell))
    .join("");
  return `<row r="${rowNumber}">${body}</row>`;
};

/** Ringkasan total dalam tiga baris label + nominal. */
function totalsRows(
  totals: ExportTotals,
  labelPrefix: string,
  labelStyle: number,
  moneyStyle: number,
): Cell[][] {
  const line = (label: string, value: number): Cell[] => [
    t(label, labelStyle),
    blank(labelStyle),
    blank(labelStyle),
    blank(labelStyle),
    n(value, moneyStyle),
  ];
  return [
    line(`${labelPrefix} \u2014 Total Pendapatan`, totals.revenue),
    line(`${labelPrefix} \u2014 Total Pengeluaran`, totals.expense),
    line(
      `${labelPrefix} \u2014 ${totals.profit < 0 ? "Rugi" : "Untung"} (${
        totals.count
      } transaksi)`,
      totals.profit,
    ),
  ];
}

function buildSheet(data: ExportDataset): string {
  const rows: Cell[][] = [];

  // --- Kop laporan ---
  rows.push(bandRow("Laporan Keuangan Lahan \u2014 Taniku", S.title));
  rows.push([
    t("Rekap pendapatan & pengeluaran per periode dan per lahan", S.subtitle),
  ]);
  rows.push([]);
  rows.push([
    t("Dibuat pada", S.metaLabel),
    t(stamp(data.generatedAt), S.metaValue),
  ]);
  rows.push([t("Periode", S.metaLabel), t(data.periodLabel, S.metaValue)]);
  rows.push([t("Lahan", S.metaLabel), t(data.fieldLabel, S.metaValue)]);
  rows.push([t("Jenis data", S.metaLabel), t(data.kindLabel, S.metaValue)]);
  rows.push([]);

  // --- Ikhtisar ---
  rows.push([t("Ikhtisar", S.kpiLabel)]);
  rows.push([
    t("Total Pendapatan", S.metaLabel),
    n(data.totals.revenue, S.kpiMoney),
  ]);
  rows.push([
    t("Total Pengeluaran", S.metaLabel),
    n(data.totals.expense, S.kpiMoney),
  ]);
  rows.push([
    t(data.totals.profit < 0 ? "Rugi" : "Untung", S.metaLabel),
    n(data.totals.profit, S.kpiMoney),
  ]);
  rows.push([t("Margin", S.metaLabel), n(data.totals.margin, S.kpiPct)]);
  rows.push([t("ROI", S.metaLabel), n(data.totals.roi, S.kpiPct)]);
  rows.push([
    t("Jumlah transaksi", S.metaLabel),
    n(data.totals.count, S.default),
  ]);
  rows.push([]);

  if (data.periods.length === 0) {
    rows.push([t("Tidak ada transaksi pada cakupan yang dipilih.", S.note)]);
  }

  // --- Data utama: periode -> lahan ---
  for (const period of data.periods) {
    rows.push(bandRow(period.label.toUpperCase(), S.periodBar));

    for (const group of period.fieldGroups) {
      const seasonNote = group.seasonLabels.length
        ? ` \u2014 ${group.seasonLabels.join(", ")}`
        : "";
      rows.push(bandRow(`${group.fieldName}${seasonNote}`, S.fieldBar));
      rows.push([
        t("Tanggal", S.colHeader),
        t("Jenis", S.colHeader),
        t("Kategori / Produk", S.colHeader),
        t("Keterangan", S.colHeader),
        t("Nominal", S.colHeader),
      ]);

      for (const row of group.rows) {
        rows.push([
          t(dmy(row.date), S.date),
          t(row.typeLabel, S.text),
          t(row.category, S.text),
          t(row.description, S.textWrap),
          n(row.amount, S.money),
        ]);
      }

      for (const line of totalsRows(
        group.totals,
        group.fieldName,
        S.subtotalLabel,
        S.subtotalMoney,
      )) {
        rows.push(line);
      }
      rows.push([]);
    }

    for (const line of totalsRows(
      period.totals,
      period.label.toUpperCase(),
      S.totalLabel,
      S.totalMoney,
    )) {
      rows.push(line);
    }
    rows.push([]);
  }

  // --- Total keseluruhan ---
  rows.push(bandRow(`TOTAL KESELURUHAN \u2014 ${data.periodLabel}`, S.periodBar));
  for (const line of totalsRows(
    data.totals,
    "Keseluruhan",
    S.totalLabel,
    S.totalMoney,
  )) {
    rows.push(line);
  }
  rows.push([
    t("Keseluruhan \u2014 ROI", S.totalLabel),
    blank(S.totalLabel),
    blank(S.totalLabel),
    blank(S.totalLabel),
    n(data.totals.roi, S.kpiPct),
  ]);
  rows.push([]);
  rows.push([
    t(
      `Dokumen dibuat otomatis oleh Taniku pada ${stamp(data.generatedAt)}.`,
      S.note,
    ),
  ]);

  const sheetData = rows
    .map((cells, index) => rowXml(index + 1, cells))
    .join("");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    "<cols>" +
    '<col min="1" max="1" width="13" customWidth="1"/>' +
    '<col min="2" max="2" width="14" customWidth="1"/>' +
    '<col min="3" max="3" width="20" customWidth="1"/>' +
    '<col min="4" max="4" width="52" customWidth="1"/>' +
    '<col min="5" max="5" width="18" customWidth="1"/>' +
    "</cols>" +
    `<sheetData>${sheetData}</sheetData>` +
    "</worksheet>"
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  // 164 = Rupiah, 165 = persen satu desimal
  '<numFmts count="2">' +
  '<numFmt numFmtId="164" formatCode="&quot;Rp&quot;\\ #,##0;[Red]\\-&quot;Rp&quot;\\ #,##0"/>' +
  '<numFmt numFmtId="165" formatCode="0.0&quot;%&quot;"/>' +
  "</numFmts>" +
  '<fonts count="7">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><sz val="10"/><color rgb="FF5B6675"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="12"/><color rgb="FF214E8A"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FF214E8A"/><name val="Calibri"/></font>' +
  "</fonts>" +
  '<fills count="7">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF214E8A"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF3263A6"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF5181C0"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF3FB"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFD6E3F4"/><bgColor indexed="64"/></patternFill></fill>' +
  "</fills>" +
  '<borders count="2">' +
  "<border><left/><right/><top/><bottom/><diagonal/></border>" +
  '<border><left style="thin"><color rgb="FFAEC6E8"/></left>' +
  '<right style="thin"><color rgb="FFAEC6E8"/></right>' +
  '<top style="thin"><color rgb="FFAEC6E8"/></top>' +
  '<bottom style="thin"><color rgb="FFAEC6E8"/></bottom><diagonal/></border>' +
  "</borders>" +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="20">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="164" fontId="1" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="164" fontId="3" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="6" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="165" fontId="6" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  "</Types>";

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  "</Relationships>";

const WORKBOOK_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";

const WORKBOOK =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="Laporan Keuangan" sheetId="1" r:id="rId1"/></sheets>' +
  "</workbook>";

/** Bangun berkas .xlsx (satu sheet) dari data ekspor. */
export function buildXlsx(data: ExportDataset): Blob {
  const entries: ZipEntry[] = [
    { path: "[Content_Types].xml", content: CONTENT_TYPES },
    { path: "_rels/.rels", content: ROOT_RELS },
    { path: "xl/workbook.xml", content: WORKBOOK },
    { path: "xl/_rels/workbook.xml.rels", content: WORKBOOK_RELS },
    { path: "xl/styles.xml", content: STYLES_XML },
    { path: "xl/worksheets/sheet1.xml", content: buildSheet(data) },
  ];
  return createZip(entries, MIME.xlsx, data.generatedAt);
}
