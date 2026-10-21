import type { Font, PathCommand } from 'opentype.js';

type Vec2 = [number, number];
/** Bézier flattening steps per curve — same as the reference. */
const CURVE_STEPS = 8;

const cubic = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};
const quadratic = (a: number, b: number, c: number, t: number) => {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
};

/**
 * Glyph outlines in mm (font size = mm), y flipped to point up. Rings are returned as-is; the caller
 * builds a CrossSection with the EvenOdd fill rule so counters (o, a, e…) stay open.
 * Per-character glyphs, no kerning — matches the reference.
 */
export function textToPolygons(font: Font, text: string, fontSize: number): Vec2[][] {
  const rings: Vec2[][] = [];
  const flip = (y: number) => -y;
  const unitScale = fontSize / (font.unitsPerEm || 1000);
  let cursor = 0;
  for (const char of text) {
    const glyph = font.charToGlyph(char);
    const path = glyph.getPath(cursor, 0, fontSize);
    let ring: Vec2[] = [];
    let x = 0, y = 0, startX = 0, startY = 0;
    const close = () => { if (ring.length >= 3) rings.push(ring); ring = []; };
    for (const command of path.commands as PathCommand[]) {
      if (command.type === 'M') {
        close(); x = command.x; y = command.y; startX = x; startY = y; ring.push([x, flip(y)]);
      } else if (command.type === 'L') {
        x = command.x; y = command.y; ring.push([x, flip(y)]);
      } else if (command.type === 'C') {
        for (let i = 1; i <= CURVE_STEPS; i++) {
          const t = i / CURVE_STEPS;
          ring.push([cubic(x, command.x1, command.x2, command.x, t), flip(cubic(y, command.y1, command.y2, command.y, t))]);
        }
        x = command.x; y = command.y;
      } else if (command.type === 'Q') {
        for (let i = 1; i <= CURVE_STEPS; i++) {
          const t = i / CURVE_STEPS;
          ring.push([quadratic(x, command.x1, command.x, t), flip(quadratic(y, command.y1, command.y, t))]);
        }
        x = command.x; y = command.y;
      } else if (command.type === 'Z') {
        close(); x = startX; y = startY;
      }
    }
    close();
    cursor += (glyph.advanceWidth || 0) * unitScale;
  }
  return rings;
}
