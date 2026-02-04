import { ProductVariant, RequestContext, VendureEvent } from '@vendure/core';

/**
 * Emitted when a variant failed to sync to QLS.
 */
export class QlsVariantSyncFailedEvent extends VendureEvent {
  constructor(
    public ctx: RequestContext,
    /** The variant that failed to sync (at least id, may be full variant). */
    public variant: Partial<ProductVariant>,
    public failedAt: Date,
    /** The error that caused the sync to fail. */
    public fullError: unknown
  ) {
    super();
  }
}
