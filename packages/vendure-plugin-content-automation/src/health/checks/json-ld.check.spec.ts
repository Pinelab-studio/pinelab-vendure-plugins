import { describe, expect, it } from 'vitest';
import { checkJsonLdTypes, validateJsonLd } from './json-ld.check';

describe('checkJsonLdTypes', () => {
  describe('product', () => {
    it('flags a missing Product type', () => {
      const messages = checkJsonLdTypes('product', [
        'ProductGroup',
        'BreadcrumbList',
        'Organization',
      ]);
      expect(
        messages.some(
          (m) =>
            m.code === 'JSON_LD_MISSING_TYPE' &&
            m.message.includes("'Product'"),
        ),
      ).toBe(true);
    });

    it('flags a missing ProductGroup type', () => {
      const messages = checkJsonLdTypes('product', [
        'Product',
        'BreadcrumbList',
        'Organization',
      ]);
      expect(messages.some((m) => m.message.includes('ProductGroup'))).toBe(
        true,
      );
    });

    it('flags a missing BreadcrumbList type', () => {
      const messages = checkJsonLdTypes('product', [
        'Product',
        'ProductGroup',
        'Organization',
      ]);
      expect(messages.some((m) => m.message.includes('BreadcrumbList'))).toBe(
        true,
      );
    });

    it('flags when both Organization and OnlineStore are missing', () => {
      const messages = checkJsonLdTypes('product', [
        'Product',
        'ProductGroup',
        'BreadcrumbList',
      ]);
      expect(
        messages.some(
          (m) => m.code === 'JSON_LD_MISSING_ORGANIZATION_OR_ONLINE_STORE',
        ),
      ).toBe(true);
    });

    it('accepts OnlineStore as an alternative to Organization', () => {
      const messages = checkJsonLdTypes('product', [
        'Product',
        'ProductGroup',
        'BreadcrumbList',
        'OnlineStore',
      ]);
      expect(messages).toEqual([]);
    });

    it('produces no errors when all required types are present', () => {
      const messages = checkJsonLdTypes('product', [
        'Product',
        'ProductGroup',
        'BreadcrumbList',
        'Organization',
      ]);
      expect(messages).toEqual([]);
    });

    it('every message is an error, never a warning', () => {
      const messages = checkJsonLdTypes('product', []);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.every((m) => m.severity === 'error')).toBe(true);
    });
  });

  describe('collection', () => {
    it('flags a missing BreadcrumbList type', () => {
      const messages = checkJsonLdTypes('collection', []);
      expect(messages).toHaveLength(1);
      expect(messages[0].code).toBe('JSON_LD_MISSING_TYPE');
    });

    it('produces no errors when BreadcrumbList is present', () => {
      expect(checkJsonLdTypes('collection', ['BreadcrumbList'])).toEqual([]);
    });
  });
});

describe('validateJsonLd', () => {
  const productTypes = [
    { '@type': 'Product' },
    { '@type': 'ProductGroup' },
    { '@type': 'BreadcrumbList' },
    { '@type': 'Organization' },
  ];

  function page(...blocks: string[]): string {
    return `<html><head>${blocks
      .map((b) => `<script type="application/ld+json">${b}</script>`)
      .join('')}</head></html>`;
  }

  it('accepts a product page with every required type', () => {
    expect(
      validateJsonLd(
        page(JSON.stringify({ '@graph': productTypes })),
        'product',
      ),
    ).toEqual([]);
  });

  it('reports a missing required type', () => {
    expect(
      validateJsonLd(page(JSON.stringify(productTypes.slice(1))), 'product'),
    ).toEqual([
      {
        source: 'json-ld',
        severity: 'error',
        code: 'JSON_LD_MISSING_TYPE',
        message: "Required JSON-LD type 'Product' was not found on the page.",
      },
    ]);
  });

  it('reports a malformed block next to the valid ones', () => {
    expect(
      validateJsonLd(
        page(JSON.stringify([{ '@type': 'BreadcrumbList' }]), '{"@type": '),
        'collection',
      ),
    ).toEqual([
      {
        source: 'json-ld',
        severity: 'error',
        code: 'JSON_LD_MALFORMED',
        message: 'JSON-LD block 2 on the page is not valid JSON.',
      },
    ]);
  });
});
