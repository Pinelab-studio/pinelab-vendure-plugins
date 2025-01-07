import { SimpleGraphQLClient, testConfig } from '@vendure/testing';
import { readdir, readFile } from 'fs/promises';
import gql from 'graphql-tag';
import path from 'path';

/**
 * This script compares local plugins with the content on the Vendure Hub (https://hub.vendure.io/admin/)
 *
 * 3. Print all plugins to be created: that are not on the Hub, but exist locally.
 * 4. Print all plugins to be deleted: that exists on the Hub, but not locally.
 *
 * @example
 * npx tsx ./check-vendure-hub-plugins.ts
 */

const hubUrl = 'https://hub.vendure.io/shop-api/';
testConfig.apiOptions.channelTokenKey = undefined;
const client = new SimpleGraphQLClient(testConfig, hubUrl);

(async () => {
  const localPackageNames = await getLocalPackageNames();
  const plugins = await getPinelabPluginsInHub();

  const pluginsToBeCreated = localPackageNames.filter(
    (localName) =>
      !plugins.some((plugin) => plugin.customFields.packageName === localName)
  );
  const pluginsToBeDeleted = plugins
    .filter(
      (plugin) => !localPackageNames.includes(plugin.customFields.packageName)
    )
    .map((plugin) => plugin.customFields.packageName);

  console.log(
    '\x1b[32mPlugins to be created on Hub: \n ',
    pluginsToBeCreated.join('\n  ')
  );
  console.log(
    '\x1b[31mPlugins to be deleted from Hub: \n ',
    pluginsToBeDeleted.join('\n  ')
  );
})();

async function getPinelabPluginsInHub(): Promise<Plugin[]> {
  const result = await client.query(gql`
    {
      products(
        options: {
          take: 100
          filter: { repositoryUrl: { contains: "pinelab" } }
        }
      ) {
        totalItems
        items {
          id
          name
          customFields {
            packageName
            repositoryUrl
          }
        }
      }
    }
  `);
  return result.products.items;
}

/**
 * Get all package names of the local plugins in packages/*
 */
async function getLocalPackageNames(): Promise<string[]> {
  const packageDir = './packages/';
  const pluginDirectories = (await readdir(packageDir, { withFileTypes: true }))
    .filter((dir) => dir.isDirectory())
    .filter((dir) => dir.name.startsWith('vendure-'));
  return await Promise.all(
    pluginDirectories.map(async (pluginDir) => {
      const packageJsonFilePath = path.join(
        packageDir,
        pluginDir.name,
        'package.json'
      );
      const packageJson = JSON.parse(
        await readFile(packageJsonFilePath, 'utf8')
      );
      return packageJson.name;
    })
  );
}

interface Plugin {
  id: string;
  name: string;
  customFields: {
    packageName: string;
    repositoryUrl: string;
  };
}
