import { describe, expect, it } from 'vitest';
import {
  checkMetaDescriptionLength,
  META_DESCRIPTION_MAX,
  META_DESCRIPTION_MIN,
} from './meta-description.check';

describe('checkMetaDescriptionLength', () => {
  it('warns when the description is below the valid range', () => {
    const messages = checkMetaDescriptionLength(
      'a'.repeat(META_DESCRIPTION_MIN - 1)
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      severity: 'warning',
      code: 'META_DESCRIPTION_LENGTH',
    });
  });

  it('does not warn at the minimum boundary (100)', () => {
    expect(
      checkMetaDescriptionLength('a'.repeat(META_DESCRIPTION_MIN))
    ).toEqual([]);
  });

  it('does not warn within the recommended 140-160 range', () => {
    expect(checkMetaDescriptionLength('a'.repeat(150))).toEqual([]);
  });

  it('does not warn at the maximum boundary (160)', () => {
    expect(
      checkMetaDescriptionLength('a'.repeat(META_DESCRIPTION_MAX))
    ).toEqual([]);
  });

  it('warns when the description is above the valid range', () => {
    const messages = checkMetaDescriptionLength(
      'a'.repeat(META_DESCRIPTION_MAX + 1)
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      severity: 'warning',
      code: 'META_DESCRIPTION_LENGTH',
    });
  });

  it('warns when the description is missing entirely', () => {
    const messages = checkMetaDescriptionLength(undefined);
    expect(messages[0].code).toBe('META_DESCRIPTION_MISSING');
  });
});
