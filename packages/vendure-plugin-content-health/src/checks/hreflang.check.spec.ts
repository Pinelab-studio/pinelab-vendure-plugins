import { describe, expect, it } from 'vitest';
import { checkHreflang } from './hreflang.check';

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
      true
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
      true
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
      true
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
