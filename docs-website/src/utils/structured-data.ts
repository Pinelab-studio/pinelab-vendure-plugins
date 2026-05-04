import type { Plugin } from './plugins';

/**
 * Helpers that build JSON-LD structured data objects for the plugin docs site.
 * All builders return plain JS objects so callers can compose them into a
 * single `<script type="application/ld+json">` payload (array or @graph).
 *
 * Schema reference: https://schema.org
 */

const SITE_URL = 'https://plugins.pinelab.studio';
const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * Pinelab Studio organization. Referenced as `publisher`/`author` from
 * other schema objects via `@id`.
 */
export function buildOrganization(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Pinelab Studio',
    url: 'https://pinelab.studio',
    logo: `${SITE_URL}/pinelab-plugins-logo.png`,
    sameAs: [
      'https://www.linkedin.com/company/pinelab-studio',
      'https://github.com/Pinelab-studio',
    ],
  };
}

/**
 * Site-wide WebSite object. Anchors page URLs to the site identity.
 */
export function buildWebSite(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: 'Pinelab Vendure Plugins',
    publisher: { '@id': ORG_ID },
  };
}

/**
 * Returns absolute URL for a plugin's canonical page.
 */
function pluginUrl(plugin: Plugin): string {
  return `${SITE_URL}/plugin/${plugin.slug}`;
}

/**
 * SoftwareApplication + SoftwareSourceCode hybrid for a single plugin.
 */
export function buildSoftwareApplication(
  plugin: Plugin
): Record<string, unknown> {
  const url = pluginUrl(plugin);
  const repo = `https://github.com/Pinelab-studio/pinelab-vendure-plugins/`;
  const npmUrl = `https://www.npmjs.com/package/${plugin.npmName}`;
  return {
    '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
    '@id': `${url}#software`,
    name: plugin.name,
    description: plugin.description,
    url,
    image: `${SITE_URL}${plugin.icon}`,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Vendure Plugin',
    operatingSystem: 'Cross-platform',
    softwareVersion: plugin.version,
    softwareRequirements: plugin.compatibility
      ? `Vendure ${plugin.compatibility}`
      : 'Vendure',
    programmingLanguage: 'TypeScript',
    codeRepository: repo,
    downloadUrl: npmUrl,
    installUrl: npmUrl,
    license: 'https://opensource.org/licenses/MIT',
    keywords: plugin.keywords?.join(', '),
    dateModified: plugin.lastModified,
    author: {
      '@type': 'Person',
      name: plugin.author.name,
      ...(plugin.author.email ? { email: plugin.author.email } : {}),
      ...(plugin.author.url ? { url: plugin.author.url } : {}),
    },
    publisher: { '@id': ORG_ID },
  };
}

/**
 * Generic BreadcrumbList builder.
 */
export function buildBreadcrumbs(
  items: Array<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * TechArticle for a plugin's changelog page. References the plugin's
 * SoftwareApplication via `about`.
 */
export function buildChangelogArticle(plugin: Plugin): Record<string, unknown> {
  const url = `${pluginUrl(plugin)}/changelog`;
  return {
    '@type': 'TechArticle',
    '@id': `${url}#article`,
    headline: `Changelog for ${plugin.name}`,
    url,
    articleSection: 'Changelog',
    inLanguage: 'en',
    dateModified: plugin.lastModified,
    about: { '@id': `${pluginUrl(plugin)}#software` },
    author: {
      '@type': 'Person',
      name: plugin.author.name,
    },
    publisher: { '@id': ORG_ID },
  };
}

/**
 * ItemList of all plugins for the homepage.
 */
export function buildPluginItemList(
  plugins: Plugin[]
): Record<string, unknown> {
  return {
    '@type': 'ItemList',
    name: 'Pinelab Vendure Plugins',
    numberOfItems: plugins.length,
    itemListElement: plugins.map((plugin, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: pluginUrl(plugin),
      name: plugin.name,
    })),
  };
}

/**
 * Wraps multiple schema objects into a single JSON-LD `@graph` payload.
 */
export function buildGraph(
  nodes: Array<Record<string, unknown>>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}
