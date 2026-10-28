// Pure, clock-injected dwell-time accumulator behind <ScreenTimeTracker>. No DOM access here so the
// state machine is unit-testable with a fake clock (tests/analytics-dwell-timer.test.ts).
// Rules: docs/marketing/ga4-tracking-guide.md § "Screen time".

export type DwellTimerOptions = {
  /** Results shorter than this are dropped as bounce/skip noise. */
  minMs?: number;
  /** One result is clamped to this (protects averages from forgotten tabs). */
  maxMs?: number;
  /** Without pointer/keyboard/scroll activity for this long, time stops counting. */
  idleMs?: number;
};

export type DwellResult = { key: string; ms: number };

export type DwellTimer = {
  /** Begin measuring a new screen. Discards anything not yet flushed. */
  start(key: string, isVisible: boolean): void;
  /** Page became hidden (tab switch, app switch, screen lock). */
  hide(): void;
  /** Page became visible again. */
  show(): void;
  /** User interaction — extends the idle window or resumes counting after idle. */
  activity(): void;
  /** Emit and reset the accumulated time. Returns null below `minMs` or when nothing is tracked. */
  flush(): DwellResult | null;
};

export const DWELL_DEFAULTS: Required<DwellTimerOptions> = {
  minMs: 1_000,
  maxMs: 30 * 60_000,
  idleMs: 2 * 60_000,
};

export function createDwellTimer(now: () => number, options: DwellTimerOptions = {}): DwellTimer {
  const { minMs, maxMs, idleMs } = { ...DWELL_DEFAULTS, ...options };
  let key: string | null = null;
  let visible = false;
  let accumulatedMs = 0;
  let segmentStart: number | null = null; // non-null while counting
  let lastActivity = 0;

  function closeSegment(at: number) {
    if (segmentStart === null) return;
    const end = Math.min(at, lastActivity + idleMs);
    if (end > segmentStart) accumulatedMs += end - segmentStart;
    segmentStart = null;
  }

  function openSegment(at: number) {
    segmentStart = at;
    lastActivity = at;
  }

  return {
    start(nextKey, isVisible) {
      key = nextKey;
      visible = isVisible;
      accumulatedMs = 0;
      segmentStart = null;
      if (visible) openSegment(now());
    },
    hide() {
      closeSegment(now());
      visible = false;
    },
    show() {
      if (key === null) return;
      visible = true;
      openSegment(now());
    },
    activity() {
      if (!visible || key === null) return;
      const at = now();
      if (segmentStart === null) {
        openSegment(at);
      } else if (at > lastActivity + idleMs) {
        // Was idle: bank time up to the idle cut-off, then restart counting from this interaction.
        closeSegment(at);
        openSegment(at);
      } else {
        lastActivity = at;
      }
    },
    flush() {
      if (key === null) return null;
      const at = now();
      closeSegment(at);
      const total = Math.min(accumulatedMs, maxMs);
      accumulatedMs = 0;
      // Keep counting the same screen (e.g. after a hidden→visible cycle) without treating the
      // flush itself as user activity.
      if (visible) segmentStart = at;
      return total >= minMs ? { key, ms: Math.round(total) } : null;
    },
  };
}
