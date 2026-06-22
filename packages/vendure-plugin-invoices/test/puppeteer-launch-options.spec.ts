import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildLaunchOptions } from '../src/util/puppeteer.util';

describe('Puppeteer launch options', () => {
  const originalEnv = process.env.PUPPETEER_EXECUTABLE_PATH;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      process.env.PUPPETEER_EXECUTABLE_PATH = originalEnv;
    }
  });

  it('Uses default launch options when no config or env var is set', () => {
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    const options = buildLaunchOptions(undefined);
    expect(options).toEqual({
      headless: true,
      args: ['--no-sandbox'],
    });
  });

  it('Merges puppeteerLaunchOptions from plugin config', () => {
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    const options = buildLaunchOptions({
      executablePath: '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--disable-gpu'],
    });
    expect(options).toEqual({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
      executablePath: '/usr/bin/google-chrome-stable',
    });
  });

  it('Env var PUPPETEER_EXECUTABLE_PATH takes precedence over config', () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';
    const options = buildLaunchOptions({
      executablePath: '/usr/bin/google-chrome-stable',
    });
    expect(options.executablePath).toBe('/usr/bin/chromium-browser');
  });

  it('Env var PUPPETEER_EXECUTABLE_PATH works without plugin config', () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';
    const options = buildLaunchOptions(undefined);
    expect(options).toEqual({
      headless: true,
      args: ['--no-sandbox'],
      executablePath: '/usr/bin/chromium-browser',
    });
  });

  it('Config can override default headless and args', () => {
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    const options = buildLaunchOptions({
      headless: false,
      args: ['--no-sandbox', '--remote-debugging-port=9222'],
      timeout: 60000,
    });
    expect(options.headless).toBe(false);
    expect(options.args).toEqual([
      '--no-sandbox',
      '--remote-debugging-port=9222',
    ]);
    expect(options.timeout).toBe(60000);
  });
});
