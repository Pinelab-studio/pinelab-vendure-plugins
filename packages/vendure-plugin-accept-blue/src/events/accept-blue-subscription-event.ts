import { RequestContext, VendureEvent } from '@vendure/core';
import {
  AcceptBlueSubscription,
  UpdateAcceptBlueSubscriptionInput,
} from '../api/generated/graphql';

/**
 * This event is fired when a subscription (schedule) has been updated in Accept Blue via the graphql API.
 */
export class AcceptBlueSubscriptionEvent extends VendureEvent {
  constructor(
    ctx: RequestContext,
    public subscription: AcceptBlueSubscription,
    public type: 'created' | 'updated' | 'deleted',
    public input?: UpdateAcceptBlueSubscriptionInput
  ) {
    super();
  }
}
