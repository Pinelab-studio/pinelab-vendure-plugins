import { describe, expect, it } from 'vitest';
import { getEansToUpdate, normalizeEans } from './util';

describe('getEansToUpdate', () => {
  it('returns false for identical EAN arrays', () => {
    expect(
      getEansToUpdate({
        existingEans: ['123', '456'],
        desiredEans: ['456', '123'],
      })
    ).toBe(false);
  });

  it('ignores ordering, whitespace and null/undefined when determining additions', () => {
    expect(
      getEansToUpdate({
        existingEans: [null, '123'],
        desiredEans: [' 123', '456 ', undefined, null],
      })
    ).toEqual({
      eansToAdd: ['456'],
      eansToRemove: [],
    });
  });

  it('returns removals when desired array is missing values', () => {
    expect(
      getEansToUpdate({
        existingEans: ['123', '456', null],
        desiredEans: ['123'],
      })
    ).toEqual({
      eansToAdd: [],
      eansToRemove: ['456'],
    });
  });

  it('returns both additions and removals when values differ', () => {
    expect(
      getEansToUpdate({
        existingEans: ['123', '456'],
        desiredEans: ['123', '789'],
      })
    ).toEqual({
      eansToAdd: ['789'],
      eansToRemove: ['456'],
    });
  });

  it('treats undefined arrays as equal', () => {
    expect(
      getEansToUpdate({ existingEans: undefined, desiredEans: undefined })
    ).toBe(false);
  });

  it('treats undefined and empty array as equal', () => {
    // This is the case when creating a new product in QLS
    expect(getEansToUpdate({ existingEans: undefined, desiredEans: [] })).toBe(
      false
    );
  });
});

describe('normalizeEans', () => {
  it('filters and trims invalid values', () => {
    expect(normalizeEans([' 123', '', undefined, null, '456 '])).toEqual([
      '123',
      '456',
    ]);
  });

  it('returns empty array for undefined input', () => {
    expect(normalizeEans(undefined)).toEqual([]);
  });

  it('sorts resulting values alphabetically', () => {
    expect(normalizeEans(['789', '123'])).toEqual(['123', '789']);
  });
});
