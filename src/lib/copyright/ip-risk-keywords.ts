// Phase 29 — heuristic, advisory-only flag (docs/exec-plans/active/phase-29-copyright-compliance.md
// decision #3): a custom request description that mentions a well-known third-party brand/character
// gets ip_risk_flag = true, which only surfaces a badge + a soft confirmation gate before a quote can
// be created (custom-request.service.ts / quote.service.ts). It never blocks or auto-rejects a
// request. Known limitation: this is a level-1 keyword filter — abbreviations/misspellings can slip
// through; staff review is still the real backstop.
const IP_RISK_KEYWORDS = [
  // Car brands (common request: license plate / logo keychains, nameplates)
  'mercedes', 'bmw', 'audi', 'toyota', 'honda', 'ford', 'porsche', 'ferrari', 'lamborghini',
  'vinfast', 'yamaha', 'suzuki', 'kawasaki', 'harley davidson',
  // Disney / Marvel / DC / Pixar characters and franchises
  'disney', 'marvel', 'pixar', 'mickey mouse', 'minnie mouse', 'frozen', 'elsa', 'moana',
  'spiderman', 'spider man', 'iron man', 'captain america', 'avengers', 'batman', 'superman',
  'star wars', 'baby yoda', 'harry potter',
  // Anime / game characters
  'pokemon', 'pikachu', 'doraemon', 'naruto', 'one piece', 'luffy', 'goku', 'dragon ball',
  'totoro', 'hello kitty', 'minecraft', 'among us', 'roblox', 'fortnite', 'genshin impact',
];

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KEYWORD_PATTERN = new RegExp(
  `\\b(?:${IP_RISK_KEYWORDS.map((keyword) => escapeRegExp(normalizeForMatch(keyword))).join('|')})\\b`,
);

export function detectIpRiskKeywords(text: string): boolean {
  return KEYWORD_PATTERN.test(normalizeForMatch(text));
}
