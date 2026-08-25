// =====================================================
// Generator PDF minimalis — TANPA library eksternal.
//
// Menulis berkas PDF 1.4 secara langsung (objek, stream teks, xref) memakai
// font bawaan Helvetica & Helvetica-Bold dengan WinAnsiEncoding. Hasilnya
// PDF asli (bukan trik window.print), berorientasi PORTRAIT A4, bertema biru
// mengikuti warna web, tabel rapi, dan footer bernomor + timestamp.
//
// Header tabel TIDAK diulang saat tabel berlanjut ke halaman berikutnya;
// header hanya dicetak sekali di awal tiap lahan (lihat opsi repeatHeader).
// =====================================================

const PAGE_W = 595; // A4 portrait (pt)
const PAGE_H = 842;
const MARGIN = 36;
const BOTTOM = 46;

/** Warna: angka = abu-abu (0 hitam .. 1 putih), atau triplet [r, g, b]. */
export type Paint = number | [number, number, number];

const toRgb = (paint: Paint): [number, number, number] =>
  typeof paint === "number" ? [paint, paint, paint] : paint;

const paintOp = (paint: Paint, stroke = false): string => {
  const [r, g, b] = toRgb(paint);
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${
    stroke ? "RG" : "rg"
  }\n`;
};

// Palet tema "tulus" (biru) yang dipakai di web.
export const BLUE_DARK: Paint = [0.129, 0.306, 0.541]; // #214E8A
export const BLUE: Paint = [0.196, 0.388, 0.651]; // #3263A6
export const BLUE_MID: Paint = [0.318, 0.506, 0.753]; // #5181C0
export const BLUE_TINT: Paint = [0.839, 0.89, 0.957]; // #D6E3F4
export const BLUE_SOFT: Paint = [0.933, 0.953, 0.984]; // #EEF3FB
export const WHITE: Paint = 1;
export const GREEN: Paint = [0.075, 0.541, 0.353];
export const RED: Paint = [0.788, 0.204, 0.169];

export type Align = "left" | "right";
export type PdfColumn = { header: string; width: number; align?: Align };

export type PdfBlock =
  | { kind: "title"; text: string; subtitle?: string }
  | { kind: "meta"; items: Array<[string, string]> }
  | { kind: "heading"; text: string }
  /** Judul kelompok berlatar biru: level 1 = periode, level 2 = lahan. */
  | { kind: "bar"; text: string; note?: string; level: 1 | 2 }
  | { kind: "paragraph"; text: string }
  /** Paksa pindah ke lembar baru (dipakai agar tiap lahan mulai di halaman baru). */
  | { kind: "pageBreak" }
  | {
      kind: "table";
      columns: PdfColumn[];
      rows: string[][];
      /** Baris total (dicetak tebal di bawah tabel). */
      totalRow?: string[];
      /**
       * Ulangi header tabel di halaman lanjutan? Default false, sesuai
       * permintaan: header cukup sekali di awal tiap lahan.
       */
      repeatHeader?: boolean;
    }
  | { kind: "kv"; items: Array<[string, string]> }
  | { kind: "space"; height: number };

// ---------- Lebar karakter Helvetica (unit/1000) ----------
const W_REG: Record<string, number> = {};
const W_BOLD: Record<string, number> = {};

const fill = (
  target: Record<string, number>,
  chars: string,
  width: number,
) => {
  for (const c of chars) target[c] = width;
};

// Helvetica regular
fill(W_REG, " ", 278);
fill(W_REG, "!", 278);
fill(W_REG, '"', 355);
fill(W_REG, "#$", 556);
fill(W_REG, "%", 889);
fill(W_REG, "&", 667);
fill(W_REG, "'", 191);
fill(W_REG, "()", 333);
fill(W_REG, "*", 389);
fill(W_REG, "+", 584);
fill(W_REG, ",.", 278);
fill(W_REG, "-", 333);
fill(W_REG, "/", 278);
fill(W_REG, "0123456789", 556);
fill(W_REG, ":;", 278);
fill(W_REG, "<=>", 584);
fill(W_REG, "?", 556);
fill(W_REG, "@", 1015);
fill(W_REG, "ABDEHKPRXY", 667);
fill(W_REG, "CGOQ", 778);
fill(W_REG, "C", 722);
fill(W_REG, "DHNRUV", 722);
fill(W_REG, "EF", 645);
fill(W_REG, "E", 667);
fill(W_REG, "F", 611);
fill(W_REG, "G", 778);
fill(W_REG, "I", 278);
fill(W_REG, "J", 500);
fill(W_REG, "L", 556);
fill(W_REG, "M", 833);
fill(W_REG, "S", 667);
fill(W_REG, "TZ", 611);
fill(W_REG, "V", 667);
fill(W_REG, "W", 944);
fill(W_REG, "[]", 278);
fill(W_REG, "\\", 278);
fill(W_REG, "^", 469);
fill(W_REG, "_", 556);
fill(W_REG, "`", 333);
fill(W_REG, "abdeghnopqu", 556);
fill(W_REG, "c", 500);
fill(W_REG, "ft", 278);
fill(W_REG, "ij", 222);
fill(W_REG, "kvxyz", 500);
fill(W_REG, "l", 222);
fill(W_REG, "m", 833);
fill(W_REG, "r", 333);
fill(W_REG, "s", 500);
fill(W_REG, "w", 722);
fill(W_REG, "{}", 334);
fill(W_REG, "|", 260);
fill(W_REG, "~", 584);

// Helvetica-Bold
fill(W_BOLD, " ", 278);
fill(W_BOLD, "!", 333);
fill(W_BOLD, '"', 474);
fill(W_BOLD, "#$", 556);
fill(W_BOLD, "%", 889);
fill(W_BOLD, "&", 722);
fill(W_BOLD, "'", 238);
fill(W_BOLD, "()", 333);
fill(W_BOLD, "*", 389);
fill(W_BOLD, "+", 584);
fill(W_BOLD, ",.", 278);
fill(W_BOLD, "-", 333);
fill(W_BOLD, "/", 278);
fill(W_BOLD, "0123456789", 556);
fill(W_BOLD, ":;", 333);
fill(W_BOLD, "<=>", 584);
fill(W_BOLD, "?", 611);
fill(W_BOLD, "@", 975);
fill(W_BOLD, "ABCDGKNOQRUVXY", 722);
fill(W_BOLD, "EL", 611);
fill(W_BOLD, "E", 667);
fill(W_BOLD, "F", 611);
fill(W_BOLD, "GO", 778);
fill(W_BOLD, "HKNRUVXY", 722);
fill(W_BOLD, "I", 278);
fill(W_BOLD, "JS", 556);
fill(W_BOLD, "S", 667);
fill(W_BOLD, "M", 833);
fill(W_BOLD, "PE", 667);
fill(W_BOLD, "TZ", 611);
fill(W_BOLD, "W", 944);
fill(W_BOLD, "[]{}", 389);
fill(W_BOLD, "[]", 333);
fill(W_BOLD, "\\", 278);
fill(W_BOLD, "^", 584);
fill(W_BOLD, "_", 556);
fill(W_BOLD, "`", 333);
fill(W_BOLD, "acs", 556);
fill(W_BOLD, "bdghnopqu", 611);
fill(W_BOLD, "ef", 556);
fill(W_BOLD, "f", 333);
fill(W_BOLD, "ij", 278);
fill(W_BOLD, "kvxy", 556);
fill(W_BOLD, "l", 278);
fill(W_BOLD, "m", 889);
fill(W_BOLD, "r", 389);
fill(W_BOLD, "t", 333);
fill(W_BOLD, "w", 778);
fill(W_BOLD, "z", 500);
fill(W_BOLD, "|", 280);
fill(W_BOLD, "~", 584);

// Peta karakter Unicode → WinAnsi (agar tanda seperti · dan – tetap tampil).
const WINANSI_MAP: Record<string, number> = {
  "\u2013": 0x96,
  "\u2014": 0x97,
  "\u2022": 0x95,
  "\u00b7": 0xb7,
  "\u00d7": 0xd7,
  "\u2018": 0x91,
  "\u2019": 0x92,
  "\u201c": 0x93,
  "\u201d": 0x94,
  "\u2026": 0x85,
  "\u00a0": 0xa0,
  "\u00b2": 0xb2,
  "\u20ac": 0x80,
};

const charWidth = (ch: string, bold: boolean): number => {
  const table = bold ? W_BOLD : W_REG;
  const w = table[ch];
  if (w !== undefined) return w;
  // Karakter non-ASCII: pakai perkiraan yang aman.
  return ch === "\u00a0" ? 278 : 556;
};

const widthOf = (text: string, size: number, bold: boolean): number => {
  let total = 0;
  for (const ch of text) total += charWidth(ch, bold);
  return (total * size) / 1000;
};

/** Pangkas teks agar pas dalam lebar kolom. */
const clip = (
  text: string,
  maxWidth: number,
  size: number,
  bold: boolean,
): string => {
  if (widthOf(text, size, bold) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && widthOf(out + "..", size, bold) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "..";
};

/** Escape string PDF; karakter non-ASCII ditulis sebagai escape oktal. */
const esc = (text: string): string => {
  let out = "";
  for (const ch of text) {
    if (ch === "\\") {
      out += "\\\\";
      continue;
    }
    if (ch === "(" || ch === ")") {
      out += "\\" + ch;
      continue;
    }
    const code = ch.codePointAt(0) ?? 63;
    if (code >= 32 && code <= 126) {
      out += ch;
      continue;
    }
    const mapped = WINANSI_MAP[ch] ?? (code < 256 ? code : 63);
    out += "\\" + mapped.toString(8).padStart(3, "0");
  }
  return out;
};

// ---------- Mesin tata letak ----------
class PdfDoc {
  private pages: string[][] = [];
  private ops: string[] = [];
  private y = PAGE_H - MARGIN;
  private runningHeader = "";
  private footerNote = "";

  constructor(runningHeader: string, footerNote: string) {
    this.runningHeader = runningHeader;
    this.footerNote = footerNote;
  }

  private text(
    x: number,
    y: number,
    size: number,
    bold: boolean,
    value: string,
    paint: Paint = 0,
  ) {
    const font = bold ? "/F2" : "/F1";
    this.ops.push(
      `q\n${paintOp(paint)}BT\n${font} ${size} Tf\n1 0 0 1 ${x.toFixed(
        2,
      )} ${y.toFixed(2)} Tm\n(${esc(value)}) Tj\nET\nQ`,
    );
  }

  private rect(x: number, y: number, w: number, h: number, paint: Paint) {
    this.ops.push(
      `q\n${paintOp(paint)}${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(
        2,
      )} ${h.toFixed(2)} re\nf\nQ`,
    );
  }

  private hline(x1: number, x2: number, y: number, paint: Paint = BLUE_TINT) {
    this.ops.push(
      `q\n${paintOp(paint, true)}0.6 w\n${x1.toFixed(2)} ${y.toFixed(
        2,
      )} m\n${x2.toFixed(2)} ${y.toFixed(2)} l\nS\nQ`,
    );
  }

  /**
   * Apakah halaman aktif sudah memuat konten (selain header berjalan)?
   * Dipakai agar "pageBreak" tidak menghasilkan halaman kosong.
   */
  private dirty = false;

  private startPage() {
    this.ops = [];
    this.y = PAGE_H - MARGIN;
    if (this.pages.length > 0) {
      // Header berjalan pada halaman lanjutan.
      this.text(MARGIN, this.y - 8, 8.5, false, this.runningHeader, BLUE);
      this.hline(MARGIN, PAGE_W - MARGIN, this.y - 14, BLUE_TINT);
      this.y -= 28;
    }
    this.dirty = false;
  }

  private endPage() {
    this.pages.push(this.ops);
    this.ops = [];
  }

  private ensure(height: number) {
    if (this.y - height < BOTTOM) {
      this.endPage();
      this.startPage();
      return true;
    }
    return false;
  }

  render(blocks: PdfBlock[]) {
    this.startPage();
    for (const block of blocks) this.renderBlock(block);
    this.endPage();
    this.stampFooters();
    return this.build();
  }

  private renderBlock(block: PdfBlock) {
    const right = PAGE_W - MARGIN;
    if (block.kind !== "pageBreak") this.dirty = true;
    switch (block.kind) {
      // Mulai lembar baru; diabaikan bila halaman aktif masih kosong.
      case "pageBreak": {
        if (this.dirty) {
          this.endPage();
          this.startPage();
        }
        break;
      }
      case "title": {
        const bandH = block.subtitle ? 50 : 36;
        this.ensure(bandH + 16);
        this.rect(MARGIN, this.y - bandH, right - MARGIN, bandH, BLUE_DARK);
        this.text(MARGIN + 12, this.y - 23, 15.5, true, block.text, WHITE);
        if (block.subtitle) {
          this.text(
            MARGIN + 12,
            this.y - 39,
            9.5,
            false,
            clip(block.subtitle, right - MARGIN - 24, 9.5, false),
            BLUE_TINT,
          );
        }
        this.y -= bandH + 14;
        break;
      }
      case "meta": {
        for (const [label, value] of block.items) {
          this.ensure(14);
          this.text(MARGIN, this.y - 9, 9, true, `${label}:`, BLUE);
          this.text(
            MARGIN + 96,
            this.y - 9,
            9,
            false,
            clip(value, right - MARGIN - 96, 9, false),
          );
          this.y -= 13;
        }
        this.y -= 6;
        break;
      }
      case "heading": {
        this.ensure(32);
        this.y -= 6;
        this.text(MARGIN, this.y - 11, 11.5, true, block.text, BLUE_DARK);
        this.hline(MARGIN, right, this.y - 15, BLUE_TINT);
        this.y -= 20;
        break;
      }
      case "bar": {
        const barH = block.level === 1 ? 22 : 19;
        // Sertakan ruang untuk header + beberapa baris agar judul kelompok
        // tidak tertinggal sendirian di ujung halaman.
        this.ensure(barH + 46);
        this.rect(
          MARGIN,
          this.y - barH,
          right - MARGIN,
          barH,
          block.level === 1 ? BLUE_DARK : BLUE_MID,
        );
        const size = block.level === 1 ? 11 : 9.8;
        const noteW = block.note ? 200 : 0;
        this.text(
          MARGIN + 8,
          this.y - barH + 6.5,
          size,
          true,
          clip(block.text, right - MARGIN - 24 - noteW, size, true),
          WHITE,
        );
        if (block.note) {
          const note = clip(block.note, noteW - 12, 8.5, false);
          this.text(
            right - 8 - widthOf(note, 8.5, false),
            this.y - barH + 6.5,
            8.5,
            false,
            note,
            BLUE_TINT,
          );
        }
        this.y -= barH + 8;
        break;
      }
      case "paragraph": {
        this.ensure(16);
        this.text(
          MARGIN,
          this.y - 9,
          9,
          false,
          clip(block.text, right - MARGIN, 9, false),
          0.35,
        );
        this.y -= 15;
        break;
      }
      case "kv": {
        const colW = (right - MARGIN) / 2;
        for (let i = 0; i < block.items.length; i += 2) {
          this.ensure(18);
          const pair = block.items.slice(i, i + 2);
          pair.forEach(([label, value], idx) => {
            const x = MARGIN + idx * colW;
            this.rect(x, this.y - 15, colW - 8, 17, BLUE_SOFT);
            this.text(x + 6, this.y - 10, 8.5, false, label, BLUE);
            const vw = widthOf(value, 9.5, true);
            this.text(
              x + colW - 14 - vw,
              this.y - 10,
              9.5,
              true,
              value,
              BLUE_DARK,
            );
          });
          this.y -= 20;
        }
        this.y -= 4;
        break;
      }
      case "table": {
        this.renderTable(block);
        break;
      }
      case "space": {
        this.y -= block.height;
        break;
      }
    }
  }

  private tableHeader(columns: PdfColumn[]) {
    const size = 8.5;
    this.rect(MARGIN, this.y - 15, PAGE_W - 2 * MARGIN, 17, BLUE_MID);
    let x = MARGIN;
    for (const col of columns) {
      const label = clip(col.header, col.width - 8, size, true);
      if (col.align === "right") {
        this.text(
          x + col.width - 6 - widthOf(label, size, true),
          this.y - 10,
          size,
          true,
          label,
          WHITE,
        );
      } else {
        this.text(x + 5, this.y - 10, size, true, label, WHITE);
      }
      x += col.width;
    }
    this.y -= 20;
  }

  private renderTable(block: {
    columns: PdfColumn[];
    rows: string[][];
    totalRow?: string[];
    repeatHeader?: boolean;
  }) {
    const size = 8.2;
    this.ensure(52);
    this.tableHeader(block.columns);

    block.rows.forEach((row, index) => {
      // Header hanya diulang bila diminta secara eksplisit.
      if (this.ensure(16) && block.repeatHeader) {
        this.tableHeader(block.columns);
      }
      if (index % 2 === 1) {
        this.rect(MARGIN, this.y - 12, PAGE_W - 2 * MARGIN, 15, BLUE_SOFT);
      }
      let x = MARGIN;
      block.columns.forEach((col, ci) => {
        const raw = row[ci] ?? "";
        const value = clip(raw, col.width - 10, size, false);
        if (col.align === "right") {
          this.text(
            x + col.width - 6 - widthOf(value, size, false),
            this.y - 8,
            size,
            false,
            value,
          );
        } else {
          this.text(x + 5, this.y - 8, size, false, value);
        }
        x += col.width;
      });
      this.y -= 15;
    });

    if (block.totalRow) {
      if (this.ensure(22) && block.repeatHeader) {
        this.tableHeader(block.columns);
      }
      this.rect(MARGIN, this.y - 14, PAGE_W - 2 * MARGIN, 17, BLUE_TINT);
      // Label subtotal digabung melintasi kolom kosong di sebelahnya, supaya
      // nama lahan yang panjang tidak terpotong (mis. "Subtotal La..").
      let x = MARGIN;
      let ci = 0;
      while (ci < block.columns.length) {
        const col = block.columns[ci];
        const raw = block.totalRow?.[ci] ?? "";
        let span = 1;
        let spanWidth = col.width;
        if (raw) {
          while (
            ci + span < block.columns.length &&
            !(block.totalRow?.[ci + span] ?? "")
          ) {
            spanWidth += block.columns[ci + span].width;
            span += 1;
          }
        }
        const value = clip(raw, spanWidth - 10, size + 0.3, true);
        if (col.align === "right") {
          this.text(
            x + spanWidth - 6 - widthOf(value, size + 0.3, true),
            this.y - 9,
            size + 0.3,
            true,
            value,
            BLUE_DARK,
          );
        } else {
          this.text(x + 5, this.y - 9, size + 0.3, true, value, BLUE_DARK);
        }
        x += spanWidth;
        ci += span;
      }
      this.y -= 20;
    }
    this.y -= 6;
  }

  /** Tambahkan footer (timestamp + nomor halaman) setelah jumlah halaman diketahui. */
  private stampFooters() {
    const total = this.pages.length;
    this.pages = this.pages.map((ops, i) => {
      const saveOps = this.ops;
      this.ops = [];
      this.hline(MARGIN, PAGE_W - MARGIN, BOTTOM + 12, BLUE_TINT);
      this.text(MARGIN, BOTTOM - 2, 8, false, this.footerNote, BLUE);
      const label = `Halaman ${i + 1} dari ${total}`;
      this.text(
        PAGE_W - MARGIN - widthOf(label, 8, false),
        BOTTOM - 2,
        8,
        false,
        label,
        BLUE,
      );
      const footer = this.ops;
      this.ops = saveOps;
      return [...ops, ...footer];
    });
  }

  private build(): Blob {
    const objects: string[] = [];
    const pageCount = this.pages.length;
    // 1 catalog, 2 pages, 3 font reguler, 4 font bold,
    // lalu tiap halaman: objek halaman + objek stream.
    const firstPageObj = 5;
    const kids: string[] = [];
    for (let i = 0; i < pageCount; i++) {
      kids.push(`${firstPageObj + i * 2} 0 R`);
    }

    objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
    objects[2] =
      `<< /Type /Pages /Count ${pageCount} /Kids [${kids.join(" ")}] >>`;
    objects[3] =
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
    objects[4] =
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

    this.pages.forEach((ops, i) => {
      const pageObj = firstPageObj + i * 2;
      const streamObj = pageObj + 1;
      objects[pageObj] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamObj} 0 R >>`;
      const content = ops.join("\n");
      objects[streamObj] =
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    });

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (let i = 1; i < objects.length; i++) {
      offsets[i] = pdf.length;
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefStart = pdf.length;
    const count = objects.length; // termasuk entri bebas ke-0
    pdf += `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let i = 1; i < objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    pdf +=
      `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    // Seluruh isi PDF sengaja dibuat ASCII (karakter khusus memakai escape
    // oktal) sehingga panjang string == panjang byte dan tabel xref valid.
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: "application/pdf" });
  }
}

export function renderPdf(
  blocks: PdfBlock[],
  runningHeader: string,
  footerNote: string,
): Blob {
  return new PdfDoc(runningHeader, footerNote).render(blocks);
}
