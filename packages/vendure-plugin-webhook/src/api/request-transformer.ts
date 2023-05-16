import { CollectionModificationEvent, Injector, OrderPlacedEvent, OrderStateTransitionEvent, RequestContext, Type, VendureEvent } from "@vendure/core";

export type TransformFn<T extends EventWithContext> = (
    event: T,
    injector: Injector
) => WebhookRequest | Promise<WebhookRequest>;

export type EventWithContext = VendureEvent & {
    ctx: RequestContext;
};

export interface WebhookRequest {
    body?: ArrayBuffer | ArrayBufferView | NodeJS.ReadableStream | string;
    headers?: Record<string, string>;
}

export class RequestTransformer<T extends Array<Type<EventWithContext>>> {
    constructor(public readonly options: {
        name: string,
        supportedEvents: T,
        transform: TransformFn<EventWithContext>
    }) { }

}

new RequestTransformer({
    name: 'Stringify event data',
    supportedEvents: [CollectionModificationEvent, OrderStateTransitionEvent],
    transform: (event, injector) => {
        if (event instanceof OrderStateTransitionEvent) {
            // Order specific stuff
            return {}
        } if (event instanceof CollectionModificationEvent) {
            // Collection specific stuff
            return {}
        } else {
            // unknown event
            return {}
        }
    }
})
