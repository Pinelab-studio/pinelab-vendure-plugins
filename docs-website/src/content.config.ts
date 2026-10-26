import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        engineeringPath: z.string().optional(),
        pluginReadmeUrl: z.string().url().optional(),
        pluginMonthlyDownloads: z.number().int().nonnegative().optional(),
        pluginMetadata: z
          .object({
            npmUrl: z.string().url(),
            changelogUrl: z.string(),
            version: z.string(),
          })
          .optional(),
      }),
    }),
  }),
};
