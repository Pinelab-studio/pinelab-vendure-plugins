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
 * Extracts the distinct absolute URLs of all `<a href>` links on a rendered
 * page, resolved against `pageUrl` and without fragments. Links that are not
 * `http(s)`, such as `mailto:` and `tel:`, are omitted.
 */
export function extractLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) {
      return;
    }
    let url: URL;
    try {
      url = new URL(href, pageUrl);
    } catch {
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return;
    }
    url.hash = '';
    links.add(url.href);
  });
  return [...links];
}

/**
 * @description
 * Extracts the set of schema.org `@type` values found across every
 * `<script type="application/ld+json">` block on a rendered page, including
 * nested `@graph` arrays. Malformed JSON-LD blocks are ignored, as if their
 * types were simply absent.
 */
export function extractJsonLdTypes(html: string): string[] {
  return extractJsonLd(html).types;
}

/**
 * @description
 * Like `extractJsonLdTypes`, but also returns the 1-based positions of the
 * non-empty `<script type="application/ld+json">` blocks that are not valid
 * JSON.
 */
export function extractJsonLd(html: string): {
  types: string[];
  malformedBlocks: number[];
} {
  const $ = cheerio.load(html);
  const types = new Set<string>();
  const malformedBlocks: number[] = [];
  $('script[type="application/ld+json"]').each((index, el) => {
    const raw = $(el).contents().text();
    if (!raw?.trim()) {
      return;
    }
    try {
      const json: unknown = JSON.parse(raw);
      collectTypes(json, types);
    } catch {
      malformedBlocks.push(index + 1);
    }
  });
  return { types: [...types], malformedBlocks };
}

function collectTypes(node: unknown, types: Set<string>): void {
  if (Array.isArray(node)) {
    node.forEach((n) => {
      collectTypes(n, types);
    });
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
    typeValue.forEach((t) => {
      if (typeof t === 'string') types.add(t);
    });
  }
  if (Array.isArray(obj['@graph'])) {
    collectTypes(obj['@graph'], types);
  }
}
