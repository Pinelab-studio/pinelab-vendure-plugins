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
}

export interface Plugin {
  name: string;
  npmName: string;
  version: string;
  slug: string;
  description: string;
  icon: string;
  markdownContent: string;
  nrOfDownloads: number;
}

const pluginDirName = '../packages/';

/**
 * Get all plugin directories starting with `vendure-plugin`
 */
export async function getPluginDirectories(): Promise<Dirent[]> {
  return (await readdir(pluginDirName, { withFileTypes: true }))
    .filter((dir) => dir.isDirectory())
    .filter((dir) => dir.name.startsWith('vendure-'));
}

export async function getPlugins(): Promise<Plugin[]> {
  const pluginDirectories = await getPluginDirectories();
  const plugins: Plugin[] = [];
  await Promise.all(
    pluginDirectories.map(async (r) => {
      try {
        const packageJsonFilePath = path.join(
          pluginDirName,
          r.name,
          'package.json'
        );
        const packageJson: PackageJson = JSON.parse(
          await readFile(packageJsonFilePath, 'utf8')
        );
        const readmeFilePath = path.join(pluginDirName, r.name, 'README.md');
        let readme: string = await readFile(readmeFilePath, 'utf8');
        // Remove official docs link from readme
        readme = readme.replace(/^.*Official documentation.*$/gm, '');
        // Get title from first line
        const name = readme.split('\n')[0].replace('#', '').trim();
        const readmeHtml = await parseReadme(readme);
        const nrOfDownloads = await getNrOfDownloads(packageJson.name);
        const slug = packageJson.name
          .replace('@pinelab/', '')
          .replace('@vendure-hub/', '');
        plugins.push({
          name,
          npmName: packageJson.name,
          version: packageJson.version,
          slug,
          description: packageJson.description,
          icon: getIcon(slug),
          markdownContent: readmeHtml,
          nrOfDownloads,
        });
      } catch (e) {
        console.error(`Error reading plugin ${r.name}`, e);
        return;
      }
    })
  );
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
export async function parseReadme(readmeString: string): Promise<string> {
  // `highlight` example uses https://highlightjs.org
  marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: function (code, lang) {
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
  return (await response.json()).downloads as number;
}
