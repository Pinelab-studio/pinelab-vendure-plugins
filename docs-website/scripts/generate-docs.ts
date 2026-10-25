import { mkdir, rm, writeFile } from 'node:fs/promises';
import { getPlugins } from '../src/utils/plugins.ts';

const output = new URL('../src/content/docs/plugin/', import.meta.url);

/** Refresh disposable Starlight inputs from the canonical package documentation. */
async function generatePluginDocs() {
  // Read everything before replacing generated content so missing sources fail the build.
  const plugins = await getPlugins();
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const plugin of plugins) {
    const directory = new URL(`${plugin.slug}/`, output);
    await mkdir(directory, { recursive: true });
    const editBase = `https://github.com/Pinelab-studio/pinelab-vendure-plugins/edit/main/packages/${plugin.directory}`;
    const metadata = `[View on npm](https://www.npmjs.com/package/${
      plugin.name
    }) · [Changelog](/plugin/${plugin.slug}/changelog/)\n\nVersion: ${
      plugin.version
    }${
      plugin.compatibility
        ? ` · Vendure compatibility: ${plugin.compatibility}`
        : ''
    }\n\n\`\`\`sh\nnpm install ${plugin.name}\n\`\`\`\n`;
    await writeFile(
      new URL('index.md', directory),
      frontmatter({
        title: plugin.title,
        description: plugin.description,
        editUrl: `${editBase}/README.md`,
      }) +
        metadata +
        '\n\n' +
        plugin.readme
    );
    await writeFile(
      new URL('changelog.md', directory),
      frontmatter({
        title: `${plugin.title} changelog`,
        description: `Release history for ${plugin.name}.`,
        editUrl: `${editBase}/CHANGELOG.md`,
        sidebar: { hidden: true },
      }) +
        `[← Plugin documentation](/plugin/${plugin.slug}/) · [View on npm](https://www.npmjs.com/package/${plugin.name})\n\n` +
        plugin.changelog
    );
  }
  console.log(
    `Generated Starlight documentation for ${plugins.length} plugins.`
  );
}

/** JSON values are also valid YAML, avoiding manual escaping of package metadata. */
function frontmatter(data: Record<string, unknown>) {
  return `---\n${Object.entries(data)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')}\n---\n\n`;
}

await generatePluginDocs();
