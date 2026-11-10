/**
 * Minimal ZIP writer (deflate, no dependencies) for the brand downloads, run at build time.
 * Spec: PKWARE APPNOTE 6.3 — local headers, central directory, end of central directory.
 */
import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipEntry { name: string; data: Buffer }

// Fixed timestamp (2026-01-01 00:00) so builds are reproducible.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const fname = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const stored = packed.length >= data.length;
    const body = stored ? data : packed;
    const crc = crc32(data);
    const head = (sig: number, central: boolean): Buffer => {
      const b = Buffer.alloc(central ? 46 : 30);
      let o = 0;
      const u32 = (v: number) => { b.writeUInt32LE(v >>> 0, o); o += 4; };
      const u16 = (v: number) => { b.writeUInt16LE(v, o); o += 2; };
      u32(sig);
      if (central) u16(20); // version made by
      u16(20); u16(0x0800); // version needed, flags (UTF-8 names)
      u16(stored ? 0 : 8); u16(DOS_TIME); u16(DOS_DATE);
      u32(crc); u32(body.length); u32(data.length);
      u16(fname.length); u16(0); // extra
      if (central) { u16(0); u16(0); u16(0); u32(0); u32(offset); } // comment, disk, attrs, local offset
      return b;
    };
    const local = Buffer.concat([head(0x04034b50, false), fname, body]);
    centrals.push(Buffer.concat([head(0x02014b50, true), fname]));
    locals.push(local);
    offset += local.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}
