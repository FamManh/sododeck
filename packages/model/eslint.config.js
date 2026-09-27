import { base } from '@sododeck/config/eslint';

// The model must run in Node, browsers and Web Workers (research R9), so src/ stays free of
// Node, DOM, React and storage APIs. Tests may use Node.
const browserFree = {
  files: ['src/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [{ group: ['node:*'], message: 'src/ must run without Node APIs.' }],
        paths: ['react', 'react-dom', 'y-indexeddb'].map((name) => ({
          name,
          message: 'src/ must not depend on UI or storage providers.',
        })),
      },
    ],
    'no-restricted-globals': [
      'error',
      ...['window', 'document', 'localStorage', 'indexedDB', 'navigator'].map((name) => ({
        name,
        message: 'src/ must run without a browser page.',
      })),
    ],
  },
};

export default [...base(import.meta.dirname), browserFree];
