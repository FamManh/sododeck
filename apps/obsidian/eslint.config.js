import { base } from '@sododeck/config/eslint';

// `main.js` and the single-file embed are build outputs, not source.
export default [
  { ignores: ['main.js', 'embed.single.html', 'release/**'] },
  ...base(import.meta.dirname),
];
