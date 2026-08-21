import { Injectable } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export type SitemapFetchResult =
  | { ok: true; urls: Set<string> }
  | { ok: false; error: string };

interface ParsedUrlset {
  urlset: { url?: { loc?: string } | Array<{ loc?: string }> };
}
interface ParsedSitemapIndex {
  sitemapindex: {
    sitemap?: { loc?: string } | Array<{ loc?: string }>;
  };
}

/**
 * @description
 * Fetches and parses a sitemap URL, transparently following `<sitemapindex>`
 * child sitemaps. Never throws — failures are returned as a typed
 * `{ ok: false }` result. A broken child sitemap is skipped rather than
 * failing the whole fetch, so other children still contribute their URLs.
 */
@Injectable()
export class SitemapFetcher {
  private readonly parser = new XMLParser({ ignoreAttributes: false });

  async fetch(url: string, timeoutMs = 10000): Promise<SitemapFetchResult> {
    return this.fetchRecursive(url, timeoutMs, new Set());
  }

  private async fetchRecursive(
    url: string,
    timeoutMs: number,
    visited: Set<string>
  ): Promise<SitemapFetchResult> {
    if (visited.has(url)) {
      return { ok: true, urls: new Set() };
    }
    visited.add(url);

    let xml: string;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status < 200 || response.status >= 300) {
        return {
          ok: false,
          error: `Failed to fetch sitemap '${url}': received non-2xx status ${response.status}.`,
        };
      }
      xml = await response.text();
    } catch (e) {
      const err = e as { message?: string };
      return {
        ok: false,
        error: `Failed to fetch sitemap '${url}': ${
          err?.message ?? 'unknown error'
        }`,
      };
    }

    const validation = XMLValidator.validate(xml);
    if (validation !== true) {
      return {
        ok: false,
        error: `Failed to parse sitemap '${url}' as XML: ${validation.err.msg}`,
      };
    }

    let parsed: Partial<ParsedUrlset & ParsedSitemapIndex>;
    try {
      parsed = this.parser.parse(xml) as Partial<
        ParsedUrlset & ParsedSitemapIndex
      >;
    } catch (e) {
      const err = e as { message?: string };
      return {
        ok: false,
        error: `Failed to parse sitemap '${url}' as XML: ${
          err?.message ?? 'unknown error'
        }`,
      };
    }

    if (parsed?.sitemapindex) {
      const childEntries = toArray(parsed.sitemapindex.sitemap);
      const urls = new Set<string>();
      for (const entry of childEntries) {
        const childUrl = entry?.loc;
        if (typeof childUrl !== 'string') {
          continue;
        }
        const childResult = await this.fetchRecursive(
          childUrl,
          timeoutMs,
          visited
        );
        if (childResult.ok) {
          childResult.urls.forEach((u) => urls.add(u));
        }
        // A broken child sitemap is isolated: skip it, keep the rest.
      }
      return { ok: true, urls };
    }

    if (parsed?.urlset) {
      const urlEntries = toArray(parsed.urlset.url);
      const urls = new Set<string>();
      for (const entry of urlEntries) {
        if (typeof entry?.loc === 'string') {
          urls.add(entry.loc);
        }
      }
      return { ok: true, urls };
    }

    return {
      ok: false,
      error: `Sitemap '${url}' is not a valid <urlset> or <sitemapindex> document.`,
    };
  }
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
