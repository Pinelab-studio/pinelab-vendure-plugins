import { Injector, RequestContext, Type, VendureEvent } from '@vendure/core';
import { Notifier } from './notifier';
import { AlertMessage } from '../types';

/**
 * Builder for an alert rule that reacts to Vendure {@linkcode EventBus} events.
 *
 * The generic parameter {@linkcode E} is automatically inferred from the events
 * passed to {@linkcode on()}. It starts as `never` so the alert only fires when
 * explicitly subscribed to event types.
 *
 * @example
 * ```ts
 * new EventAlert([webhookNotifier])
 *   .on(ProductEvent, OrderPlacedEvent)
 *   .filter(e => e.type === 'created')
 *   .notify(e => `Product ${e.type}`);
 * ```
 */
export class EventAlert<E extends VendureEvent = never> {
  /** Vendure event types this alert subscribes to. */
  events: Type<VendureEvent>[] = [];

  /** Optional predicate that decides whether the alert should fire. */
  filterFn?: (trigger: E) => boolean | Promise<boolean>;

  /**
   * Notify callback that receives an optional {@link RequestContext}
   * (when the event carries one), an {@link Injector} for resolving services,
   * and the event itself.
   */
  eventNotifyFn?: (
    ctx: RequestContext | undefined,
    injector: Injector,
    event: E
  ) => string | AlertMessage | Promise<string | AlertMessage>;

  /**
   * @param notifiers - The channels that will receive the alert when it fires.
   */
  constructor(public readonly notifiers: Notifier[]) {}

  /**
   * Only fire the alert when the predicate returns true for the trigger.
   */
  filter(fn: (trigger: E) => boolean | Promise<boolean>): this {
    this.filterFn = fn;
    return this;
  }

  /**
   * Trigger this alert when any of the given Vendure events are published.
   *
   * @returns A new {@linkcode EventAlert} whose event union now includes all
   *   the events passed in.
   */
  on<T extends VendureEvent[]>(
    ...events: { [I in keyof T]: Type<T[I]> }
  ): EventAlert<E | T[number]> {
    this.events.push(...(events as Type<VendureEvent>[]));
    return this as EventAlert<E | T[number]>;
  }

  /**
   * Define how the {@link AlertMessage} is built from the event.
   * The callback receives the event's {@link RequestContext} (if any), an
   * {@link Injector} so you can resolve and use Vendure services, and the event.
   *
   * Returning a string is shorthand for `{ subject: 'Alert', text: <string> }`.
   */
  notify(
    fn: (
      ctx: RequestContext | undefined,
      injector: Injector,
      event: E
    ) => string | AlertMessage | Promise<string | AlertMessage>
  ): this {
    this.eventNotifyFn = fn;
    return this;
  }
}
