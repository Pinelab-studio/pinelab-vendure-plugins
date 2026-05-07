import type { APIRoute, GetStaticPaths } from 'astro';
import { getPlugins } from '../../utils/plugins';

const SITE = 'https://plugins.pinelab.studio';
const REPO = 'https://github.com/Pinelab-studio/pinelab-vendure-plugins';

/**
 * Static markdown endpoint per plugin at `/llms/<slug>.md`.
 *
 * Each file contains the plugin's full README, with a link to the
 * GitHub source directory injected just after the README's H1 title,
 * and the full CHANGELOG appended at the bottom.
 *
 * Used by `llms.txt` so an LLM can fetch a single self-contained
 * markdown file per plugin.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const plugins = await getPlugins();
  return plugins.map((p) => ({
    params: { pluginName: p.slug },
    props: { plugin: p },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const plugin = props.plugin as Awaited<ReturnType<typeof getPlugins>>[number];
  const readme = plugin.markdownReadme ?? '';
  const changelog = plugin.markdownChangelog ?? '';

  const repoUrl = `${REPO}/tree/main/${plugin.repoSubpath}`;

  // Inject the repository link directly after the README's H1 (first line).
  const lines = readme.split('\n');
  const firstLine = lines[0] ?? `# ${plugin.name}`;
  const rest = lines.slice(1).join('\n');
  const readmeWithRepoLink = `${firstLine}\n\n- [Source code on GitHub](${repoUrl})\n${rest}`;

  // Append changelog at the bottom.
  const body = `${readmeWithRepoLink.trimEnd()}\n\n---\n\n# Changelog\n\n${changelog.trimEnd()}\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
};
