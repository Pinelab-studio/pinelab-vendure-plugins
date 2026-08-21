import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SitemapFetcher } from './sitemap-fetcher';

describe('SitemapFetcher', () => {
  const fetcher = new SitemapFetcher();
  let mockAgent: MockAgent;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(async () => {
    await mockAgent.close();
  });

  it('returns the URL set for a valid urlset sitemap', async () => {
    const client = mockAgent.get('https://shop.example.com');
    client
      .intercept({ path: '/sitemap.xml', method: 'GET' })
      .reply(
        200,
        `<?xml version="1.0"?><urlset><url><loc>https://shop.example.com/a</loc></url><url><loc>https://shop.example.com/b</loc></url></urlset>`
      );

    const result = await fetcher.fetch('https://shop.example.com/sitemap.xml');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.urls.has('https://shop.example.com/a')).toBe(true);
      expect(result.urls.has('https://shop.example.com/b')).toBe(true);
      expect(result.urls.size).toBe(2);
    }
  });

  it('fails when the sitemap is unavailable', async () => {
    const client = mockAgent.get('https://shop.example.com');
    client.intercept({ path: '/sitemap.xml', method: 'GET' }).reply(500);

    const result = await fetcher.fetch('https://shop.example.com/sitemap.xml');

    expect(result.ok).toBe(false);
  });

  it('fails when the sitemap is malformed', async () => {
    const client = mockAgent.get('https://shop.example.com');
    client
      .intercept({ path: '/sitemap.xml', method: 'GET' })
      .reply(200, 'this is not xml at all {{{ <<<');

    const result = await fetcher.fetch('https://shop.example.com/sitemap.xml');

    expect(result.ok).toBe(false);
  });

  it('follows a sitemap index and isolates a broken child sitemap', async () => {
    const client = mockAgent.get('https://shop.example.com');
    client
      .intercept({ path: '/sitemap.xml', method: 'GET' })
      .reply(
        200,
        `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://shop.example.com/sitemap-a.xml</loc></sitemap><sitemap><loc>https://shop.example.com/sitemap-b.xml</loc></sitemap></sitemapindex>`
      );
    client
      .intercept({ path: '/sitemap-a.xml', method: 'GET' })
      .reply(
        200,
        `<?xml version="1.0"?><urlset><url><loc>https://shop.example.com/a</loc></url></urlset>`
      );
    client.intercept({ path: '/sitemap-b.xml', method: 'GET' }).reply(500);

    const result = await fetcher.fetch('https://shop.example.com/sitemap.xml');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.urls.has('https://shop.example.com/a')).toBe(true);
      expect(result.urls.size).toBe(1);
    }
  });
});
