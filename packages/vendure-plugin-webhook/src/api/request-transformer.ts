import { CollectionModificationEvent, Injector, OrderPlacedEvent, OrderStateTransitionEvent, RequestContext, Type, VendureEvent } from "@vendure/core";
import { WebhookPlugin } from "../webhook.plugin";

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
    
    readonly name: string;
    readonly supportedEvents: T;
    readonly transform: TransformFn<EventWithContext>;

    constructor(private readonly options: {
        name: string,
        /**
         * The events that this transformer supports
         */
        supportedEvents: T,
        transform: TransformFn<EventWithContext>
    }) {
        this.name = options.name;
        this.supportedEvents = options.supportedEvents;
        this.transform = options.transform;
    }

}

// FIXME this is just a sample to test TS type inference

const stringifyTransformer = new RequestTransformer({
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

WebhookPlugin.init({
    events: [CollectionModificationEvent, OrderStateTransitionEvent, OrderPlacedEvent],
    requestTransformers: [stringifyTransformer]
})