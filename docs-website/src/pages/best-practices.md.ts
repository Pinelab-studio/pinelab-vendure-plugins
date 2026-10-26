import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import {
  markdownLabel,
  repository,
  stripFrontmatter,
} from '../utils/engineering-docs';

/** Publish all best-practice instructions from the loader's current GitHub snapshot. */
export const GET: APIRoute = async () => {
  const entries = (
    await getCollection(
      'docs',
      ({ data }) =>
        data.engineeringPath?.startsWith('docs/best-practices/') ?? false
    )
  ).sort((a, b) =>
    a.data.engineeringPath!.localeCompare(b.data.engineeringPath!)
  );
  if (!entries.length)
    throw new Error('Cannot publish best-practices.md: no source documents.');
  const sections = entries.map((entry) => {
    const body = stripFrontmatter(entry.body ?? '');
    if (!body)
      throw new Error(
        `Empty best-practices source: ${entry.data.engineeringPath}`
      );
    return `## [${markdownLabel(entry.data.title)}](${repository}/blob/main/${
      entry.data.engineeringPath
    })\n\n${body}`;
  });
  return new Response(
    `# Best practices\n\nInstructions for implementing and reviewing code in all Vendure projects.\n\n${sections.join(
      '\n\n'
    )}\n`,
    {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    }
  );
};
