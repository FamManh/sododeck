export default {
  '*.{ts,tsx,js,mjs,astro}': ['eslint --fix --no-warn-ignored', 'prettier --write'],
  '*.{json,css,md,mdx,yml,yaml,html}': ['prettier --write --ignore-unknown'],
};
