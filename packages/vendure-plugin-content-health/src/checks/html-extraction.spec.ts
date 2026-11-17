import { describe, expect, it } from 'vitest';
import { extractLinks } from './html-extraction';

describe('extractLinks', () => {
  it('returns each distinct absolute link without fragments', () => {
    const html = `<a href="/nl/c/tuin/">Tuin</a>
      <a href="/nl/c/tuin/#top">Top</a>
      <a href="https://other.test/x">Other</a>
      <a href="mailto:info@shop.test">Mail</a>
      <a>No href</a>`;

    expect(extractLinks(html, 'https://shop.test/nl/product/p/')).toEqual([
      'https://shop.test/nl/c/tuin/',
      'https://other.test/x',
    ]);
  });
});
