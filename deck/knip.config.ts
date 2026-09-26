import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Files to exclude from Knip analysis
  ignore: ['src/libs/I18n.ts', 'src/types/I18n.ts', 'src/libs/Logger.ts'],
  // Dependencies to ignore during analysis
  ignoreDependencies: [
    // Kept from the boilerplate for upcoming forms and logging
    '@hookform/resolvers',
    '@logtape/logtape',
    'react-hook-form',
    'translation-resilience',
    'semantic-release',
  ],
  // Include custom Playwright test file suffixes
  playwright: {
    entry: ['tests/**/*.@(integ|e2e).ts'],
  },
  compilers: {
    css: (text: string) => [...text.matchAll(/(?<=@)import[^;]+/gu)].join('\n'),
  },
  treatConfigHintsAsErrors: true,
};

export default config;
