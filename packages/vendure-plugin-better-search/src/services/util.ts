import { RequestContext } from '@vendure/core';

/**
 * channelToken + languageCode for indentifying indices
 */
export function createIndexKey(ctx: RequestContext): string {
  return `${ctx.channel.token}-${ctx.languageCode}`;
}
