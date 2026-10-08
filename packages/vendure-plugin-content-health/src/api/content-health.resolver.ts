import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Allow,
  CollectionService,
  ConfigService,
  Ctx,
  ID,
  Permission,
  ProductService,
  RequestContext,
} from '@vendure/core';
import { ContentCheckResult } from '../entities/content-check-result.entity';
import { ContentCheckResultService } from '../services/content-check-result.service';
import { ContentCheckService } from '../services/content-check.service';
import {
  groupContentCheckResultsByEntity,
  truncate,
} from './overview-aggregation';
import {
  applyOverviewFilter,
  applyOverviewSort,
  ContentCheckOverviewListOptionsArg,
  paginateOverview,
} from './overview-filter-sort';

const PREVIEW_MAX_LENGTH = 160;

function isCoreEntityType(entityType: string): boolean {
  return entityType === 'product' || entityType === 'collection';
}

@Resolver()
export class ContentHealthResolver {
  constructor(
    private resultService: ContentCheckResultService,
    private checkService: ContentCheckService,
    private productService: ProductService,
    private collectionService: CollectionService,
    private configService: ConfigService
  ) {}

  @Query()
  @Allow(Permission.ReadCatalog, Permission.ReadProduct)
  async contentCheckResults(
    @Ctx() ctx: RequestContext,
    @Args('entityType') entityType: string,
    @Args('entityId') entityId: string
  ) {
    const internalEntityType = fromGraphQlEntityType(entityType);
    const decodedEntityId = this.decodeEntityId(internalEntityType, entityId);
    const results = await this.resultService.findResultsFor(
      ctx,
      internalEntityType,
      decodedEntityId
    );
    return results.map((r) => this.toGraphQlResult(r));
  }

  @Query()
  @Allow(Permission.ReadCatalog, Permission.ReadProduct)
  async contentCheckOverview(
    @Ctx() ctx: RequestContext,
    @Args('options') options?: ContentCheckOverviewListOptionsArg
  ) {
    const rawResults = await this.resultService.findOverview(ctx);
    const groups = groupContentCheckResultsByEntity(rawResults);

    const items: Array<{
      id: string;
      entityType: string;
      entityId: string;
      name: string;
      url: string | null;
      hasError: boolean;
      hasWarning: boolean;
      errorCount: number;
      warningCount: number;
      languageCodes: string[];
      preview: string | null;
    }> = [];
    for (const group of groups) {
      const name = await this.getEntityDisplayName(
        ctx,
        group.entityType,
        group.entityId,
        group.label
      );
      if (name === undefined) {
        // The entity was deleted since the last check; omit it rather than
        // showing a broken row. It will drop out of results entirely once
        // it is re-checked (or never, if it truly no longer exists).
        continue;
      }
      const entityType = toGraphQlEntityType(group.entityType);
      const encodedEntityId = this.encodeEntityId(
        group.entityType,
        group.entityId
      );
      items.push({
        id: `${entityType}:${encodedEntityId}`,
        entityType,
        entityId: encodedEntityId,
        name,
        url: this.entityUrl(group.entityType, encodedEntityId, group.url),
        hasError: group.hasError,
        hasWarning: group.hasWarning,
        errorCount: group.errorCount,
        warningCount: group.warningCount,
        languageCodes: group.languageCodes,
        preview: group.preview
          ? truncate(group.preview, PREVIEW_MAX_LENGTH)
          : null,
      });
    }

    const filtered = applyOverviewFilter(
      items,
      options?.filter,
      options?.filterOperator
    );
    const sorted = applyOverviewSort(filtered, options?.sort);
    return paginateOverview(sorted, options?.skip, options?.take);
  }

  @Query()
  @Allow(Permission.ReadCatalog, Permission.ReadProduct)
  async contentCheckEntityTypes(@Ctx() ctx: RequestContext): Promise<string[]> {
    const entityTypes =
      await this.resultService.findDistinctEntityTypesWithIssues(ctx);
    return entityTypes.map((entityType) => toGraphQlEntityType(entityType));
  }

  @Mutation()
  @Allow(Permission.UpdateProduct)
  async runContentCheckForProduct(
    @Ctx() ctx: RequestContext,
    @Args('productId') productId: ID
  ) {
    await this.checkService.checkProductInCurrentChannel(ctx, productId);
    const results = await this.resultService.findResultsFor(
      ctx,
      'product',
      productId
    );
    return results.map((r) => this.toGraphQlResult(r));
  }

  @Mutation()
  @Allow(Permission.UpdateCollection)
  async runContentCheckForCollection(
    @Ctx() ctx: RequestContext,
    @Args('collectionId') collectionId: ID
  ) {
    await this.checkService.checkCollectionInCurrentChannel(ctx, collectionId);
    const results = await this.resultService.findResultsFor(
      ctx,
      'collection',
      collectionId
    );
    return results.map((r) => this.toGraphQlResult(r));
  }

  @Mutation()
  @Allow(Permission.UpdateCatalog)
  async runContentHealthFullScan() {
    return this.checkService.runFullScan();
  }

  /**
   * Resolves a display name for the overview/detail pages. For products and
   * collections, resolved live (handling a deleted entity by returning
   * `undefined` so the caller can omit the row, and a blank/whitespace-only
   * name with a stable placeholder). For any other (custom) entity type,
   * there's no generic way to look up a name or detect deletion, so the
   * `label` captured at check time is used as-is (with the same blank-name
   * fallback).
   */
  private async getEntityDisplayName(
    ctx: RequestContext,
    entityType: string,
    entityId: ID,
    storedLabel: string | undefined
  ): Promise<string | undefined> {
    if (!isCoreEntityType(entityType)) {
      const trimmedLabel = storedLabel?.trim();
      return trimmedLabel && trimmedLabel.length > 0
        ? trimmedLabel
        : `Untitled ${entityType} #${entityId}`;
    }
    const entity =
      entityType === 'product'
        ? await this.productService.findOne(ctx, entityId)
        : await this.collectionService.findOne(ctx, entityId);
    if (!entity) {
      return undefined;
    }
    const trimmedName = entity.name?.trim();
    if (trimmedName) {
      return trimmedName;
    }
    return entityType === 'product'
      ? `Untitled product #${entityId}`
      : `Untitled collection #${entityId}`;
  }

  /**
   * `entityId` arguments/fields use a plain GraphQL `String`, not `ID` —
   * Vendure's blanket ID-codec middleware intercepts every field/argument
   * typed `ID` in the schema and runs it through the configured
   * `EntityIdStrategy`, which (e.g. under the default
   * `AutoIncrementIdStrategy`) assumes a numeric-derived value and silently
   * produces `-1` for anything else. That's correct behaviour for a real
   * product/collection id, but would corrupt an arbitrary custom entity id
   * from `additionalChecks`. So encode/decode is applied manually here,
   * only for the two built-in entity types, using the same configured
   * strategy — custom entity types pass through untouched.
   *
   * The strategy is read via `entityOptions.entityIdStrategy`, not the
   * top-level `entityIdStrategy` getter: Vendure's own `IdCodecService`
   * (which powers the automatic `ID`-typed field/argument codec) prefers
   * `configService.entityOptions.entityIdStrategy` and only falls back to
   * the top-level getter when that's unset. Reading the top-level getter
   * directly can silently return a different (e.g. default) strategy
   * instance than the one actually driving the rest of the Admin API.
   */
  private get entityIdStrategy() {
    return (
      this.configService.entityOptions.entityIdStrategy ??
      this.configService.entityIdStrategy
    );
  }

  private decodeEntityId(entityType: string, entityId: string): ID {
    return isCoreEntityType(entityType)
      ? (this.entityIdStrategy.decodeId(entityId) as ID)
      : entityId;
  }

  private encodeEntityId(entityType: string, entityId: ID): string {
    return isCoreEntityType(entityType)
      ? this.entityIdStrategy.encodeId(entityId)
      : entityId.toString();
  }

  private toGraphQlResult(result: ContentCheckResult) {
    return {
      id: result.id,
      entityType: toGraphQlEntityType(result.entityType),
      entityId: this.encodeEntityId(result.entityType, result.entityId),
      languageCode: result.languageCode,
      url: result.url,
      label: result.label,
      hasError: result.hasError,
      hasWarning: result.hasWarning,
      messages: result.messages.map((m) => ({
        source: m.source,
        severity: m.severity.toUpperCase(),
        code: m.code,
        message: m.message,
      })),
      checkedAt: result.checkedAt,
    };
  }

  /** The URL to link to for the dashboard's "Go to entity" action. */
  private entityUrl(
    entityType: string,
    encodedEntityId: string,
    storedUrl: string | undefined
  ): string | null {
    if (entityType === 'product') {
      return `/products/${encodedEntityId}`;
    }
    if (entityType === 'collection') {
      return `/collections/${encodedEntityId}`;
    }
    return storedUrl ?? null;
  }
}

/**
 * The two built-in entity types are stored/compared internally as lowercase
 * 'product'/'collection' and surfaced over GraphQL as 'PRODUCT'/'COLLECTION'
 * for consistency with typical GraphQL enum-style naming. A custom entity
 * type from `additionalChecks` is passed through completely unchanged in
 * both directions, since it's an arbitrary string the site owner chose —
 * imposing a casing convention on it could break their own lookups.
 */
function toGraphQlEntityType(entityType: string): string {
  return isCoreEntityType(entityType) ? entityType.toUpperCase() : entityType;
}

function fromGraphQlEntityType(entityType: string): string {
  return entityType === 'PRODUCT' || entityType === 'COLLECTION'
    ? entityType.toLowerCase()
    : entityType;
}
