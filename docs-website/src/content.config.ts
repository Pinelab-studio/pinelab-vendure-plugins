import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Build-time content collections for the docs site.
 *
 * `guides` — long-form Markdown articles rendered at /guides/<slug>.
 * Add new files to `src/content/guides/` and they will be picked up on
 * the next build, included in the sitemap, and rendered through the
 * shared site Layout.
 */
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    /**
     * URL slug for the guide. Required.
     * Determines the route: /guides/<slug>.
     */
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'slug must be kebab-case (lowercase, digits, hyphens)',
    }),
    /** Page H1 and SEO `<title>`. */
    title: z.string(),
    /** Meta description / OG description. Aim for ~150 chars. */
    description: z.string().min(50).max(200),
    /** Original publish date. Used for Article JSON-LD `datePublished`. */
    pubDate: z.coerce.date(),
    /** Optional last-updated date. Falls back to `pubDate` when absent. */
    updatedDate: z.coerce.date().optional(),
    /** Author name shown in Article JSON-LD. Defaults to Pinelab. */
    author: z.string().default('Pinelab'),
    /**
     * Optional remote hero image URL. Rendered at the top of the guide
     * AND used as the OG image. Host must be authorized in
     * `astro.config.mjs#image.domains` (or `image.remotePatterns`).
     */
    heroImage: z.string().url().optional(),
    /** Alt text for `heroImage`. Falls back to `title` when omitted. */
    heroImageAlt: z.string().optional(),
    /**
     * Optional smaller hero image URL for the guides overview.
     * Should be the same image as `heroImage` but at a smaller width
     * (e.g. `w=500` for Unsplash). Used on the /guides index page.
     */
    heroImageSmall: z.string().url().optional(),
  }),
});

export const collections = { guides };
