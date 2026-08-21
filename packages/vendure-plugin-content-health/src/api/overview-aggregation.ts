import { ID } from '@vendure/core';
import { ContentCheckResult } from '../entities/content-check-result.entity';

export interface AggregatedOverviewGroup {
  entityType: string;
  entityId: ID;
  hasError: boolean;
  hasWarning: boolean;
  errorCount: number;
  warningCount: number;
  languageCodes: string[];
  /** The first error message if any, otherwise the first warning message. */
  preview: string | undefined;
  /** The first non-empty stored `label` across the group's rows, if any (custom entity types only). */
  label: string | undefined;
  /** The first non-empty stored `url` across the group's rows, if any. */
  url: string | undefined;
}

/**
 * Groups per-(entity, language) result rows into one entry per entity,
 * since the same product/collection/custom entity can have a separate row
 * per language it was checked in within a channel.
 */
export function groupContentCheckResultsByEntity(
  results: ContentCheckResult[]
): AggregatedOverviewGroup[] {
  interface MutableGroup extends AggregatedOverviewGroup {
    firstErrorMessage: string | undefined;
    firstWarningMessage: string | undefined;
  }

  const groups = new Map<string, MutableGroup>();
  for (const result of results) {
    const key = `${result.entityType}:${result.entityId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        entityType: result.entityType,
        entityId: result.entityId,
        hasError: false,
        hasWarning: false,
        errorCount: 0,
        warningCount: 0,
        languageCodes: [],
        preview: undefined,
        label: undefined,
        url: undefined,
        firstErrorMessage: undefined,
        firstWarningMessage: undefined,
      };
      groups.set(key, group);
    }
    group.languageCodes.push(result.languageCode);
    group.label ??= result.label ?? undefined;
    group.url ??= result.url ?? undefined;
    for (const message of result.messages) {
      if (message.severity === 'error') {
        group.hasError = true;
        group.errorCount++;
        group.firstErrorMessage ??= message.message;
      } else {
        group.hasWarning = true;
        group.warningCount++;
        group.firstWarningMessage ??= message.message;
      }
    }
  }

  return [...groups.values()].map((group) => ({
    entityType: group.entityType,
    entityId: group.entityId,
    hasError: group.hasError,
    hasWarning: group.hasWarning,
    errorCount: group.errorCount,
    warningCount: group.warningCount,
    languageCodes: group.languageCodes,
    preview: group.firstErrorMessage ?? group.firstWarningMessage,
    label: group.label,
    url: group.url,
  }));
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
