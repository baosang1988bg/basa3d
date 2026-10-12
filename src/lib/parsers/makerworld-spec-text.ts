// Fallback "Dán đoạn thông số" parser (makerworld-profile-verification plan §4.3).
// When MakerWorld blocks the server-side resolver (Cloudflare 403), staff select the profile's spec
// block on MakerWorld in their own browser, paste it here, and this pure function pre-fills the
// Quick-Form. No network, no DOM — safe to run client-side and trivially unit-testable.
//
// It is deliberately forgiving and NEVER authoritative: every field may come back null, and the
// Quick-Form always shows the parsed values for staff to confirm/edit before pricing.

export type MakerWorldSpecTextResult = {
  profileTitle: string | null;
  printMinutes: number | null;
  platesCount: number | null;
  netWeightGrams: number | null;
  /** false = "No AMS" found, true = "AMS" found (without "no"), null = not mentioned. */
  amsRequired: boolean | null;
  printerTarget: string | null;
};

const MAX_INPUT_LENGTH = 5_000;

function toNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function parsePrintMinutes(text: string): number | null {
  // "7h30m", "7 h 30 min", "7.5 h", "7,5 giờ", "7 hours 30 minutes", "7h30"
  // Minutes after the hours need an explicit unit ("7 h 30 min") unless glued on ("7h30") — otherwise
  // "7.5 h 6 plates" would wrongly read the plate count as 6 minutes.
  const hoursMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours|giờ)(?![a-z])(?:\s*(\d{1,2})\s*(?:m|min|mins|minute|minutes|phút)(?![a-z])|(\d{2})(?![\d.,]|\s*[a-z]))?/i);
  if (hoursMatch) {
    const hours = toNumber(hoursMatch[1]);
    const minutesRaw = hoursMatch[2] ?? hoursMatch[3];
    const minutes = minutesRaw ? Number(minutesRaw) : 0;
    if (Number.isFinite(hours) && minutes < 60) return Math.round(hours * 60 + minutes);
  }
  // "450 min" / "450 phút" on its own
  const minutesMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m|min|mins|minute|minutes|phút)(?![a-z])/i);
  if (minutesMatch) {
    const minutes = toNumber(minutesMatch[1]);
    if (Number.isFinite(minutes)) return Math.round(minutes);
  }
  return null;
}

function parsePlates(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:plates?|bàn in|plate)(?![a-z])/i);
  return match ? Number(match[1]) : null;
}

function parseGrams(text: string): number | null {
  const kg = text.match(/(\d+(?:[.,]\d+)?)\s*kg(?![a-z])/i);
  if (kg) {
    const value = toNumber(kg[1]) * 1000;
    if (Number.isFinite(value)) return Math.round(value * 100) / 100;
  }
  // `(?<![\d.])` avoids matching the tail of "0.2"; `g(?![a-z])` avoids "gram"-less words like "glue".
  const g = text.match(/(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(?:g|gram|grams)(?![a-z])/i);
  if (g) {
    const value = toNumber(g[1]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function parseAms(text: string): boolean | null {
  if (/\bno[\s_-]*ams\b|\bnon[\s_-]*ams\b|\bwithout\s+ams\b|không\s+(?:cần\s+)?ams\b/i.test(text)) return false;
  if (/\bams\b/i.test(text)) return true;
  return null;
}

const PRINTER_RE = /\b(P1S|P1P|P2S|X1C|X1E|X1|A1\s?mini|A1|H2D|H2S)\b/gi;

function parsePrinters(text: string): string | null {
  const found = new Set<string>();
  for (const match of text.matchAll(PRINTER_RE)) found.add(match[1].toUpperCase().replace(/\s+/g, ' ').replace('MINI', 'mini'));
  return found.size ? [...found].join('/') : null;
}

function parseProfileTitle(text: string): string | null {
  // Bambu Studio profile names usually start with the layer height: "0.2mm layer, 2 walls, 15% infill".
  const match = text.match(/(\d+(?:\.\d+)?\s*mm\s+layer[^\n\r]*)/i);
  if (!match) return null;
  // Stop before trailing stats that might follow on the same line.
  const title = match[1].split(/\s{2,}|\s[·|•]\s/)[0].trim();
  return title ? title.slice(0, 300) : null;
}

export function parseMakerWorldSpecText(input: string): MakerWorldSpecTextResult {
  const text = (input ?? '').slice(0, MAX_INPUT_LENGTH);
  return {
    profileTitle: parseProfileTitle(text),
    printMinutes: parsePrintMinutes(text),
    platesCount: parsePlates(text),
    netWeightGrams: parseGrams(text),
    amsRequired: parseAms(text),
    printerTarget: parsePrinters(text),
  };
}
