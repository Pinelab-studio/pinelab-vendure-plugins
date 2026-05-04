import type { APIRoute } from 'astro';
import { getPlugins } from '../utils/plugins';

const SITE = 'https://plugins.pinelab.studio';

/**
 * Static `llms.txt` endpoint following the https://llmstxt.org spec.
 *
 * Lists every plugin with its description and (when available) keywords,
 * linking to a single per-plugin markdown file at `/llms/<slug>.md` that
 * contains the full README, a link to the GitHub source directory, and
 * the full CHANGELOG appended at the bottom.
 */
export const GET: APIRoute = async () => {
  const plugins = await getPlugins();

  const lines: string[] = [];
  lines.push('# Pinelab Vendure Plugins');
  lines.push('');
  lines.push(
    '> Open-source Vendure plugins maintained by Pinelab. Each link below points to a self-contained markdown file with the plugin README, a link to the source on GitHub, and the full changelog.'
  );
  lines.push('');
  lines.push('## Plugins');
  lines.push('');

  for (const plugin of plugins) {
    const docUrl = `${SITE}/llms/${plugin.slug}.md`;
    const description = plugin.description?.trim() || plugin.name;
    const keywordsPart =
      plugin.keywords && plugin.keywords.length > 0
        ? ` Keywords: ${plugin.keywords.join(', ')}.`
        : '';
    lines.push(`- [${plugin.name}](${docUrl}): ${description}.${keywordsPart}`);
  }

  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
