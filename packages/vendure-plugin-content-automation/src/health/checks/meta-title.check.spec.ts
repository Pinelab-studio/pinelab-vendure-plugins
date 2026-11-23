import { describe, expect, it } from 'vitest';
import {
  checkMetaTitleLength,
  META_TITLE_MAX,
  META_TITLE_MIN,
} from './meta-title.check';

describe('checkMetaTitleLength', () => {
  it('warns when the title is below the valid range', () => {
    const messages = checkMetaTitleLength('a'.repeat(META_TITLE_MIN - 1));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      severity: 'warning',
      code: 'META_TITLE_LENGTH',
    });
  });

  it('does not warn at the minimum boundary (30)', () => {
    expect(checkMetaTitleLength('a'.repeat(META_TITLE_MIN))).toEqual([]);
  });

  it('does not warn within the recommended 50-60 range', () => {
    expect(checkMetaTitleLength('a'.repeat(55))).toEqual([]);
  });

  it('does not warn at the maximum boundary (60)', () => {
    expect(checkMetaTitleLength('a'.repeat(META_TITLE_MAX))).toEqual([]);
  });

  it('warns when the title is above the valid range', () => {
    const messages = checkMetaTitleLength('a'.repeat(META_TITLE_MAX + 1));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      severity: 'warning',
      code: 'META_TITLE_LENGTH',
    });
  });

  it('warns when the title is missing entirely', () => {
    const messages = checkMetaTitleLength(undefined);
    expect(messages[0].code).toBe('META_TITLE_MISSING');
  });
});
