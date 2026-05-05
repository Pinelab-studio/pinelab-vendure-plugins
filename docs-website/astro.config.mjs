// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://plugins.pinelab.studio',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  // Fonts API: downloads, self-hosts, preloads and generates optimized
  // monospace fallbacks to avoid FOUT/FOIT on slow (mobile) connections.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Ubuntu Mono',
      cssVariable: '--font-ubuntu-mono',
      weights: [400, 700],
      styles: ['normal'],
      optimizedFallbacks: true,
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    react(),
    // Sitemap under sitemap-0.xml
    sitemap({
      filter: (page) => {
        return !page.includes('/billing') && !page.includes('/llms/');
      },
    }),
  ],
});
