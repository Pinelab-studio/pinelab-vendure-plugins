import { readdir, readFile } from 'fs/promises';
import type { Dirent } from 'node:fs';
import path from 'path';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { getIcon } from './icons';
import { rehype } from 'rehype';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

interface PackageJson {
  name: string;
  description: string;
  version: string;
  icon: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
}

export interface Plugin {
  name: string;
  npmName: string;
  compatibility?: string;
  version: string;
  slug: string;
  description: string;
  icon: string;
  keywords: string[];
  markdownContent: string;
  changelogContent: string;
  nrOfDownloads: number;
  nrOfDependencies: number;
}

const packageDir = '../packages/';

/**
 * Get all plugin directories starting with `vendure-plugin`
 */
export async function getPluginDirectories(): Promise<Dirent[]> {
  return (await readdir(packageDir, { withFileTypes: true }))
    .filter((dir) => dir.isDirectory())
    .filter(
      (dir) => !['test', 'util', '_vendure-plugin-template'].includes(dir.name)
    ); // Exclude test and util directories
}

export async function getPlugins(): Promise<Plugin[]> {
  const pluginDirectories = await getPluginDirectories();
  const plugins: Plugin[] = [];
  for (const pluginDir of pluginDirectories) {
    try {
      const packageJsonFilePath = path.join(
        packageDir,
        pluginDir.name,
        'package.json'
      );
      const packageJson: PackageJson = JSON.parse(
        await readFile(packageJsonFilePath, 'utf8')
      );
      // README
      const readmeFilePath = path.join(packageDir, pluginDir.name, 'README.md');
      let readme = await readFile(readmeFilePath, 'utf8');
      // Remove official docs link from readme
      readme = readme.replace(/^.*Official documentation.*$/gm, '');
      // Get title from first line
      const name = readme.split('\n')[0].replace('#', '').trim();
      const markdownContent = await parseMarkdown(readme);
      // CHANGELOG
      const changelogFilePath = path.join(
        packageDir,
        pluginDir.name,
        'CHANGELOG.md'
      );
      const changelog = await readFile(changelogFilePath, 'utf8');
      const changelogContent = await parseMarkdown(changelog);
      const nrOfDownloads = await getNrOfDownloads(packageJson.name);
      const compatibility = await getCompatibilityRange(pluginDir.name);
      const slug = packageJson.name.replace('@pinelab/', '');
      plugins.push({
        name,
        npmName: packageJson.name,
        version: packageJson.version,
        slug,
        description: packageJson.description,
        icon: getIcon(slug),
        keywords: packageJson.keywords ?? [],
        markdownContent,
        changelogContent,
        nrOfDownloads,
        compatibility,
        nrOfDependencies: packageJson.dependencies
          ? Object.keys(packageJson.dependencies).length
          : 0,
      });
    } catch (e) {
      console.error(`Error reading plugin ${pluginDir.name}`, e);
    }
  }
  const pluginsSortedByDownloads = plugins.sort((a, b) => {
    // Move vendure-hub packages to the top
    if (a.npmName.indexOf('@vendure-hub') > -1) {
      return -1;
    }
    return b.nrOfDownloads - a.nrOfDownloads;
  });
  return pluginsSortedByDownloads;
}

/**
 * Parse raw Readme.md string to HTML
 */
export async function parseMarkdown(readmeString: string): Promise<string> {
  // `highlight` example uses https://highlightjs.org
  marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: function (code: any, lang: any) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-', // highlight.js css expects a top-level 'hljs' class.
    pedantic: false,
    gfm: true,
    breaks: false,
    sanitize: false,
    // smartLists: true,
    smartypants: false,
    xhtml: false,
  });
  const html = marked.parse(readmeString);
  // Add anchor links to headings
  const result = await rehype()
    .data('settings', { fragment: true })
    .use(rehypeAutolinkHeadings, {
      behavior: 'append',
    })
    .process(html);
  return String(result);
}

export async function getNrOfDownloads(
  packageName: string,
  period: string = 'last-month'
): Promise<number> {
  const response = await fetch(
    `https://api.npmjs.org/downloads/point/${period}/${packageName}`
  );
  if (!response.ok) {
    console.error(
      `Error fetching downloads for ${packageName}: ${response.statusText}`
    );
    return 0;
  }
  return (await response.json()).downloads as number;
}

export async function getCompatibilityRange(
  pluginDirectoryName: string
): Promise<string | undefined> {
  const srcDir = path.join(packageDir, pluginDirectoryName, 'src');
  const files = await readdir(srcDir);
  const pluginFile = files.find((f) => f.endsWith('.plugin.ts'));
  if (!pluginFile) {
    return;
  }
  const fileContent = await readFile(path.join(srcDir, pluginFile), 'utf-8');
  const matches = fileContent.match(/compatibility:\s*['"]([^'"]+)['"]/);
  return matches?.[1];
}

/**
 * Returns the raw README and CHANGELOG markdown for every plugin keyed by slug.
 * Slug is the npm package name without the `@pinelab/` prefix (matching `Plugin.slug`).
 */
export async function getAllPluginRawDocs(): Promise<
  Record<string, { readme: string; changelog: string }>
> {
  const pluginDirectories = await getPluginDirectories();
  const result: Record<string, { readme: string; changelog: string }> = {};
  for (const pluginDir of pluginDirectories) {
    try {
      const packageJson: { name: string } = JSON.parse(
        await readFile(
          path.join(packageDir, pluginDir.name, 'package.json'),
          'utf8'
        )
      );
      const slug = packageJson.name.replace('@pinelab/', '');
      const readme = await readFile(
        path.join(packageDir, pluginDir.name, 'README.md'),
        'utf8'
      );
      const changelog = await readFile(
        path.join(packageDir, pluginDir.name, 'CHANGELOG.md'),
        'utf8'
      );
      result[slug] = { readme, changelog };
    } catch (e) {
      console.error(`Error reading raw docs for ${pluginDir.name}`, e);
    }
  }
  return result;
}
