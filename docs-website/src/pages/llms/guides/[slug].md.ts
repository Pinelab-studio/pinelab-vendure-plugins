import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';

/**
 * Static markdown endpoint per guide at `/llms/guides/<slug>.md`.
 *
 * Serves the raw guide markdown (with frontmatter stripped) prefixed by
 * an H1 of the guide's `title`, so an LLM can fetch a single
 * self-contained file per guide. Referenced from `llms.txt`.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const guides = await getCollection('guides');
  return guides.map((entry) => ({
    params: { slug: entry.data.slug },
    props: { entry },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const entry = props.entry as Awaited<
    ReturnType<typeof getCollection<'guides'>>
  >[number];

  // `entry.body` is the raw markdown without frontmatter.
  const body = (entry.body ?? '').trimEnd();

  const out = `# ${entry.data.title}\n\n> ${entry.data.description}\n\n${body}\n`;

  return new Response(out, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
};
