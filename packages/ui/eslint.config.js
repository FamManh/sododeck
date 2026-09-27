import { react } from '@sododeck/config/eslint';

export default [
  ...react(import.meta.dirname),
  // Library package: shadcn files export variants next to components; no HMR boundary here.
  { rules: { 'react-refresh/only-export-components': 'off' } },
];
