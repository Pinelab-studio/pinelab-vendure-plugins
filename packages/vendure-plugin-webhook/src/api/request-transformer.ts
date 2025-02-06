import {
  Injector,
  ProductEvent,
  ProductVariantEvent,
  RequestContext,
  Type,
  VendureEvent,
} from '@vendure/core';
import { Webhook } from './webhook.entity';

export type TransformFn<T extends EventWithContext> = (
  event: T,
  injector: Injector,
  webhook: Webhook
) => WebhookRequest | Promise<WebhookRequest> | false | Promise<false>;

export type EventWithContext = VendureEvent & {
  ctx: RequestContext;
};

export interface WebhookRequest {
  body?: ArrayBuffer | ArrayBufferView | string;
  headers?: Record<string, string>;
}

export class RequestTransformer<T extends Array<Type<EventWithContext>>> {
  readonly name: string;
  readonly supportedEvents: T;
  readonly transform: TransformFn<InstanceType<T[number]>>;

  constructor(
    private readonly options: {
      name: string;
      /**
       * The events that this transformer supports
       */
      supportedEvents: T;
      /**
       * Transform the body and/or headers for the webhook request.
       * When returning `false`, the webhook will not be called.
       */
      transform: TransformFn<InstanceType<T[number]>>;
    }
  ) {
    this.name = options.name;
    this.supportedEvents = options.supportedEvents;
    this.transform = options.transform;
  }
}

// This only exists to test TS type compilation for this plugin, because of the complex type inference above
new RequestTransformer({
  name: 'Stringify Product events',
  supportedEvents: [ProductEvent, ProductVariantEvent],
  transform: (event: ProductEvent | ProductVariantEvent, injector) => {
    return {};
  },
});
