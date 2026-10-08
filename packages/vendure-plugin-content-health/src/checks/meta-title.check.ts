import { ContentCheckMessage } from '../types';

export const META_TITLE_MIN = 30;
export const META_TITLE_MAX = 60;
export const META_TITLE_RECOMMENDED = '50-60';

/**
 * @description
 * Validates meta title length. 30-60 characters is valid; outside that
 * range produces a warning recommending 50-60 characters.
 */
export function checkMetaTitleLength(
  title: string | undefined
): ContentCheckMessage[] {
  if (title === undefined) {
    return [
      {
        source: 'meta-title',
        severity: 'warning',
        code: 'META_TITLE_MISSING',
        message: 'Page has no meta title.',
      },
    ];
  }
  const length = title.length;
  if (length >= META_TITLE_MIN && length <= META_TITLE_MAX) {
    return [];
  }
  const direction = length < META_TITLE_MIN ? 'below' : 'above';
  return [
    {
      source: 'meta-title',
      severity: 'warning',
      code: 'META_TITLE_LENGTH',
      message: `Meta title is ${length} characters, which is ${direction} the valid ${META_TITLE_MIN}-${META_TITLE_MAX} character range. Recommended length is ${META_TITLE_RECOMMENDED} characters.`,
    },
  ];
}
