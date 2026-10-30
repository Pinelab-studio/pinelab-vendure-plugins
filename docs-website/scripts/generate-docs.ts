import { mkdir, rm, writeFile } from 'node:fs/promises';
import {
  getEngineeringDocs,
  markdownLabel,
  stripFrontmatter,
} from '../src/utils/engineering-docs.ts';
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
    const metadata = `\`\`\`sh\nnpm install ${plugin.name}\n\`\`\`\n`;
    await writeFile(
      new URL('index.md', directory),
      frontmatter({
        title: plugin.title,
        description: plugin.description,
        pluginReadmeUrl: `https://github.com/Pinelab-studio/pinelab-vendure-plugins/blob/main/packages/${plugin.directory}/README.md`,
        pluginMonthlyDownloads: plugin.monthlyDownloads,
        pluginMetadata: {
          npmUrl: `https://www.npmjs.com/package/${plugin.name}`,
          changelogUrl: `/plugin/${plugin.slug}/changelog/`,
          version: plugin.version,
        },
        editUrl: false,
      }) +
        metadata +
        '\n\n' +
        plugin.readme,
    );
    await writeFile(
      new URL('changelog.md', directory),
      frontmatter({
        title: `${plugin.title} changelog`,
        description: `Release history for ${plugin.name}.`,
        editUrl: false,
        sidebar: { hidden: true },
      }) +
        `[← Plugin documentation](/plugin/${plugin.slug}/) · [View on npm](https://www.npmjs.com/package/${plugin.name})\n\n` +
        plugin.changelog,
    );
  }
  console.log(
    `Generated Starlight documentation for ${plugins.length} plugins.`,
  );
}

/** JSON values are also valid YAML, avoiding manual escaping of package metadata. */
function frontmatter(data: Record<string, unknown>) {
  return `---\n${Object.entries(data)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')}\n---\n\n`;
}

/** Fetch disposable Markdown files for the same Starlight pipeline as plugin docs. */
async function generateRecipeDocs() {
  const { sources } = await getEngineeringDocs();
  const output = new URL('../src/content/docs/recipes/', import.meta.url);
  const recipes = sources.map(({ path, markdown }) => {
    const slug = path
      .replace(/^docs\/(best-practices|recipes)\//, '')
      .replace(/\.md$/, '');
    const metadata =
      markdown.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ??
      '';
    // Leave YAML parsing to Astro, including quoted and multiline metadata values.
    const yaml = /^title:/m.test(metadata)
      ? metadata
      : metadata.replace(/^name:/m, 'title:');
    const title = stripFrontmatter(markdown).match(/^#\s+(.+)$/m)?.[1] ?? slug;
    return { path, slug, title, markdown, yaml };
  });
  const slugs = new Set<string>(['index']);
  for (const { slug } of recipes) {
    if (slugs.has(slug))
      throw new Error(`Duplicate recipe route: recipes/${slug}`);
    slugs.add(slug);
  }
  // Fetch and validate everything before replacing generated inputs.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const recipe of recipes) {
    const file = new URL(`${recipe.slug}.md`, output);
    await mkdir(new URL('.', file), { recursive: true });
    const metadata = frontmatter({
      ...(!/^title:/m.test(recipe.yaml) ? { title: recipe.title } : {}),
      engineeringPath: recipe.path,
      sidebar: {
        order: recipe.path.startsWith('docs/best-practices/') ? 0 : 1,
      },
      editUrl: false,
    });
    await writeFile(
      file,
      metadata.replace(/---\n\n$/, `${recipe.yaml}\n---\n\n`) +
        stripFrontmatter(recipe.markdown),
    );
  }
  await writeFile(
    new URL('index.md', output),
    frontmatter({
      title: 'Recipes',
      description: 'Engineering recipes and best practices from Pinelab.',
      sidebar: { hidden: true },
      editUrl: false,
    }) +
      recipes
        .map(
          ({ title, slug }) => `- [${markdownLabel(title)}](/recipes/${slug}/)`,
        )
        .join('\n') +
      '\n',
  );
  console.log(
    `Generated Starlight documentation for ${recipes.length} recipes.`,
  );
}

await generatePluginDocs();
await generateRecipeDocs();
