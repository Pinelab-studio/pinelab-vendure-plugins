import { describe, expect, it } from 'vitest';
import { ContentCheckResult } from '../entities/content-check-result.entity';
import {
  groupContentCheckResultsByEntity,
  truncate,
} from './overview-aggregation';

function result(overrides: Record<string, unknown> = {}): ContentCheckResult {
  return {
    id: '1',
    entityType: 'product',
    entityId: '10',
    channelId: '1',
    languageCode: 'en',
    hasError: false,
    hasWarning: false,
    messages: [],
    checkedAt: new Date(),
    ...overrides,
  } as unknown as ContentCheckResult;
}

describe('groupContentCheckResultsByEntity', () => {
  it('merges multiple language rows for the same entity into one group', () => {
    const groups = groupContentCheckResultsByEntity([
      result({
        languageCode: 'en',
        messages: [
          {
            source: 'x',
            severity: 'warning',
            code: 'W1',
            message: 'en warning',
          },
        ],
      }),
      result({
        languageCode: 'nl',
        messages: [
          { source: 'x', severity: 'error', code: 'E1', message: 'nl error' },
        ],
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].languageCodes.sort()).toEqual(['en', 'nl']);
    expect(groups[0].hasError).toBe(true);
    expect(groups[0].hasWarning).toBe(true);
    expect(groups[0].errorCount).toBe(1);
    expect(groups[0].warningCount).toBe(1);
  });

  it('keeps different entities in separate groups', () => {
    const groups = groupContentCheckResultsByEntity([
      result({ entityId: '10' }),
      result({ entityId: '11' }),
      result({ entityType: 'collection', entityId: '10' }),
    ]);
    expect(groups).toHaveLength(3);
  });

  it('prefers an error message as the preview, even if a warning came first', () => {
    const groups = groupContentCheckResultsByEntity([
      result({
        languageCode: 'en',
        messages: [
          {
            source: 'x',
            severity: 'warning',
            code: 'W1',
            message: 'a warning',
          },
        ],
      }),
      result({
        languageCode: 'nl',
        messages: [
          { source: 'x', severity: 'error', code: 'E1', message: 'an error' },
        ],
      }),
    ]);
    expect(groups[0].preview).toBe('an error');
  });

  it('falls back to the first warning message when there are no errors', () => {
    const groups = groupContentCheckResultsByEntity([
      result({
        messages: [
          {
            source: 'x',
            severity: 'warning',
            code: 'W1',
            message: 'first warning',
          },
          {
            source: 'x',
            severity: 'warning',
            code: 'W2',
            message: 'second warning',
          },
        ],
      }),
    ]);
    expect(groups[0].preview).toBe('first warning');
  });

  it('leaves preview undefined when there are no messages', () => {
    const groups = groupContentCheckResultsByEntity([result({ messages: [] })]);
    expect(groups[0].preview).toBeUndefined();
  });

  it('returns an empty array for no results', () => {
    expect(groupContentCheckResultsByEntity([])).toEqual([]);
  });
});

describe('truncate', () => {
  it('returns the original string when within the limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns the original string when exactly at the limit', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and appends an ellipsis when over the limit', () => {
    expect(truncate('hello world', 8)).toBe('hello w…');
  });

  it('trims trailing whitespace introduced by truncation', () => {
    expect(truncate('hello   world', 9)).toBe('hello…');
  });

  it('handles a maxLength of 0 without throwing', () => {
    expect(truncate('hello', 0)).toBe('…');
  });
});
