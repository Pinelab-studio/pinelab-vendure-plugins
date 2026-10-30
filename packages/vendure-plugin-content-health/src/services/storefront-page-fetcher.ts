import { Injectable } from '@nestjs/common';

export type PageFetchResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; error: string };

export interface PageFetchOptions {
  maxRedirects?: number;
  timeoutMs?: number;
}

/**
 * @description
 * Fetches a storefront page, following redirects up to a configurable
 * maximum and treating any final 2xx response as success. Never throws —
 * failures are returned as a typed `{ ok: false }` result.
 */
@Injectable()
export class StorefrontPageFetcher {
  async fetch(
    url: string,
    options: PageFetchOptions = {},
  ): Promise<PageFetchResult> {
    const maxRedirects = options.maxRedirects ?? 5;
    const timeoutMs = options.timeoutMs ?? 10000;
    // Native `fetch`'s automatic redirect-following has no consumer-tunable
    // cap, so redirects are followed manually here to honor `maxRedirects`.
    // One shared signal covers the whole chain, giving a single time budget
    // for the operation rather than resetting the timeout per redirect hop.
    const signal = AbortSignal.timeout(timeoutMs);
    const visited = new Set<string>();
    let currentUrl = url;
    let redirectsFollowed = 0;

    try {
      for (;;) {
        if (visited.has(currentUrl)) {
          return {
            ok: false,
            error: `Redirect limit of ${maxRedirects} exceeded when fetching '${url}'.`,
          };
        }
        visited.add(currentUrl);

        const response = await fetch(currentUrl, {
          redirect: 'manual',
          signal,
        });

        const location =
          response.status >= 300 && response.status < 400
            ? response.headers.get('location')
            : null;
        if (location) {
          if (redirectsFollowed >= maxRedirects) {
            return {
              ok: false,
              error: `Redirect limit of ${maxRedirects} exceeded when fetching '${url}'.`,
            };
          }
          redirectsFollowed++;
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
        // A redirect without a Location header is a non-2xx final response.

        return await this.readPage(response, url, currentUrl);
      }
    } catch (e) {
      const err = e as { message?: string };
      return {
        ok: false,
        error: `Failed to fetch '${url}': ${err?.message ?? 'unknown error'}`,
      };
    }
  }

  /** Reads only successful final responses, preserving the requested URL in errors. */
  private async readPage(
    response: Response,
    requestedUrl: string,
    finalUrl: string,
  ): Promise<PageFetchResult> {
    if (response.status < 200 || response.status >= 300) {
      return {
        ok: false,
        error: `Received non-2xx status ${response.status} when fetching '${requestedUrl}'.`,
      };
    }
    return { ok: true, html: await response.text(), finalUrl };
  }
}
