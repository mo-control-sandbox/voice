// @ts-check
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/** Source globs — generated protobuf files are excluded via ignores below. */
const TS_SOURCES = ['src/main/**/*.ts', 'src/renderer/**/*.{ts,tsx}'];
const RENDERER_SOURCES = ['src/renderer/**/*.{ts,tsx}'];

export default [
  // ── Global ignores ───────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'build/**',
      'temp/**',
      'dist/**',
      // Generated protobuf files — do not lint machine-generated code.
      'src/main/gen/**',
      'src/renderer/gen/**',
    ],
  },

  // ── TypeScript: strict + stylistic (type-checked) ────────────────────────
  // Spread the typescript-eslint flat-config presets and scope them to our
  // source files only, so they never accidentally match config or test files.
  ...tsPlugin.configs['flat/strict-type-checked'].map((cfg) => ({
    ...cfg,
    files: TS_SOURCES,
  })),

  ...tsPlugin.configs['flat/stylistic-type-checked'].map((cfg) => ({
    ...cfg,
    files: TS_SOURCES,
  })),

  // ── Type-aware parsing ───────────────────────────────────────────────────
  // projectService discovers tsconfig.json automatically from each source file
  // (same mechanism as the TypeScript language service).
  {
    files: TS_SOURCES,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prefer explicit `readonly` on class members and parameter properties.
      '@typescript-eslint/prefer-readonly': 'error',

      // Require explicit return types on exported functions.
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // Disallow `void` return type abuse (promises must be awaited or returned).
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: { attributes: false },
      }],

      // Consistent import style: type-only imports use `import type`.
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],

      // Enforce exhaustive union checks via switch/if.
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // Require Promise return values to be handled.
      '@typescript-eslint/no-floating-promises': 'error',

      // Allow unused parameters prefixed with _ (interface implementation convention).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // ── React-specific rules (renderer process only) ─────────────────────────
  {
    files: RENDERER_SOURCES,
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Enforce the Rules of Hooks.
      'react-hooks/rules-of-hooks': 'error',

      // Warn on missing effect/callback dependencies (violations fail under
      // zero-warning policy — treat them as errors in practice).
      'react-hooks/exhaustive-deps': 'warn',

      // Only export components from React modules (enables fast-refresh).
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];
