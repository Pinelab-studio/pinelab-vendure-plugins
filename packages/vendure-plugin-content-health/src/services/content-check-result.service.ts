import { Injectable } from '@nestjs/common';
import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { ContentCheckResult } from '../entities/content-check-result.entity';
import { ContentCheckMessage, ENTITY_EXCLUDED_CODE } from '../types';

export interface SaveContentCheckResultInput {
  entityType: string;
  entityId: ID;
  channelId: ID;
  languageCode: string;
  url?: string;
  label?: string;
  messages: ContentCheckMessage[];
  checkedAt: Date;
}

@Injectable()
export class ContentCheckResultService {
  constructor(private connection: TransactionalConnection) {}

  /**
   * Returns the latest results for a single entity, scoped to the active
   * channel, across every language it was checked in.
   */
  async findResultsFor(
    ctx: RequestContext,
    entityType: string,
    entityId: ID
  ): Promise<ContentCheckResult[]> {
    return this.connection.getRepository(ctx, ContentCheckResult).find({
      where: {
        entityType,
        entityId: entityId.toString(),
        channelId: ctx.channelId.toString(),
      },
      order: { languageCode: 'ASC' },
    });
  }

  /**
   * Returns every result in the active channel that currently has at least
   * one warning or error.
   */
  async findOverview(ctx: RequestContext): Promise<ContentCheckResult[]> {
    const results = await this.connection
      .getRepository(ctx, ContentCheckResult)
      .createQueryBuilder('result')
      .where('result.channelId = :channelId', {
        channelId: ctx.channelId.toString(),
      })
      .andWhere(
        '(result.hasError = :hasError OR result.hasWarning = :hasWarning)',
        {
          hasError: true,
          hasWarning: true,
        }
      )
      .orderBy('result.entityType', 'ASC')
      .addOrderBy('result.entityId', 'ASC')
      .getMany();
    return results.filter((result) => !isEntityExcludedResult(result));
  }

  /**
   * Every distinct `entityType` that currently has at least one entity with
   * a warning or error in the active channel — used to populate the issues
   * list's "Type" filter with whatever entity types (built-in or from
   * `additionalChecks`) are actually present, instead of a fixed list.
   */
  async findDistinctEntityTypesWithIssues(
    ctx: RequestContext
  ): Promise<string[]> {
    const results = await this.findOverview(ctx);
    return [...new Set(results.map((result) => result.entityType))].sort();
  }

  /**
   * Upserts the result for a single (entity, channel, language) combination,
   * fully replacing `messages`. Uses a single atomic `INSERT ... ON CONFLICT
   * DO UPDATE` (keyed by the entity's unique constraint) rather than a
   * find-then-save pattern, since the latter isn't safe under concurrent
   * calls for the same key (e.g. two full scans overlapping, or a batch of
   * `additionalChecks` results saved concurrently) — both could read "no
   * existing row" before either write commits, causing a unique-constraint
   * violation or a silently dropped update.
   */
  async saveResult(
    ctx: RequestContext,
    input: SaveContentCheckResultInput
  ): Promise<ContentCheckResult> {
    const repo = this.connection.getRepository(ctx, ContentCheckResult);
    const entityType = input.entityType;
    const entityId = input.entityId.toString();
    const channelId = input.channelId.toString();
    const languageCode =
      input.languageCode as ContentCheckResult['languageCode'];
    const hasError = input.messages.some((m) => m.severity === 'error');
    const hasWarning = input.messages.some((m) => m.severity === 'warning');

    await repo.upsert(
      {
        entityType,
        entityId,
        channelId,
        languageCode,
        url: input.url,
        label: input.label,
        hasError,
        hasWarning,
        messages: input.messages,
        checkedAt: input.checkedAt,
      },
      ['entityType', 'entityId', 'channelId', 'languageCode']
    );

    return repo.findOneOrFail({
      where: { entityType, entityId, channelId, languageCode },
    });
  }
}

/** Returns whether a result only reports exclusion from content checks. */
function isEntityExcludedResult(result: ContentCheckResult): boolean {
  return (
    result.messages.length > 0 &&
    result.messages.every((message) => message.code === ENTITY_EXCLUDED_CODE)
  );
}
