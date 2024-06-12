import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  markdown: {
    drafts: true,
  },
  site: 'https://pinelab.studio',
  integrations: [tailwind(), sitemap()],
});
