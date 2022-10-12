import crypto from 'crypto';
import { Logger } from '@vendure/core';

export interface DecodedLicense {
  iat: number;
  email: string;
  plugin: string;
}

export class InvalidLicenseError extends Error {}

const publicKeyBase64 =
  'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUFsVWRYdGZLT243cEZaTS80VUxXUwphdVB4bDNhL0lIWk1icU5HY2cxRlk1akRSVlo0TmNxbGJwTkdHYVB0bENsSjdNTFczMlRvZE5JY2tWdGpXY0JwCmsvNW5PcFdtZmw2cFNYRzZHMzZjb2txSmZGNmJRY2ZoZmIxNGZKckV3YkNjbVIwYWF1WGQ0UWY5a3BRUEtaTncKQ29rTlpOekxxV2VFdFZXQVBYV2NWZ1R4OXlsa2hoWVhDWmRBZU5OMDVSR0Q0dHhaUTBtQjkwdXkxYWZxcThWYgpwcWtEeUp0cUZRdnlCTnQrUlNMRW9nVERRZjVQbDg4emJaNFR6dHl5OEZ5blpZUnhGa1dsb0lVVStwZVp3cmp4ClNFenlPRFQzUjN1UjJPRDBhRjJYWWd2TFpCdmMrSHBLUG9tbFdTSmVmbHRzQmNZWlRITUlXZmVFN3hUQWZUdlAKNlFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0t';
const publicKey = Buffer.from(publicKeyBase64, 'base64').toString();

export const getLogMessage = (pluginName: string) =>
  `For commercial use of this plugin, please purchase a license at https://pinelab-plugins.com/plugin/${pluginName}`;

// Decode from base64 back to original
function toBuffer(licenseKey: string) {
  return Buffer.from(licenseKey, 'base64');
}

export function decodeLicense(licenseKey: string): DecodedLicense {
  try {
    return JSON.parse(
      crypto.publicDecrypt(publicKey, toBuffer(licenseKey)).toString()
    );
  } catch (e) {
    throw new InvalidLicenseError(
      `Unable to decode license key: ${(e as any)?.message}`
    );
  }
}

export function isValidForPlugin(
  licenseKey: string | undefined,
  pluginName: string
): boolean {
  if (!licenseKey) {
    return false;
  }
  try {
    const decoded = decodeLicense(licenseKey);
    return decoded.plugin === pluginName;
  } catch (e) {
    return false;
  }
}

/**
 * Log a warning if no licensekey given or invalid licenseKey
 */
export function logIfInvalidLicense(
  logger: typeof Logger,
  pluginName: string,
  loggerCtx: string,
  licenseKey?: string
): void {
  const message = getLogMessage(pluginName);
  if (!licenseKey) {
    return logger.warn(message, loggerCtx);
  }
  if (!isValidForPlugin(licenseKey, pluginName)) {
    return logger.warn(message, loggerCtx);
  }
}
