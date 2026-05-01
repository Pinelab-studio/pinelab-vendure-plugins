import type { APIRoute } from 'astro';
import { getPlugins } from '../utils/plugins';

const SITE = 'https://plugins.pinelab.studio';

/**
 * Static `llms.txt` endpoint following the https://llmstxt.org spec.
 *
 * Lists every plugin with its description and (when available) keywords,
 * linking to raw `readme.md` and `changelog.md` files for each plugin.
 */
export const GET: APIRoute = async () => {
  const plugins = await getPlugins();

  const lines: string[] = [];
  lines.push('# Pinelab Vendure Plugins');
  lines.push('');
  lines.push(
    '> Open-source Vendure plugins maintained by Pinelab. Each plugin below links to its raw README and CHANGELOG in markdown.'
  );
  lines.push('');
  lines.push('## Plugins');
  lines.push('');

  for (const plugin of plugins) {
    const readmeUrl = `${SITE}/plugin/${plugin.slug}/readme.md`;
    const changelogUrl = `${SITE}/plugin/${plugin.slug}/changelog.md`;
    const description = plugin.description?.trim() || plugin.name;
    const keywordsPart =
      plugin.keywords && plugin.keywords.length > 0
        ? ` Keywords: ${plugin.keywords.join(', ')}.`
        : '';
    lines.push(
      `- [${plugin.name}](${readmeUrl}): ${description}.${keywordsPart}`
    );
    lines.push(`  - [Changelog](${changelogUrl})`);
  }

  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
