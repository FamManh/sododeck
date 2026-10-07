import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { publishSchema } from './src/integrations/publish-schema';

export default defineConfig({
  site: 'https://sododeck.com',
  output: 'static',
  integrations: [react(), mdx(), publishSchema()],
  vite: { plugins: [tailwindcss()] },
});
