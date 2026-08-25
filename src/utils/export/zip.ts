// =====================================================
// Penulis arsip ZIP sederhana (tanpa dependensi tambahan).
//
// Format .xlsx dan .docx sebenarnya adalah arsip ZIP berisi beberapa file XML
// (OOXML). Berkas ditulis apa adanya (metode "store", tanpa kompresi) supaya
// implementasinya ringkas namun tetap 100% valid dibuka Excel & Word.
// =====================================================

export type ZipEntry = {
  /** Path di dalam arsip, mis. "word/document.xml". */
  path: string;
  /** Isi berkas. String akan dikodekan sebagai UTF-8. */
  content: string;
};

// Tabel CRC-32 (polinomial standar ZIP), dihitung sekali saat modul dimuat.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Penulis byte little-endian yang tumbuh otomatis. */
class ByteWriter {
  private buf = new Uint8Array(1024);
  private len = 0;

  private ensure(extra: number) {
    if (this.len + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  get length() {
    return this.len;
  }

  u16(v: number) {
    this.ensure(2);
    this.buf[this.len++] = v & 0xff;
    this.buf[this.len++] = (v >>> 8) & 0xff;
  }

  u32(v: number) {
    this.ensure(4);
    this.buf[this.len++] = v & 0xff;
    this.buf[this.len++] = (v >>> 8) & 0xff;
    this.buf[this.len++] = (v >>> 16) & 0xff;
    this.buf[this.len++] = (v >>> 24) & 0xff;
  }

  bytes(data: Uint8Array) {
    this.ensure(data.length);
    this.buf.set(data, this.len);
    this.len += data.length;
  }

  result(): Uint8Array {
    return this.buf.subarray(0, this.len);
  }
}

/** Tanggal & waktu gaya MS-DOS untuk metadata arsip. */
function dosDateTime(d: Date): { time: number; date: number } {
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    (Math.floor(d.getSeconds() / 2) & 0x1f);
  const date =
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    (d.getDate() & 0x1f);
  return { time, date };
}

/**
 * Bungkus beberapa berkas XML menjadi satu Blob arsip ZIP.
 *
 * @param entries Daftar berkas di dalam arsip.
 * @param mimeType MIME type hasil, mis. MIME.xlsx / MIME.docx.
 * @param now Waktu yang dicatat pada tiap berkas di dalam arsip.
 */
export function createZip(
  entries: ZipEntry[],
  mimeType: string,
  now: Date = new Date(),
): Blob {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);

  const out = new ByteWriter();
  const central = new ByteWriter();
  let entryCount = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const dataBytes = encoder.encode(entry.content);
    const crc = crc32(dataBytes);
    const offset = out.length;

    // --- Local file header ---
    out.u32(0x04034b50);
    out.u16(20); // versi minimum
    out.u16(0x0800); // bendera: nama berkas UTF-8
    out.u16(0); // metode 0 = store
    out.u16(time);
    out.u16(date);
    out.u32(crc);
    out.u32(dataBytes.length);
    out.u32(dataBytes.length);
    out.u16(nameBytes.length);
    out.u16(0); // panjang extra field
    out.bytes(nameBytes);
    out.bytes(dataBytes);

    // --- Central directory record ---
    central.u32(0x02014b50);
    central.u16(20); // versi pembuat
    central.u16(20); // versi minimum
    central.u16(0x0800);
    central.u16(0);
    central.u16(time);
    central.u16(date);
    central.u32(crc);
    central.u32(dataBytes.length);
    central.u32(dataBytes.length);
    central.u16(nameBytes.length);
    central.u16(0); // extra
    central.u16(0); // komentar
    central.u16(0); // nomor disk
    central.u16(0); // atribut internal
    central.u32(0); // atribut eksternal
    central.u32(offset);
    central.bytes(nameBytes);

    entryCount++;
  }

  const centralOffset = out.length;
  const centralBytes = central.result();
  out.bytes(centralBytes);

  // --- End of central directory ---
  out.u32(0x06054b50);
  out.u16(0);
  out.u16(0);
  out.u16(entryCount);
  out.u16(entryCount);
  out.u32(centralBytes.length);
  out.u32(centralOffset);
  out.u16(0);

  // Salin ke buffer baru agar Blob tidak memegang subarray dari buffer besar.
  const final = new Uint8Array(out.result());
  return new Blob([final], { type: mimeType });
}

export const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Escape teks agar aman ditaruh di dalam XML. */
export const xmlEsc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Buang karakter kontrol yang dilarang di XML 1.0.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
