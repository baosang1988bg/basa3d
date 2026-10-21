// Static extraction of Tauri embedded assets from a thin arm64 Mach-O (reads bytes only, never executes).
// Usage: node tauri-extract.mjs <thin-macho> <outDir>
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';

const [file, out] = process.argv.slice(2);
const buf = readFileSync(file);
if (buf.readUInt32LE(0) !== 0xfeedfacf) throw new Error('not a thin 64-bit Mach-O');
const ncmds = buf.readUInt32LE(16);
const segs = [];
let off = 32;
for (let i = 0; i < ncmds; i++) {
  const cmd = buf.readUInt32LE(off), size = buf.readUInt32LE(off + 4);
  if (cmd === 0x19) { // LC_SEGMENT_64
    const name = buf.toString('latin1', off + 8, off + 24).replace(/\0.*$/, '');
    const vmaddr = Number(buf.readBigUInt64LE(off + 24)), vmsize = Number(buf.readBigUInt64LE(off + 32));
    const fileoff = Number(buf.readBigUInt64LE(off + 40)), filesize = Number(buf.readBigUInt64LE(off + 48));
    segs.push({ name, vmaddr, vmsize, fileoff, filesize });
  }
  off += size;
}
const text = segs.find((s) => s.name === '__TEXT');
const base = text.vmaddr;
const toFile = (vm) => { const s = segs.find((x) => vm >= x.vmaddr && vm < x.vmaddr + x.filesize); return s ? vm - s.vmaddr + s.fileoff : -1; };
const toVm = (fo) => { const s = segs.find((x) => fo >= x.fileoff && fo < x.fileoff + x.filesize); return s ? fo - s.fileoff + s.vmaddr : -1; };
// Decode a pointer slot: plain pointer, or a chained-fixup rebase (DYLD_CHAINED_PTR_64 / _OFFSET: low 36 bits target, high8 at 36..43).
const decode = (raw) => {
  if (raw >= base && raw < base + 0x40000000) return raw;
  const bind = Number((BigInt(raw) >> 63n) & 1n);
  if (bind) return -1;
  const target = Number(BigInt(raw) & 0xfffffffffn);
  const high8 = Number((BigInt(raw) >> 36n) & 0xffn);
  const full = (high8 * 2 ** 56) + target;
  if (full >= base && full < base + 0x40000000) return full; // PTR_64: vmaddr
  if (target + base < base + 0x40000000) return target + base; // PTR_64_OFFSET: offset from image base
  return -1;
};

// Collect candidate path strings (UTF-8, starting with "/") and their vmaddrs.
const paths = new Map();
const re = /\/(?:assets\/[A-Za-z0-9_.\-]+|index\.html|[A-Za-z0-9_\-]+\.(?:svg|png|ico|json|webmanifest|txt))/g;
const latin = buf.toString('latin1');
for (const m of latin.matchAll(re)) { const vm = toVm(m.index); if (vm > 0) paths.set(vm, m[0]); }

// Scan 8-byte aligned slots in data segments for (ptr,len,ptr,len) with the first ptr hitting a path and len matching.
const found = new Map();
for (const seg of segs.filter((s) => s.name.startsWith('__DATA'))) {
  for (let p = seg.fileoff; p + 32 <= seg.fileoff + seg.filesize; p += 8) {
    const a = decode(Number(buf.readBigUInt64LE(p)));
    if (a < 0) continue;
    const name = paths.get(a);
    if (!name) continue;
    // Rust &str may point mid-match; require the exact length.
    const len = Number(buf.readBigUInt64LE(p + 8));
    let key = name;
    if (len !== name.length) { if (len > 0 && len < name.length) key = name.slice(0, len); else continue; }
    const dptr = decode(Number(buf.readBigUInt64LE(p + 16)));
    const dlen = Number(buf.readBigUInt64LE(p + 24));
    if (dptr < 0 || dlen <= 0 || dlen > 64 * 1024 * 1024) continue;
    const fo = toFile(dptr);
    if (fo < 0) continue;
    const raw = buf.subarray(fo, fo + dlen);
    let data;
    try { data = brotliDecompressSync(raw); } catch { data = raw; }
    if (!found.has(key) || found.get(key).length < data.length) found.set(key, data);
  }
}
for (const [key, data] of found) {
  const target = join(out, key.replace(/^\//, ''));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
}
console.log(`paths=${paths.size} extracted=${found.size}`);
for (const [key, data] of [...found].sort()) if (/\.(js|html|css|json)$/.test(key)) console.log(key, data.length);
