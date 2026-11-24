// ADR-0064 — open the header search from anywhere on the storefront (e.g. the /products empty state) without
// prop drilling: a window CustomEvent that HeaderSearch listens to. Pure + tiny so any client component can import it.

export type HeaderSearchTab = 'products' | 'library' | 'image';
export const OPEN_SEARCH_EVENT = 'basa3d:open-search';
export type OpenSearchDetail = { tab?: HeaderSearchTab; query?: string };

export function openHeaderSearch(detail: OpenSearchDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenSearchDetail>(OPEN_SEARCH_EVENT, { detail }));
}

/** Ctrl+K / ⌘+K (also when an input has focus — same as most sites). */
export function isOpenSearchShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k';
}
