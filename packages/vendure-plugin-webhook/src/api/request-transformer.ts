import { Injector, RequestContext, Type, VendureEvent } from '@vendure/core';
import { Webhook } from './webhook.entity';

export type TransformFn<T extends EventWithContext> = (
  event: T,
  injector: Injector,
  webhook: Webhook
) => WebhookRequest | Promise<WebhookRequest>;

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
  readonly transform: TransformFn<EventWithContext>;

  constructor(
    private readonly options: {
      name: string;
      /**
       * The events that this transformer supports
       */
      supportedEvents: T;
      transform: TransformFn<EventWithContext>;
    }
  ) {
    this.name = options.name;
    this.supportedEvents = options.supportedEvents;
    this.transform = options.transform;
  }
}
