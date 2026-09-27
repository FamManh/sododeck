import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sododeck.com',
  output: 'static',
  integrations: [react(), mdx()],
  vite: { plugins: [tailwindcss()] },
});
