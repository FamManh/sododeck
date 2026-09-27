// Root-level files only (tool configs). Workspaces have their own eslint.config.js.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'apps/**',
      'packages/**',
      '.specify/**',
      '.claude/**',
      '.agents/**',
      '.github/skills/**',
    ],
  },
  js.configs.recommended,
  { languageOptions: { globals: globals.node } },
];
