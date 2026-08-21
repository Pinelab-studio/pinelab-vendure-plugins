import { Channel, RequestContext, VendureEvent } from '@vendure/core';
import { ChannelScanFindingEntry } from '../types';

/**
 * @description
 * Published once per channel after a full scan (scheduled or on-demand)
 * completes, carrying that channel's findings for every language and
 * entity checked during the scan, including page-fetch and sitemap
 * failures. Never published for per-entity update-triggered checks.
 */
export class ChannelContentScanCompletedEvent extends VendureEvent {
  constructor(
    public ctx: RequestContext,
    public channel: Channel,
    public findings: ChannelScanFindingEntry[]
  ) {
    super();
  }
}
