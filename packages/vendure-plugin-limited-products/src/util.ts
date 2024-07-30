import {
    RequestContext,
    idsAreEqual
} from '@vendure/core';
import { ChannelAwareIntValue } from './types';

/**
 * Get the set value for the given channel, or 0 if not set
 */
export function getChannelAwareValue(ctx: RequestContext, value: string[] = []): number {
    return (value ?? []).map((v) => JSON.parse(v) as ChannelAwareIntValue)
        .find((channelValue) => idsAreEqual(channelValue.channelId, ctx.channelId))
        ?.value ?? 0;
}