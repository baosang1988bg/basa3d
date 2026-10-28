// Phase 50 — Cẩm nang in 3D (`/cam-nang`). Content is code-first and rendered on the server; only
// the TOC, checklist and material filter are client islands, and they receive data through props.
// Client components must never import a value from this folder (guarded in
// tests/phase-50-handbook.test.ts) — that would ship all nine chapters to the browser.

/** Ecosystem destinations a chapter can point to. Resolved to an href only in tool-links.ts (B1). */
export type HandbookToolId = 'bao-gia' | 'organizer' | 'keychain-blocks' | 'hinge-box' | 'custom-print';

export type HandbookBlock =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'terms'; items: { term: string; definition: string }[] }
  | { type: 'callout'; tone: 'tip' | 'warning'; title: string; text: string }
  | { type: 'materials' }
  | { type: 'tolerances' }
  /** Phase 53 — interactive calculator fed by HANDBOOK_TOLERANCES (client island). */
  | { type: 'fit-calculator' }
  /** Phase 53 — visitor's own home-printing cost (never a BaSa3D price; see lib/handbook/print-cost). */
  | { type: 'cost-calculator' }
  /** Phase 53 — downloadable slicer presets for OrcaSlicer / Bambu Studio / PrusaSlicer (S5). */
  | { type: 'presets' }
  | { type: 'troubleshooting' }
  | { type: 'checklist' }
  | {
      type: 'tool';
      toolId: HandbookToolId;
      title: string;
      text: string;
      /** Required for flag-gated tools (`bao-gia`): copy shown when the tool is switched off. */
      fallback?: { title: string; text: string };
    };

export type HandbookSection = {
  /** Stable anchor id — also the `#hash` in shared links, so never rename once published. */
  id: string;
  /** Two-digit chapter number shown in the TOC ("01"…"09"). */
  number: string;
  title: string;
  /** One-line summary for the TOC tooltip and the chapter intro. */
  summary: string;
  blocks: HandbookBlock[];
};

export type HandbookTocItem = Pick<HandbookSection, 'id' | 'number' | 'title'>;

export type MaterialTag = 'beginner' | 'enclosure' | 'flexible' | 'engineering';

export type HandbookMaterial = {
  id: string;
  name: string;
  /** Temperatures in °C as [min, max] ranges — starting points, not guarantees. */
  nozzleC: [number, number];
  bedC: [number, number];
  dryingC: [number, number];
  dryingHours: [number, number];
  /** Part-cooling fan, percent [min, max]. */
  fanPercent: [number, number];
  enclosure: 'none' | 'recommended' | 'required';
  tags: MaterialTag[];
  note: string;
};

export type HandbookTolerance = {
  id: string;
  fit: string;
  /** Recommended clearance per side in mm, [min, max]. */
  clearanceMm: [number, number];
  example: string;
  note: string;
};

export type HandbookDefect = {
  id: string;
  name: string;
  symptom: string;
  /** Ordered from cheapest/most likely (clean, dry) to slicer changes. */
  fixes: string[];
  /**
   * Phase 53 — optional before/after photo pair. B2: only BaSa3D's own workshop photos (no forum or
   * stock images); same model, angle and framing so the toggle compares like with like. Files live in
   * public/images/handbook/defects/ (asserted by tests/phase-53-handbook-interactive.test.ts).
   */
  photos?: { failed: HandbookPhoto; fixed: HandbookPhoto; credit: string };
};

export type HandbookPhoto = {
  /** Public path, e.g. `/images/handbook/defects/stringing-failed.webp`. */
  src: string;
  /** Describes what the photo shows (the defect), not "ảnh lỗi". Required for a11y and image SEO. */
  alt: string;
  /** Intrinsic pixel size — prevents CLS. Both photos of a pair must share the aspect ratio. */
  width: number;
  height: number;
};

export type HandbookChecklistItem = {
  /** Stable id persisted in localStorage — never reuse an id for a different step. */
  id: string;
  title: string;
  detail: string;
};
