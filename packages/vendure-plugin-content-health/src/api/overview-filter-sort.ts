import { UserInputError } from '@vendure/core';

export interface StringOperatorsArg {
  eq?: string;
  contains?: string;
  notContains?: string;
  in?: string[];
  notIn?: string[];
  /**
   * Not supported: this filter is evaluated in-process (not pushed down to
   * the database), so an unbounded `regex` operator would let an
   * API-supplied pattern block the Node event loop (catastrophic
   * backtracking). Reused from Vendure's core `StringOperators` input for
   * schema consistency, but rejected at runtime — see
   * {@link matchesStringOperator}.
   */
  regex?: string;
}

export interface BooleanOperatorsArg {
  eq?: boolean;
}

export interface ContentCheckOverviewFilterArg {
  name?: StringOperatorsArg;
  entityType?: StringOperatorsArg;
  hasError?: BooleanOperatorsArg;
  hasWarning?: BooleanOperatorsArg;
}

export interface ContentCheckOverviewListOptionsArg {
  skip?: number;
  take?: number;
  filter?: ContentCheckOverviewFilterArg;
  filterOperator?: 'AND' | 'OR';
  sort?: Record<string, 'ASC' | 'DESC'>;
}

export interface FilterableOverviewItem {
  name: string;
  entityType: string;
  hasError: boolean;
  hasWarning: boolean;
  errorCount: number;
  warningCount: number;
}

function matchesStringOperator(value: string, op: StringOperatorsArg): boolean {
  if (op.regex !== undefined) {
    throw new UserInputError(
      'The `regex` string filter operator is not supported on contentCheckOverview.'
    );
  }
  if (op.eq !== undefined) {
    return value === op.eq;
  }
  if (op.contains !== undefined) {
    return value.toLowerCase().includes(op.contains.toLowerCase());
  }
  if (op.notContains !== undefined) {
    return !value.toLowerCase().includes(op.notContains.toLowerCase());
  }
  if (op.in !== undefined) {
    return op.in.includes(value);
  }
  if (op.notIn !== undefined) {
    return !op.notIn.includes(value);
  }
  return true;
}

function matchesBooleanOperator(
  value: boolean,
  op: BooleanOperatorsArg
): boolean {
  return op.eq === undefined || value === op.eq;
}

/**
 * A small in-memory filter/sort/paginate implementation. The overview only
 * ever covers entities that currently have a warning or error — a bounded,
 * problem-proportional set rather than the whole catalog — so this avoids
 * building out SQL-level filtering for a JSON-backed aggregation.
 */
export function applyOverviewFilter<T extends FilterableOverviewItem>(
  items: T[],
  filter: ContentCheckOverviewFilterArg | undefined,
  filterOperator: 'AND' | 'OR' | undefined
): T[] {
  if (!filter) {
    return items;
  }
  const predicates: Array<(item: T) => boolean> = [];
  if (filter.name) {
    predicates.push((item) => matchesStringOperator(item.name, filter.name!));
  }
  if (filter.entityType) {
    predicates.push((item) =>
      matchesStringOperator(item.entityType, filter.entityType!)
    );
  }
  if (filter.hasError) {
    predicates.push((item) =>
      matchesBooleanOperator(item.hasError, filter.hasError!)
    );
  }
  if (filter.hasWarning) {
    predicates.push((item) =>
      matchesBooleanOperator(item.hasWarning, filter.hasWarning!)
    );
  }
  if (predicates.length === 0) {
    return items;
  }
  return filterOperator === 'OR'
    ? items.filter((item) => predicates.some((predicate) => predicate(item)))
    : items.filter((item) => predicates.every((predicate) => predicate(item)));
}

export function applyOverviewSort<T extends FilterableOverviewItem>(
  items: T[],
  sort: Record<string, 'ASC' | 'DESC'> | undefined
): T[] {
  const entries = sort ? Object.entries(sort) : [];
  if (entries.length === 0) {
    return [...items].sort((a, b) => {
      if (a.hasError !== b.hasError) {
        return a.hasError ? -1 : 1;
      }
      if (a.hasWarning !== b.hasWarning) {
        return a.hasWarning ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }
  const [field, direction] = entries[0];
  const dir = direction === 'DESC' ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[field];
    const bv = (b as unknown as Record<string, unknown>)[field];
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * dir;
    }
    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * dir;
    }
    if (typeof av === 'boolean' && typeof bv === 'boolean') {
      return (Number(av) - Number(bv)) * dir;
    }
    return 0;
  });
}

export function paginateOverview<T>(
  items: T[],
  skip: number | undefined,
  take: number | undefined
): { items: T[]; totalItems: number } {
  const effectiveSkip = skip ?? 0;
  const effectiveTake = take ?? 25;
  return {
    items: items.slice(effectiveSkip, effectiveSkip + effectiveTake),
    totalItems: items.length,
  };
}
