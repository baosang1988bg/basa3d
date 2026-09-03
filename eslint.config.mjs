import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules/', '.next/', '.next-test/', 'coverage/', 'next-env.d.ts'],
  },
  {
    // Root-level .mjs config files run in Node at build time. `no-undef` is already off for .ts
    // files (via typescript-eslint's eslint-recommended overrides), but not for plain ESM.
    files: ['*.mjs'],
    languageOptions: { globals: { process: 'readonly', URL: 'readonly' } },
  },
);
