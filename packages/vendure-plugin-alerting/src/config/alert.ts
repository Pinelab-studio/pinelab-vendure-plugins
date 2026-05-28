import { Type, VendureEvent } from '@vendure/core';
import { Notifier } from './notifier';
import { AlertMessage, AlertLogLevel, LogAlertContext } from '../types';

/**
 * Abstract base for alert definitions consumed by {@link AlertingService}.
 * Holds the shared notifier list, optional filter, and message builder.
 *
 * @typeParam T - The type of trigger this alert receives (a Vendure event or
 *   a {@link LogAlertContext}).
 */
export abstract class BaseAlert<T> {
  /** Optional predicate that decides whether the alert should fire. */
  filterFn?: (trigger: T) => boolean | Promise<boolean>;

  /** Function that converts the trigger into an {@link AlertMessage}
   *  (or a plain string, which is auto-wrapped as `{ subject: 'Alert', text: <string> }`). */
  notifyFn!: (
    trigger: T
  ) => string | AlertMessage | Promise<string | AlertMessage>;

  /**
   * @param notifiers - The channels that will receive the alert when it fires.
   */
  constructor(public readonly notifiers: Notifier[]) {}

  /**
   * Only fire the alert when the predicate returns true for the trigger.
   */
  filter(fn: (trigger: T) => boolean | Promise<boolean>): this {
    this.filterFn = fn;
    return this;
  }

  /**
   * Define how the {@link AlertMessage} is built from the trigger.
   * Returning a string is shorthand for `{ subject: 'Alert', text: <string> }`.
   */
  notify(
    fn: (trigger: T) => string | AlertMessage | Promise<string | AlertMessage>
  ): this {
    this.notifyFn = fn;
    return this;
  }
}

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
export class EventAlert<E extends VendureEvent = never> extends BaseAlert<E> {
  /** Vendure event types this alert subscribes to. */
  events: Type<VendureEvent>[] = [];

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
}

/**
 * Builder for an alert rule that reacts to log messages emitted through
 * Vendure's {@linkcode VendureLogger}.
 *
 * @example
 * ```ts
 * new LogAlert([webhookNotifier])
 *   .onLog('error', 'warn')
 *   .filter(log => log.loggerCtx === 'PaymentGateway')
 *   .notify(log => ({
 *     subject: `[${log.level}] Payment issue`,
 *     text: log.message,
 *   }));
 * ```
 */
export class LogAlert extends BaseAlert<LogAlertContext> {
  /** Log levels this alert subscribes to. */
  logLevels: AlertLogLevel[] = [];

  /**
   * Trigger this alert when a log message is emitted at any of the given levels.
   */
  onLog(...levels: AlertLogLevel[]): this {
    this.logLevels.push(...levels);
    return this;
  }
}
