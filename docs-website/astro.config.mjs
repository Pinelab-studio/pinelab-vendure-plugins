import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'Pinelab Plugins',
      social: {
        github: 'https://github.com/Pinelab-studio/pinelab-vendure-plugins',
      },
      sidebar: [
        {
          label: 'Plugins',
          items: [
            // Each item here is one entry in the navigation menu.
            {
              label: 'Example Guide',
              link: 'https://pinelab-plugins.com/how-does-it-work/',
            },
          ],
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
      ],
    }),
  ],

  // Process images with sharp: https://docs.astro.build/en/guides/assets/#using-sharp
  image: { service: { entrypoint: 'astro/assets/services/sharp' } },
});
