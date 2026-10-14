import { describe, expect, it } from 'vitest';
import {
  defaultHash,
  findDuplicates,
  MAX_HASH_LENGTH,
  normalizeHash,
  stableStringify,
} from './util';

describe('stableStringify', () => {
  it('Sorts object keys at every level', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}'
    );
  });

  it('Keeps the order of arrays', () => {
    expect(stableStringify({ list: [2, 1, { b: 1, a: 2 }] })).toBe(
      '{"list":[2,1,{"a":2,"b":1}]}'
    );
  });
});

describe('defaultHash', () => {
  it('Returns the same hash regardless of key order', () => {
    expect(defaultHash({ id: 1, text: 'a' })).toBe(
      defaultHash({ text: 'a', id: 1 })
    );
  });

  it('Returns a different hash when a value changes', () => {
    expect(defaultHash({ id: 1, text: 'a' })).not.toBe(
      defaultHash({ id: 1, text: 'b' })
    );
  });

  it('Returns a different hash for a different id', () => {
    expect(defaultHash({ id: 1, text: 'a' })).not.toBe(
      defaultHash({ id: 2, text: 'a' })
    );
  });
});

describe('normalizeHash', () => {
  it('Keeps hashes that fit the column', () => {
    const hash = 'a'.repeat(MAX_HASH_LENGTH);
    expect(normalizeHash(hash)).toBe(hash);
  });

  it('Hashes values that are too long for the column', () => {
    const tooLong = 'a'.repeat(MAX_HASH_LENGTH + 1);
    const normalized = normalizeHash(tooLong);
    expect(normalized).toHaveLength(64);
    expect(normalized).toBe(normalizeHash(tooLong));
    expect(normalized).not.toBe(normalizeHash('b'.repeat(MAX_HASH_LENGTH + 1)));
  });
});

describe('findDuplicates', () => {
  it('Returns names that occur more than once', () => {
    expect(findDuplicates(['a', 'b', 'a', 'c'])).toEqual(['a']);
  });

  it('Returns an empty array when all names are unique', () => {
    expect(findDuplicates(['a', 'b'])).toEqual([]);
  });
});
