import { Logger } from '@vendure/core';

/**
 * Truncate job data to max 32kb, to prevent too large payloads in the database
 */
export function truncateData(
  data: any,
  queueName: string,
  maxSizeInKB = 64 // Default to 64kb
): any {
  const MAX_BYTES = maxSizeInKB * 1024;

  const byteLength = (value: unknown): number => {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return Number.MAX_SAFE_INTEGER;
    }
  };

  const originalBytes = byteLength(data);
  if (originalBytes <= MAX_BYTES) {
    return data;
  }

  // Deep-clone and ensure we have a plain object to manipulate
  let working: any;
  try {
    working = JSON.parse(JSON.stringify(data));
  } catch {
    working = undefined;
  }

  if (!working || typeof working !== 'object' || Array.isArray(working)) {
    Logger.warn(
      `Job data for queue '${queueName}' is not a plain object or too large (${originalBytes} bytes). Returning empty object.`
    );
    return {};
  }

  // Remove the largest top-level keys until under threshold or no keys remain
  while (byteLength(working) > MAX_BYTES) {
    const keys = Object.keys(working);
    if (keys.length === 0) break;
    let largestKey = keys[0];
    let largestSize = -1;
    for (const key of keys) {
      const size = byteLength(working[key]);
      if (size > largestSize) {
        largestSize = size;
        largestKey = key;
      }
    }
    delete working[largestKey];
  }

  const finalBytes = byteLength(working);
  if (finalBytes > MAX_BYTES) {
    Logger.warn(
      `Job data for queue '${queueName}' is too large (${originalBytes} bytes) and could not be reduced below ${MAX_BYTES} bytes by removing top-level keys. Returning empty object.`
    );
    return {};
  }

  Logger.warn(
    `Truncated job data for queue '${queueName}' from ${originalBytes} bytes to ${finalBytes} bytes by removing top-level keys.`
  );
  return working;
}
