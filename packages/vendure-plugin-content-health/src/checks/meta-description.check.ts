import { ContentCheckMessage } from '../types';

export const META_DESCRIPTION_MIN = 100;
export const META_DESCRIPTION_MAX = 160;
export const META_DESCRIPTION_RECOMMENDED = '140-160';

/**
 * @description
 * Validates meta description length. 100-160 characters is valid; outside
 * that range produces a warning recommending 140-160 characters.
 */
export function checkMetaDescriptionLength(
  description: string | undefined
): ContentCheckMessage[] {
  if (description === undefined) {
    return [
      {
        source: 'meta-description',
        severity: 'warning',
        code: 'META_DESCRIPTION_MISSING',
        message: 'Page has no meta description.',
      },
    ];
  }
  const length = description.length;
  if (length >= META_DESCRIPTION_MIN && length <= META_DESCRIPTION_MAX) {
    return [];
  }
  const direction = length < META_DESCRIPTION_MIN ? 'below' : 'above';
  return [
    {
      source: 'meta-description',
      severity: 'warning',
      code: 'META_DESCRIPTION_LENGTH',
      message: `Meta description is ${length} characters, which is ${direction} the valid ${META_DESCRIPTION_MIN}-${META_DESCRIPTION_MAX} character range. Recommended length is ${META_DESCRIPTION_RECOMMENDED} characters.`,
    },
  ];
}
