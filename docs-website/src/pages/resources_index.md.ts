import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { markdownLabel, rawRepository } from '../utils/engineering-docs';

/** Publish a discovery index linking to canonical recipe and plugin README files. */
export const GET: APIRoute = async () => {
  const entries = (
    await getCollection(
      'docs',
      ({ data }) => data.engineeringPath?.startsWith('docs/recipes/') ?? false,
    )
  ).sort((a, b) => a.data.title.localeCompare(b.data.title));
  if (!entries.length)
    throw new Error('Cannot publish resources_index.md: no source documents.');
  const items = entries.map(({ data }) => {
    if (!data.description?.trim())
      throw new Error(`Recipe has no description: ${data.engineeringPath}`);
    return `- [${markdownLabel(data.title)}](${rawRepository}/refs/heads/main/${
      data.engineeringPath
    }) — ${data.description.trim().replace(/\s+/g, ' ')}`;
  });
  const plugins = (
    await getCollection('docs', ({ data }) => Boolean(data.pluginReadmeUrl))
  ).sort(
    (a, b) =>
      (b.data.pluginMonthlyDownloads ?? 0) -
        (a.data.pluginMonthlyDownloads ?? 0) ||
      a.data.title.localeCompare(b.data.title),
  );
  if (!plugins.length)
    throw new Error('Cannot publish resources_index.md: no plugins.');
  const pluginItems = plugins.map(
    ({ data }) =>
      `- [${markdownLabel(data.title)}](${data
        .pluginReadmeUrl!.replace(
          'https://github.com/',
          'https://raw.githubusercontent.com/',
        )
        .replace('/blob/main/', '/refs/heads/main/')}) — ${(
        data.description ?? ''
      )
        .trim()
        .replace(/\s+/g, ' ')}`,
  );
  return new Response(
    `# Resources index\n\nWhen implementing a feature, check for similar prior work or an existing plugin. Follow the relevant GitHub Markdown links before writing code; prefer an existing plugin when it fits.\n\n## Recipes\n\n${items.join(
      '\n',
    )}\n\n## Plugins\n\n${pluginItems.join('\n')}\n`,
    {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    },
  );
};
