import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { markdownLabel, repository } from '../utils/engineering-docs';

/** Publish a discovery index linking to canonical recipe and plugin README files. */
export const GET: APIRoute = async () => {
  const entries = (
    await getCollection(
      'docs',
      ({ data }) => data.engineeringPath?.startsWith('docs/recipes/') ?? false
    )
  ).sort((a, b) => a.data.title.localeCompare(b.data.title));
  if (!entries.length)
    throw new Error(
      'Cannot publish recipes-and-plugins.md: no source documents.'
    );
  const items = entries.map(({ data }) => {
    if (!data.description?.trim())
      throw new Error(`Recipe has no description: ${data.engineeringPath}`);
    return `- [${markdownLabel(data.title)}](${repository}/blob/main/${
      data.engineeringPath
    }) — ${data.description.trim().replace(/\s+/g, ' ')}`;
  });
  const plugins = (
    await getCollection('docs', ({ data }) => Boolean(data.pluginReadmeUrl))
  ).sort((a, b) => a.data.title.localeCompare(b.data.title));
  if (!plugins.length)
    throw new Error('Cannot publish recipes-and-plugins.md: no plugins.');
  const pluginItems = plugins.map(
    ({ data }) =>
      `- [${markdownLabel(data.title)}](${data.pluginReadmeUrl}) — ${(
        data.description ?? ''
      )
        .trim()
        .replace(/\s+/g, ' ')}`
  );
  return new Response(
    `# Recipes and plugins\n\nWhen implementing a feature, check for similar prior work or an existing plugin. Follow the relevant GitHub Markdown links before writing code; prefer an existing plugin when it fits.\n\n## Recipes\n\n${items.join(
      '\n'
    )}\n\n## Plugins\n\n${pluginItems.join('\n')}\n`,
    {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    }
  );
};
