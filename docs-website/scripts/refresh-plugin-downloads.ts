import { writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { getPlugins } from '../src/utils/plugins.ts';

/** Refresh npm popularity separately from builds, preserving the snapshot on API errors. */
async function refreshPluginDownloads() {
  const plugins = (await getPlugins()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const downloads: Record<string, number> = {};
  for (const [index, plugin] of plugins.entries()) {
    // Scoped npm packages require individual requests. Avoid concurrent API traffic.
    if (index > 0) await setTimeout(1_500);
    const response = await fetch(
      `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(
        plugin.name,
      )}`,
      { signal: AbortSignal.timeout(30_000) },
    );
    if (!response.ok) {
      throw new Error(
        `Unable to fetch npm downloads for ${plugin.name} (${response.status}). Existing snapshot unchanged.`,
      );
    }
    const data = (await response.json()) as { downloads?: number };
    if (
      typeof data.downloads !== 'number' ||
      !Number.isInteger(data.downloads) ||
      data.downloads < 0
    ) {
      throw new Error(
        `Invalid npm download count for ${plugin.name}. Existing snapshot unchanged.`,
      );
    }
    downloads[plugin.name] = data.downloads;
    console.log(`${plugin.name}: ${data.downloads}`);
  }
  await writeFile(
    new URL('../plugin-downloads.json', import.meta.url),
    `${JSON.stringify(
      { updatedAt: new Date().toISOString(), period: 'last-month', downloads },
      null,
      2,
    )}\n`,
  );
  console.log(`Updated download counts for ${plugins.length} plugins.`);
}

await refreshPluginDownloads();
