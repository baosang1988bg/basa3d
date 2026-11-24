// QA-018 / ADR-0066 perf: without a `messages` prop NextIntlClientProvider serialises EVERY namespace
// into each page's RSC payload. These namespaces are only read by server components (getTranslations,
// or useTranslations in a component that is never imported by a 'use client' file), so the browser never
// needs them (~18 KB of the ~28 KB catalogue). tests/qa-audit-perf.test.ts fails if a 'use client' file
// starts reading one of them. Pure.
export const SERVER_ONLY_MESSAGE_NAMESPACES = ['policies', 'home', 'tools'] as const;

export function pickClientMessages(messages: Record<string, unknown>): Record<string, unknown> {
  const picked = { ...messages };
  for (const namespace of SERVER_ONLY_MESSAGE_NAMESPACES) delete picked[namespace];
  return picked;
}
