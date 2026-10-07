import { base } from '@sododeck/config/eslint';

// `media/` is a copy of the app's built embed bundle and `dist/` is our bundle: not source.
export default [{ ignores: ['dist/**', 'media/**'] }, ...base(import.meta.dirname)];
