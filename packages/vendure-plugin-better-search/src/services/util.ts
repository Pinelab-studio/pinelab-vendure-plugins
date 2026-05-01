import { RequestContext } from '@vendure/core';

/**
 * Create a unique key for the index based on the channel and language.
 */
export function createIndexKey(ctx: RequestContext): string {
  return `${ctx.channel.token}-${ctx.languageCode}`;
}
