import { RequestContext, VendureEntityEvent } from '@vendure/core';
import { ContentEntry } from '../entities/content-entry.entity';
import { ContentEntryInput } from '../api/generated/graphql';

/**
 * Input shape passed alongside the event.
 *
 * - For `'created'` and `'updated'` events this is the `ContentEntryInput`.
 * - For `'deleted'` events this is the id of the deleted entry.
 */
export type SimpleCmsContentEntryEventInput =
  | ContentEntryInput
  | string
  | number;

/**
 * Emitted on the Vendure EventBus whenever a SimpleCms `ContentEntry` is
 * created, updated, or deleted.
 *
 * @example
 * ```ts
 * eventBus.ofType(SimpleCmsContentEntryEvent).subscribe(event => {
 *   if (event.type === 'created') {
 *     // ...
 *   }
 * });
 * ```
 */
export class SimpleCmsContentEntryEvent extends VendureEntityEvent<
  ContentEntry,
  SimpleCmsContentEntryEventInput
> {
  constructor(
    entity: ContentEntry,
    type: 'created' | 'updated' | 'deleted',
    ctx: RequestContext,
    input?: SimpleCmsContentEntryEventInput
  ) {
    super(entity, type, ctx, input);
  }
}
