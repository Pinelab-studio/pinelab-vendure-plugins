import { readdir, readFile } from 'node:fs/promises';

const packages = new URL('../../../packages/', import.meta.url);
const excluded = new Set(['test', 'util', '_vendure-plugin-template']);

/** Read package documentation without changing or duplicating its source files. */
export async function getPlugins() {
  const directories = await readdir(packages, { withFileTypes: true });
  const plugins = await Promise.all(
    directories
      .filter(
        (directory) => directory.isDirectory() && !excluded.has(directory.name)
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
          file.endsWith('.plugin.ts')
        );
        const pluginSource = pluginFile
          ? await readFile(new URL(`src/${pluginFile}`, base), 'utf8')
          : '';
        const compatibility = pluginSource.match(
          /compatibility:\s*['"]([^'"]+)['"]/
        )?.[1];
        const title = readme.split('\n')[0].replace(/^#\s*/, '').trim();
        return {
          ...pkg,
          title,
          slug: pkg.name.replace('@pinelab/', ''),
          directory: directory.name,
          compatibility,
          readme: readme.replace(/^.*Official documentation.*$/gm, ''),
          changelog,
        };
      })
  );
  return plugins.sort((a, b) => a.title.localeCompare(b.title));
}
