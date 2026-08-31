// src/lib/theme-script.ts
// Runs synchronously before hydration (injected via <script dangerouslySetInnerHTML>) so there is
// no flash-of-wrong-theme. Kept as a plain string (not a .js asset) because it must execute
// inline, before React hydrates.
export const THEME_STORAGE_KEY = 'basa3d-theme';

export const themeBootstrapScript = `(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();`;
