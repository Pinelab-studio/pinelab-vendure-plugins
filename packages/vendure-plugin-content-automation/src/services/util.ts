import { createHash } from 'node:crypto';

/**
 * Serializes a value to JSON with object keys sorted at every level, so the
 * same data always results in the same string, regardless of key order.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((sorted, key) => {
          sorted[key] = obj[key];
          return sorted;
        }, {});
    }
    return val;
  });
}

/**
 * The default hash of a strategy input: a SHA-256 hash of all its fields.
 */
export function defaultHash(input: unknown): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

/**
 * The maximum length of the `hash` column of `ContentAutomationUpdate`.
 */
export const MAX_HASH_LENGTH = 191;

/**
 * Makes sure a hash fits the `hash` column: hashes longer than `MAX_HASH_LENGTH`,
 * e.g. from a custom `generateHash()` that concatenates fields, are replaced by
 * their SHA-256 hash. Otherwise storing the state would fail after the content
 * was already generated, and the content would be regenerated on every run.
 */
export function normalizeHash(hash: string): string {
  return hash.length > MAX_HASH_LENGTH
    ? createHash('sha256').update(hash).digest('hex')
    : hash;
}

/**
 * Returns the names that occur more than once.
 */
export function findDuplicates(names: string[]): string[] {
  return names.filter((name, index) => names.indexOf(name) !== index);
}
