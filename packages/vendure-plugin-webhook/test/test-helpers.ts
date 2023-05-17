import { ProductEvent, Product, AttemptedLoginEvent } from '@vendure/core';
import { RequestTransformer } from '../src/api/request-transformer';

export const stringifyProductTransformer = new RequestTransformer({
  name: 'Stringify Product events',
  supportedEvents: [ProductEvent],
  transform: (event, injector) => {
    if (event instanceof ProductEvent) {
      return {
        body: JSON.stringify(event),
        headers: {
          'X-custom-header': 'stringify-custom-header',
        },
      };
    }
    return {};
  },
});
