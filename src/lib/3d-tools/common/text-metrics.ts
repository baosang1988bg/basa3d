/**
 * Shared text checks for tools that emboss a user-typed name (phase 47 I-8: the reference silently
 * dropped blank names and exported missing glyphs). Pure module: no DOM, works with any opentype.js
 * Font through the two methods below.
 */
export type GlyphFont = {
  charToGlyphIndex(char: string): number;
  getAdvanceWidth(text: string, fontSize: number, options?: { kerning?: boolean }): number;
};

/** NFC, every whitespace run (incl. newline/tab) becomes one space, trimmed. */
export function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('vi', { granularity: 'grapheme' }) : null;

/** User-perceived characters: "ố" is 1 even if typed decomposed, 👨‍👩‍👧 is 1. */
export function graphemes(text: string): string[] {
  const nfc = text.normalize('NFC');
  return segmenter ? Array.from(segmenter.segment(nfc), s => s.segment) : Array.from(nfc);
}

export function graphemeCount(text: string): number {
  return graphemes(text).length;
}

// Joiners and presentation selectors carry no outline of their own.
const IGNORABLE = new Set([0x200c, 0x200d, 0xfe0e, 0xfe0f]);

/** Distinct graphemes the font cannot draw (any non-ignorable code point maps to .notdef). Spaces are skipped. */
export function findMissingGlyphs(font: Pick<GlyphFont, 'charToGlyphIndex'>, text: string): string[] {
  const missing = new Set<string>();
  for (const g of graphemes(text)) {
    if (/^\s+$/u.test(g)) continue;
    for (const char of g) {
      const cp = char.codePointAt(0)!;
      if (IGNORABLE.has(cp)) continue;
      if (font.charToGlyphIndex(char) <= 0) { missing.add(g); break; }
    }
  }
  return [...missing];
}

/** Advance width of the text in mm when the font is set at `sizeMm` (em height), kerning on. */
export function textWidthMm(font: Pick<GlyphFont, 'getAdvanceWidth'>, text: string, sizeMm: number): number {
  if (!(sizeMm > 0) || !Number.isFinite(sizeMm)) throw new RangeError('Cỡ chữ phải là số dương.');
  return font.getAdvanceWidth(text.normalize('NFC'), sizeMm, { kerning: true });
}

export function arcLengthMm(radiusMm: number, angleDeg: number): number {
  if (!(radiusMm > 0) || !Number.isFinite(radiusMm)) throw new RangeError('Bán kính phải là số dương.');
  if (!(angleDeg >= 0 && angleDeg <= 360)) throw new RangeError('Góc phải trong khoảng 0–360°.');
  return (radiusMm * angleDeg * Math.PI) / 180;
}

export type ArcFit = { widthMm: number; availableMm: number; usedAngleDeg: number; fits: boolean };

/**
 * Whether the text, laid along a circle of `radiusMm`, fits the free arc `availableAngleDeg`
 * (e.g. the wall between two features) leaving `marginMm` clear at each end.
 */
export function fitTextOnArc(font: Pick<GlyphFont, 'getAdvanceWidth'>, text: string, sizeMm: number, radiusMm: number, availableAngleDeg: number, marginMm = 0): ArcFit {
  if (!(marginMm >= 0)) throw new RangeError('Lề phải ≥ 0.');
  const widthMm = textWidthMm(font, text, sizeMm);
  const availableMm = Math.max(0, arcLengthMm(radiusMm, availableAngleDeg) - 2 * marginMm);
  return { widthMm, availableMm, usedAngleDeg: (widthMm / radiusMm) * (180 / Math.PI), fits: widthMm <= availableMm };
}
