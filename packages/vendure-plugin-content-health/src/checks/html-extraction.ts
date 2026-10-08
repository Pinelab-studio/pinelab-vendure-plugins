import * as cheerio from 'cheerio';

export interface HreflangTag {
  hreflang: string;
  href: string;
}

/**
 * @description
 * Extracts the `<title>` text of a rendered page. Returns `undefined` when
 * there is no title element or it is empty.
 */
export function extractTitle(html: string): string | undefined {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();
  return title.length ? title : undefined;
}

/**
 * @description
 * Extracts the `<meta name="description">` content of a rendered page.
 * Returns `undefined` when there is no such tag or it is empty.
 */
export function extractMetaDescription(html: string): string | undefined {
  const $ = cheerio.load(html);
  const content = $('meta[name="description"]').first().attr('content');
  const trimmed = content?.trim();
  return trimmed?.length ? trimmed : undefined;
}

/**
 * @description
 * Extracts all `<link rel="alternate" hreflang="..." href="...">` tags of a
 * rendered page, including an `x-default` entry if present.
 */
export function extractHreflangTags(html: string): HreflangTag[] {
  const $ = cheerio.load(html);
  const tags: HreflangTag[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const hreflang = $(el).attr('hreflang');
    const href = $(el).attr('href');
    if (hreflang && href) {
      tags.push({ hreflang, href });
    }
  });
  return tags;
}

/**
 * @description
 * Extracts the set of schema.org `@type` values found across every
 * `<script type="application/ld+json">` block on a rendered page, including
 * nested `@graph` arrays. Malformed JSON-LD blocks are ignored, as if their
 * types were simply absent.
 */
export function extractJsonLdTypes(html: string): string[] {
  const $ = cheerio.load(html);
  const types = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw?.trim()) {
      return;
    }
    try {
      const json: unknown = JSON.parse(raw);
      collectTypes(json, types);
    } catch {
      // Malformed JSON-LD block: ignore, treated as if its types are absent.
    }
  });
  return [...types];
}

function collectTypes(node: unknown, types: Set<string>): void {
  if (Array.isArray(node)) {
    node.forEach((n) => collectTypes(n, types));
    return;
  }
  if (!node || typeof node !== 'object') {
    return;
  }
  const obj = node as Record<string, unknown>;
  const typeValue = obj['@type'];
  if (typeof typeValue === 'string') {
    types.add(typeValue);
  } else if (Array.isArray(typeValue)) {
    typeValue.forEach((t) => typeof t === 'string' && types.add(t));
  }
  if (Array.isArray(obj['@graph'])) {
    collectTypes(obj['@graph'], types);
  }
}
