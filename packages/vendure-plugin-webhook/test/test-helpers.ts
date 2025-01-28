import { Logger, ProductEvent } from '@vendure/core';
import { RequestTransformer } from '../src/api/request-transformer';
import util from 'util';

export const stringifyProductTransformer = new RequestTransformer({
  name: 'Stringify Product events',
  supportedEvents: [ProductEvent],
  transform: (event, injector) => {
    if (event instanceof ProductEvent) {
      return {
        body: JSON.stringify({ type: event.type, ctx: event.ctx.serialize() }),
        headers: {
          'pc-update:': 'true',
        },
      };
    }
    Logger.warn(
      `This transformer is only for transforming ProductEvents, but got ${event.constructor.name}. Not handling this event.`,
      'WebhookStringifyProductTransformer'
    );
    return {};
  },
});
