import { ContentCheckMessage } from '../types';

/**
 * @description
 * Validates that the resolved URL is present in the parsed sitemap URL set.
 */
export function checkSitemapInclusion(
  resolvedUrl: string,
  sitemapUrls: Set<string>
): ContentCheckMessage[] {
  if (sitemapUrls.has(resolvedUrl)) {
    return [];
  }
  return [
    {
      source: 'sitemap',
      severity: 'error',
      code: 'SITEMAP_URL_MISSING',
      message: `URL '${resolvedUrl}' was not found in the configured sitemap.`,
    },
  ];
}

/**
 * @description
 * Builds the error message used when the sitemap itself could not be
 * fetched or parsed. Recorded for each entity affected by that sitemap.
 */
export function sitemapUnavailableMessage(reason: string): ContentCheckMessage {
  return {
    source: 'sitemap',
    severity: 'error',
    code: 'SITEMAP_UNAVAILABLE',
    message: `Sitemap could not be checked: ${reason}`,
  };
}
