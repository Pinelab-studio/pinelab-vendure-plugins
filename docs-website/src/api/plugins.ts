import { readdir, readFile } from 'fs/promises';
import type { Dirent } from 'node:fs';
import path from 'path';

interface PackageJson {
  name: string;
  description: string;
  versione: string;
  // TODO icon
}

interface Plugin {
  name: string;
  npmName: string;
  description: string;
  icon: string;
  markdownContent: string;
}

const pluginDirName = '../packages/';

export async function getPluginDirectories(): Promise<Dirent[]> {
  return (await readdir(pluginDirName, { withFileTypes: true }))
    .filter((dir) => dir.isDirectory())
    .filter((dir) => dir.name.startsWith('vendure-plugin'));
}

export async function getPackageJsons(): Promise<PackageJson[]> {
  const pluginDirectories = await getPluginDirectories();
  const allPackageDotJsonPaths = pluginDirectories.map((r) =>
    path.join(pluginDirName, r.name, 'package.json')
  );
  return await Promise.all(
    allPackageDotJsonPaths
      .map(async (p) => {
        try {
          return JSON.parse(await readFile(p, 'utf8'));
        } catch (e) {
          throw Error(`Unable to parse "${p}"`);
        }
      })
      .filter((v: any) => v !== undefined)
  );
}

// TODO combine readme and package.json into 1 single `Plugin` type
export async function getPlugins(): Promise<Plugin[]> {
  return [];
}
