// @ts-check
import { defineConfig } from 'astro/config';
import { getPlugins } from './src/utils/plugins.ts';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

const plugins = await getPlugins();

export default defineConfig({
  site: 'https://plugins.pinelab.studio',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (page) => new URL(page).pathname !== '/design-system/',
    }),
    starlight({
      title: 'Pinelab Vendure Plugins',
      favicon: '/pinelab-sticker.png',
      logo: { src: './public/pinelab-plugins-logo.png', replacesTitle: true },
      customCss: ['./src/styles/pinelab.css'],
      expressiveCode: {
        shiki: { langAlias: { Dockerfile: 'dockerfile', env: 'dotenv' } },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/Pinelab-studio/pinelab-vendure-plugins',
        },
      ],
      sidebar: [
        { label: 'Home', slug: '' },
        {
          label: 'Plugins',
          items: plugins.map((plugin) => ({
            label: plugin.title,
            link: `/plugin/${plugin.slug}/`,
          })),
        },
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
        { label: 'AI integration', slug: 'ai-integration' },
      ],
    }),
  ],
});
