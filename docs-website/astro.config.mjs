// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://plugins.pinelab.studio',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Pinelab Vendure Plugins',
      favicon: '/favicon.png',
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
        { label: 'Plugins', items: [{ autogenerate: { directory: 'plugin' } }] },
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
        { label: 'AI integration', slug: 'ai-integration' },
      ],
    }),
  ],
});
