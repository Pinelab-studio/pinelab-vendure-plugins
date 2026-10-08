import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorefrontPageFetcher } from './storefront-page-fetcher';

describe('StorefrontPageFetcher', () => {
  const fetcher = new StorefrontPageFetcher();
  let mockAgent: MockAgent;

  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(async () => {
    await mockAgent.close();
  });

  it('succeeds within the redirect limit', async () => {
    const client = mockAgent.get('https://shop.example.com');
    client.intercept({ path: '/a', method: 'GET' }).reply(302, undefined, {
      headers: { location: 'https://shop.example.com/b' },
    });
    client
      .intercept({ path: '/b', method: 'GET' })
      .reply(200, '<html><title>Hi</title></html>');

    const result = await fetcher.fetch('https://shop.example.com/a', {
      maxRedirects: 5,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).toContain('Hi');
    }
  });

  it('fails when the redirect chain exceeds the configured maximum', async () => {
    const client = mockAgent.get('https://shop.example.com');
    client.intercept({ path: '/a', method: 'GET' }).reply(302, undefined, {
      headers: { location: 'https://shop.example.com/b' },
    });
    client.intercept({ path: '/b', method: 'GET' }).reply(302, undefined, {
      headers: { location: 'https://shop.example.com/c' },
    });
    client.intercept({ path: '/c', method: 'GET' }).reply(200, 'ok');

    const result = await fetcher.fetch('https://shop.example.com/a', {
      maxRedirects: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/redirect limit/i);
    }
  });

  it('fails on an unreachable host (connection error)', async () => {
    const client = mockAgent.get('https://shop.example.com');
    client
      .intercept({ path: '/down', method: 'GET' })
      .replyWithError(
        Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
      );

    const result = await fetcher.fetch('https://shop.example.com/down');

    expect(result.ok).toBe(false);
  });

  it('fails on a non-2xx final response', async () => {
    const client = mockAgent.get('https://shop.example.com');
    client
      .intercept({ path: '/missing', method: 'GET' })
      .reply(404, 'not found');

    const result = await fetcher.fetch('https://shop.example.com/missing');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/404/);
    }
  });
});
