import { Customer, ID, Injector, RequestContext } from '@vendure/core';
import { getCustomers } from '../helpers/get-customers';
import { assignEntitiesToChannel } from '../helpers/assign-entity-to-channel';
export async function assignCustomersToChannel(
  sourceChannelId: ID,
  targetChannelId: ID,
  injector: Injector,
  ctx: RequestContext,
  batch: number = 10
): Promise<void> {
  await assignEntitiesToChannel<Customer>(
    sourceChannelId,
    targetChannelId,
    injector,
    ctx,
    getCustomers,
    batch
  );
}
