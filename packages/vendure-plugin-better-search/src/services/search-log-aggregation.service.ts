import { Inject, Injectable } from '@nestjs/common';
import {
  CacheService,
  ConfigService,
  PaginatedList,
  RequestContext,
  TransactionalConnection,
} from '@vendure/core';
import { createHash } from 'node:crypto';
import { BETTER_SEARCH_PLUGIN_OPTIONS } from '../constants';
import {
  SearchLogAggregate,
  SearchLogAggregateListOptions,
} from '../api/generated/graphql';

type CachedAggregateList = {
  totalItems: number;
  items: Array<
    Omit<SearchLogAggregate, 'lastSearchedAt'> & { lastSearchedAt: string }
  >;
};
import { BetterSearchLog } from '../entities/better-search-log.entity';
import { BetterSearchOptions } from '../types';

/** Restores DateTime values consistently after JSON cache serialization. */
function hydrate(
  result: CachedAggregateList
): PaginatedList<SearchLogAggregate> {
  return {
    ...result,
    items: result.items.map((item) => ({
      ...item,
      lastSearchedAt: new Date(item.lastSearchedAt),
    })),
  };
}

type Filter = Record<string, unknown>;
const fields = [
  'id',
  'term',
  'searchCount',
  'lastSearchedAt',
  'resultCount',
  'languageCode',
];

/** Canonicalizes list options for independent, deterministic cache keys. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value instanceof Date) return value.toISOString();
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)])
  );
}

/** Separates pre-aggregation dates from post-aggregation filters; mixed OR has no unambiguous meaning. */
export function splitAggregateFilter(filter: Filter): [Filter, Filter] {
  const dates: Filter = {};
  const aggregates: Filter = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value == null) continue;
    if (key === 'lastSearchedAt') {
      dates[key] = value;
      continue;
    }
    if (key !== '_and' && key !== '_or') {
      aggregates[key] = value;
      continue;
    }
    if (!Array.isArray(value)) throw new Error(`Invalid ${key} filter`);
    const parts = value.map((item) => splitAggregateFilter(item as Filter));
    if (
      key === '_or' &&
      parts.some(([date]) => Object.keys(date).length) &&
      parts.some(([, aggregate]) => Object.keys(aggregate).length)
    ) {
      throw new Error(
        'Date and aggregate filters cannot be combined inside _or'
      );
    }
    const dateParts = parts.map(([date]) => date);
    const aggregateParts = parts.map(([, aggregate]) => aggregate);
    if (dateParts.some((item) => Object.keys(item).length))
      dates[key] =
        key === '_or'
          ? dateParts
          : dateParts.filter((item) => Object.keys(item).length);
    if (
      aggregateParts.some((item) => Object.keys(item).length) ||
      !parts.length
    )
      aggregates[key] =
        key === '_or'
          ? aggregateParts
          : aggregateParts.filter((item) => Object.keys(item).length);
  }
  return [dates, aggregates];
}

/** Computes retained search statistics in SQL and caches complete list responses. */
@Injectable()
export class SearchLogAggregationService {
  /** Injects SQL access, the configured Vendure cache, list limits, and plugin options. */
  constructor(
    private connection: TransactionalConnection,
    private cache: CacheService,
    private config: ConfigService,
    @Inject(BETTER_SEARCH_PLUGIN_OPTIONS) private options: BetterSearchOptions
  ) {}

  /** Returns active-channel term groups with standard list options. */
  async findAll(
    ctx: RequestContext,
    options: SearchLogAggregateListOptions = {}
  ): Promise<PaginatedList<SearchLogAggregate>> {
    const take =
      options.take ?? Math.min(10, this.config.apiOptions.adminListQueryLimit);
    const skip = options.skip ?? 0;
    if (
      !Number.isInteger(take) ||
      take < 0 ||
      take > this.config.apiOptions.adminListQueryLimit ||
      !Number.isInteger(skip) ||
      skip < 0
    ) {
      throw new Error('Invalid search aggregate pagination');
    }
    const ttl = this.options.searchLogAggregationCacheTtlSeconds ?? 60;
    const key = `better-search:aggregates:v1:${ctx.channelId}:${createHash(
      'sha256'
    )
      .update(JSON.stringify(canonical({ ...options, take, skip })))
      .digest('hex')}`;
    if (ttl) {
      const cached = await this.cache.get<CachedAggregateList>(key);
      if (cached) return hydrate(cached);
    }
    const repository = this.connection.getRepository(ctx, BetterSearchLog);
    const escape = (name: string) =>
      repository.manager.connection.driver.escape(name);
    const [dateFilter, aggregateFilter] = splitAggregateFilter(
      options.filter ?? {}
    );
    let counter = 0;
    const parameters: Record<string, unknown> = {};
    const bind = (value: unknown) => {
      const name = `filter${counter++}`;
      parameters[name] = value;
      return `:${name}`;
    };
    /** Compiles allowlisted Vendure operators into parameterized SQL expressions. */
    const compile = (filter: Filter, date: boolean): string => {
      const clauses: string[] = [];
      for (const [field, value] of Object.entries(filter)) {
        if (field === '_and' || field === '_or') {
          const children = (value as Filter[]).map((child) =>
            compile(child, date)
          );
          clauses.push(
            children.length
              ? `(${children.join(field === '_and' ? ' AND ' : ' OR ')})`
              : field === '_and'
              ? '1=1'
              : '1=0'
          );
          continue;
        }
        if (!fields.includes(field) || field === 'id')
          throw new Error(`Unsupported aggregate filter: ${field}`);
        const column = date ? 'log.createdAt' : `aggregate.${escape(field)}`;
        const parameter = (operand: unknown) => {
          if (!date || operand == null) return bind(operand);
          if (!(operand instanceof Date) && typeof operand !== 'string')
            throw new Error('Invalid aggregate date filter');
          const timestamp =
            operand instanceof Date ? operand : new Date(operand);
          if (!Number.isFinite(timestamp.getTime()))
            throw new Error('Invalid aggregate date filter');
          return bind(
            repository.manager.connection.driver.preparePersistentValue(
              timestamp,
              repository.metadata.findColumnWithPropertyName('createdAt')!
            )
          );
        };
        for (const [operator, operand] of Object.entries(value as Filter)) {
          if (operand == null) continue;
          const comparisons: Record<string, string> = {
            eq: '=',
            notEq: '<>',
            lt: '<',
            lte: '<=',
            gt: '>',
            gte: '>=',
            before: '<',
            after: '>',
          };
          if (comparisons[operator]) {
            clauses.push(
              `${column} ${comparisons[operator]} ${parameter(operand)}`
            );
            continue;
          }
          if (operator === 'isNull') {
            clauses.push(`${column} IS ${operand ? '' : 'NOT '}NULL`);
            continue;
          }
          if (operator === 'between') {
            const range = operand as { start: unknown; end: unknown };
            clauses.push(
              `${column} BETWEEN ${parameter(range.start)} AND ${parameter(
                range.end
              )}`
            );
            continue;
          }
          if (operator === 'in' || operator === 'notIn') {
            const items = operand as unknown[];
            clauses.push(
              items.length
                ? `${column} ${operator === 'in' ? 'IN' : 'NOT IN'} (${items
                    .map(parameter)
                    .join(', ')})`
                : operator === 'in'
                ? '1=0'
                : '1=1'
            );
            continue;
          }
          if (operator === 'regex') {
            const database = repository.manager.connection.options.type;
            if (!['postgres', 'mysql', 'mariadb'].includes(database))
              throw new Error(
                'Regex aggregate filters require PostgreSQL or MySQL'
              );
            clauses.push(
              `${column} ${database === 'postgres' ? '~' : 'REGEXP'} ${bind(
                operand
              )}`
            );
            continue;
          }
          if (['contains', 'notContains'].includes(operator)) {
            if (typeof operand !== 'string')
              throw new Error('Invalid aggregate string filter');
            const text = operand.replace(/[!%_]/g, '!$&');
            const pattern = `%${text}%`;
            clauses.push(
              `${column} ${
                operator === 'notContains' ? 'NOT LIKE' : 'LIKE'
              } ${bind(pattern)} ESCAPE '!'`
            );
            continue;
          }
          throw new Error(`Unsupported aggregate operator: ${operator}`);
        }
      }
      return clauses.length
        ? `(${clauses.join(
            options.filterOperator === 'OR' ? ' OR ' : ' AND '
          )})`
        : '1=1';
    };
    const dateSql = compile(dateFilter, true);
    const aggregateSql = compile(aggregateFilter, false);
    if (
      options.filterOperator === 'OR' &&
      Object.keys(dateFilter).length &&
      Object.keys(aggregateFilter).length
    ) {
      throw new Error(
        'Date and aggregate filters cannot be combined with filterOperator OR'
      );
    }
    const type = repository.manager.connection.options.type;
    const term =
      type === 'mysql' || type === 'mariadb' ? 'BINARY log.term' : 'log.term';
    const ranked = repository
      .createQueryBuilder('log')
      .select('log.term', 'term')
      .addSelect('log.resultCount', 'resultCount')
      .addSelect('log.languageCode', 'languageCode')
      .addSelect('log.createdAt', 'lastSearchedAt')
      .addSelect(`COUNT(*) OVER (PARTITION BY ${term})`, 'searchCount')
      .addSelect(
        `ROW_NUMBER() OVER (PARTITION BY ${term} ORDER BY log.createdAt DESC, log.id DESC)`,
        'rank'
      )
      .where('log.channelId = :channelId', { channelId: ctx.channelId })
      .andWhere(dateSql)
      .setParameters(parameters);
    const query = repository.manager
      .createQueryBuilder()
      .select('aggregate.*')
      .from(`(${ranked.getQuery()})`, 'aggregate')
      .where(`aggregate.${escape('rank')} = 1`)
      .andWhere(aggregateSql)
      .setParameters(ranked.getParameters());
    const count = await query
      .clone()
      .select('COUNT(*)', 'count')
      .getRawOne<{ count: string | number }>();
    const sort =
      options.sort && Object.values(options.sort).some((value) => value != null)
        ? options.sort
        : { searchCount: 'DESC' };
    for (const [field, direction] of Object.entries(sort)) {
      if (direction == null) continue;
      if (
        !fields.includes(field) ||
        field === 'id' ||
        !['ASC', 'DESC'].includes(direction as string)
      )
        throw new Error('Unsupported aggregate sort');
      query.addOrderBy(
        `aggregate.${escape(field)}`,
        direction as 'ASC' | 'DESC'
      );
    }
    query.addOrderBy(`aggregate.${escape('term')}`, 'ASC');
    const rows =
      take === 0
        ? []
        : await query.offset(skip).limit(take).getRawMany<SearchLogAggregate>();
    const result = {
      totalItems: Number(count?.count ?? 0),
      items: rows.map((row) => ({
        term: row.term,
        languageCode: row.languageCode,
        id: createHash('sha256')
          .update(JSON.stringify([String(ctx.channelId), row.term]))
          .digest('hex'),
        searchCount: Number(row.searchCount),
        resultCount: Number(row.resultCount),
        lastSearchedAt: (
          repository.manager.connection.driver.prepareHydratedValue(
            row.lastSearchedAt,
            repository.metadata.findColumnWithPropertyName('createdAt')!
          ) as Date
        ).toISOString(),
      })),
    };
    if (ttl) await this.cache.set(key, result, { ttl: ttl * 1000 });
    return hydrate(result);
  }
}
