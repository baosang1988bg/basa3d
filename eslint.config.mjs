import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'node_modules/',
      '.next/',
      '.next-test/',
      '.next-e2e/',
      // One-off reverse-engineering helpers kept with the research notes, not app code.
      'docs/research/**',
      'coverage/',
      'next-env.d.ts',
      '.agents/**',
      '.claude/**',
      '.vnx-data/**',
      '.venv-swarm/**',
      '.swarm/**',
    ],
  },
  {
    // Root-level .mjs config files run in Node at build time. `no-undef` is already off for .ts
    // files (via typescript-eslint's eslint-recommended overrides), but not for plain ESM.
    files: ['*.mjs'],
    languageOptions: { globals: { process: 'readonly', URL: 'readonly' } },
  },
);
