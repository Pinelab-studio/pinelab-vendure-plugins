import { readdir, readFile } from 'node:fs/promises';

const packages = new URL('../../../packages/', import.meta.url);
const excluded = new Set(['test', 'util', '_vendure-plugin-template']);

/** Fetch all public GitHub contributors at build time, preserving contribution order. */
export async function getContributors() {
  const contributors: Array<{
    login: string;
    html_url: string;
    avatar_url: string;
    contributions: number;
  }> = [];
  for (let page = 1; ; page++) {
    const response = await fetch(
      `https://api.github.com/repos/Pinelab-studio/pinelab-vendure-plugins/contributors?per_page=100&page=${page}`,
      { signal: AbortSignal.timeout(30_000) },
    );
    if (!response.ok) {
      throw new Error(`Unable to fetch contributors (${response.status})`);
    }
    const batch = (await response.json()) as typeof contributors;
    contributors.push(...batch);
    if (batch.length < 100) return contributors;
  }
}

/** Read package documentation without changing or duplicating its source files. */
export async function getPlugins() {
  const snapshot = JSON.parse(
    await readFile(
      new URL('../../plugin-downloads.json', import.meta.url),
      'utf8',
    ),
  ) as { downloads: Record<string, number> };
  const directories = await readdir(packages, { withFileTypes: true });
  const plugins = await Promise.all(
    directories
      .filter(
        (directory) => directory.isDirectory() && !excluded.has(directory.name),
      )
      .map(async (directory) => {
        const base = new URL(`${directory.name}/`, packages);
        const [metadata, readme, changelog] = await Promise.all([
          readFile(new URL('package.json', base), 'utf8'),
          readFile(new URL('README.md', base), 'utf8'),
          readFile(new URL('CHANGELOG.md', base), 'utf8'),
        ]);
        const pkg = JSON.parse(metadata) as {
          name: string;
          description: string;
          version: string;
        };
        const sourceFiles = await readdir(new URL('src/', base));
        const pluginFile = sourceFiles.find((file) =>
          file.endsWith('.plugin.ts'),
        );
        const pluginSource = pluginFile
          ? await readFile(new URL(`src/${pluginFile}`, base), 'utf8')
          : '';
        const compatibility = pluginSource.match(
          /compatibility:\s*['"]([^'"]+)['"]/,
        )?.[1];
        const title = readme.split('\n')[0].replace(/^#\s*/, '').trim();
        return {
          ...pkg,
          monthlyDownloads: snapshot.downloads[pkg.name] ?? 0,
          title,
          slug: pkg.name.replace('@pinelab/', ''),
          directory: directory.name,
          compatibility,
          readme: readme.replace(/^.*Official documentation.*$/gm, ''),
          changelog,
        };
      }),
  );
  return plugins.sort(
    (a, b) =>
      b.monthlyDownloads - a.monthlyDownloads || a.title.localeCompare(b.title),
  );
}
