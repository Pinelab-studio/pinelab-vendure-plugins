// @ts-check

import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import { getPlugins } from './src/utils/plugins.ts';

const plugins = await getPlugins();

export default defineConfig({
  site: 'https://engineering.pinelab.studio',
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
      title: 'Pinelab Engineering',
      favicon: '/pinelab-sticker.png',
      logo: {
        src: './public/pinelab-engineering-logo.png',
        replacesTitle: true,
      },
      customCss: ['./src/styles/pinelab.css'],
      components: {
        Head: './src/components/Head.astro',
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
        { label: 'Plugin philosophy', slug: 'philosophy' },
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
