// @ts-check

import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { getPlugins } from './src/utils/plugins.ts';

const plugins = await getPlugins();

export default defineConfig({
  site: 'https://plugins.pinelab.studio',
  trailingSlash: 'always',
  vite: {
    preview: {
      allowedHosts: true,
    },
  },
  integrations: [
    sitemap({
      filter: (page) => new URL(page).pathname !== '/design-system/',
    }),
    starlight({
      title: 'Pinelab Vendure Plugins',
      favicon: '/pinelab-sticker.png',
      logo: { src: './public/pinelab-plugins-logo.png', replacesTitle: true },
      customCss: ['./src/styles/pinelab.css'],
      components: {
        Header: './src/components/Header.astro',
        PageFrame: './src/components/PageFrame.astro',
        MarkdownContent: './src/components/MarkdownContent.astro',
        ThemeProvider: './src/components/ThemeProvider.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      expressiveCode: {
        shiki: { langAlias: { Dockerfile: 'dockerfile', env: 'dotenv' } },
      },
      sidebar: [
        { label: 'AI integration', slug: 'ai-integration' },
        {
          label: 'Recipes',
          items: [{ autogenerate: { directory: 'recipes' } }],
        },
        {
          label: 'Plugins',
          items: plugins.map((plugin) => ({
            label: plugin.title,
            link: `/plugin/${plugin.slug}/`,
          })),
        },
      ],
    }),
  ],
});
