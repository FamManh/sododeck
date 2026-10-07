// Shared ESLint flat configs. Each workspace composes these in its own
// eslint.config.js so typed linting resolves against that workspace's tsconfig.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ignores = {
  ignores: [
    '**/dist/**',
    '**/dist-embed/**',
    '**/.astro/**',
    '**/coverage/**',
    '**/src/generated/**',
    '**/*.d.ts',
  ],
};

/** TypeScript base with type-aware rules. */
export function base(tsconfigRootDir) {
  return tseslint.config(
    ignores,
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.browser, ...globals.node },
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      ...tseslint.configs.disableTypeChecked,
    },
    prettier,
  );
}

/** React (Vite) workspaces. */
export function react(tsconfigRootDir) {
  return tseslint.config(...base(tsconfigRootDir), {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  });
}

/** Astro workspaces (React islands allowed). */
export function astroConfig(tsconfigRootDir) {
  return tseslint.config(...react(tsconfigRootDir), ...astro.configs.recommended, {
    files: ['**/*.astro'],
    ...tseslint.configs.disableTypeChecked,
  });
}
