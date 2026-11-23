import { describe, expect, it } from 'vitest';
import { checkHreflang, validateHreflang } from './hreflang.check';

describe('checkHreflang', () => {
  const pageUrl = 'https://shop.example.com/en/products/foo';
  const nlUrl = 'https://shop.example.com/nl/products/foo';

  it('warns when an enabled language is missing from the hreflang set', () => {
    const messages = checkHreflang({
      pageUrl,
      hreflangTags: [
        { hreflang: 'en', href: pageUrl },
        { hreflang: 'x-default', href: pageUrl },
      ],
      enabledLanguageCodes: ['en', 'nl'],
      linkedPageTags: new Map(),
    });
    expect(messages.some((m) => m.code === 'HREFLANG_MISSING_LANGUAGE')).toBe(
      true,
    );
    expect(messages.every((m) => m.severity === 'warning')).toBe(true);
  });

  it('warns when a linked page does not link back (non-reciprocal)', () => {
    const messages = checkHreflang({
      pageUrl,
      hreflangTags: [
        { hreflang: 'en', href: pageUrl },
        { hreflang: 'nl', href: nlUrl },
        { hreflang: 'x-default', href: pageUrl },
      ],
      enabledLanguageCodes: ['en', 'nl'],
      linkedPageTags: new Map([
        [nlUrl, [{ hreflang: 'en', href: 'https://other.example.com' }]],
      ]),
    });
    expect(messages.some((m) => m.code === 'HREFLANG_NOT_RECIPROCAL')).toBe(
      true,
    );
  });

  it('warns when x-default is missing', () => {
    const messages = checkHreflang({
      pageUrl,
      hreflangTags: [
        { hreflang: 'en', href: pageUrl },
        { hreflang: 'nl', href: nlUrl },
      ],
      enabledLanguageCodes: ['en', 'nl'],
      linkedPageTags: new Map([[nlUrl, [{ hreflang: 'en', href: pageUrl }]]]),
    });
    expect(messages.some((m) => m.code === 'HREFLANG_MISSING_X_DEFAULT')).toBe(
      true,
    );
  });

  it('produces no warnings for a fully valid hreflang set', () => {
    const messages = checkHreflang({
      pageUrl,
      hreflangTags: [
        { hreflang: 'en', href: pageUrl },
        { hreflang: 'nl', href: nlUrl },
        { hreflang: 'x-default', href: pageUrl },
      ],
      enabledLanguageCodes: ['en', 'nl'],
      linkedPageTags: new Map([[nlUrl, [{ hreflang: 'en', href: pageUrl }]]]),
    });
    expect(messages).toEqual([]);
  });
});

describe('validateHreflang', () => {
  const en = 'https://shop.test/en/p/';
  const nl = 'https://shop.test/nl/p/';
  function page(...links: Array<[string, string]>): string {
    return `<html><head>${links
      .map(
        ([lang, href]) =>
          `<link rel="alternate" hreflang="${lang}" href="${href}" />`,
      )
      .join('')}</head></html>`;
  }

  it('fetches linked alternates and reports a missing link back', async () => {
    const fetched: string[] = [];
    const messages = await validateHreflang({
      html: page(['en', en], ['nl', nl], ['x-default', en]),
      pageUrl: en,
      enabledLanguageCodes: ['en', 'nl'],
      fetchPage: (url) => {
        fetched.push(url);
        return Promise.resolve({
          ok: true,
          html: page(['nl', nl]),
          finalUrl: url,
        });
      },
    });

    expect(fetched).toEqual([nl]);
    expect(messages.map((m) => m.code)).toEqual(['HREFLANG_NOT_RECIPROCAL']);
  });

  it('accepts complete reciprocal hreflang links', async () => {
    const html = page(['en', en], ['nl', nl], ['x-default', en]);
    const messages = await validateHreflang({
      html,
      pageUrl: en,
      enabledLanguageCodes: ['en', 'nl'],
      fetchPage: (url) => Promise.resolve({ ok: true, html, finalUrl: url }),
    });

    expect(messages).toEqual([]);
  });
});
