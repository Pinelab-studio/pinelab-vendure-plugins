import { it, expect, beforeEach, afterAll } from 'vitest';
import { RemoteAssetDownloader } from './remote-asset-downloader';
import fs from 'fs';
import path from 'path';
import nock from 'nock';

const TEST_DIR = path.join('./dist/public/');
const CACHE_DIR = path.join('./dist/.cache/');
let scope: nock.Scope;

beforeEach(() => {
  // Setup nock
  scope = nock('https://example.com')
    .persist()
    .get(/\/assets\/.*/)
    .reply(200, Buffer.from('R0lGODlhAQABAAAAACw='));
});

afterAll(() => {
  // Clean up test directory and nock
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  nock.cleanAll();
});

const downloader = new RemoteAssetDownloader({
  publicAssetDirectory: TEST_DIR,
  subDirectory: 'assets',
  cacheDirectory: CACHE_DIR,
  getRemoteUrl: (assetId) => `https://example.com/assets/${assetId}`,
});

it('Downloads new asset', async () => {
  const result = await downloader.getAsset('123', {
    fileName: 'test-image.webp',
  });

  expect(result).toBe('/assets/123_test-image.webp');
  expect(scope.isDone()).toBe(true);
  expect(
    fs.existsSync(path.join(TEST_DIR, 'assets', '123_test-image.webp'))
  ).toBe(true);
  // Also expect to be in cache folder
  expect(fs.existsSync(path.join(CACHE_DIR, '123_test-image.webp'))).toBe(true);
});

it('Returns existing cached asset', async () => {
  // Create an existing asset file
  fs.mkdirSync(path.join(CACHE_DIR), { recursive: true });
  const filePath = path.join(CACHE_DIR, '123_existing.webp');
  fs.writeFileSync(filePath, 'existing-content');
  const result = await downloader.getAsset('123', {
    fileName: 'existing.webp',
  });
  expect(result).toBe('/assets/123_existing.webp');
  expect(scope.pendingMocks().length).toBe(1); // No requests made
});

it('Returns remote URL when downloadRemoteAsset is false', async () => {
  const noDownloadDownloader = new RemoteAssetDownloader({
    publicAssetDirectory: TEST_DIR,
    subDirectory: '/doesnt-matter/',
    cacheDirectory: CACHE_DIR,
    getRemoteUrl: (assetId) => `https://example.com/assets/${assetId}`,
    downloadRemoteAsset: false,
  });
  const result = await noDownloadDownloader.getAsset('123', {
    fileName: 'test.webp',
    transformationArguments: '?resize=200x200',
  });
  expect(result).toBe('https://example.com/assets/123?resize=200x200');
  expect(scope.pendingMocks().length).toBe(1); // No requests made
});

it('Strips unsafe characters from filename', async () => {
  const result = await downloader.getAsset('123', {
    fileName: 'Test @#$File.webp',
  });

  expect(result).toBe('/assets/123_test____file.webp');
});
