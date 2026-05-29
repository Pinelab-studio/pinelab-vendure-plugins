import { Notifier } from './notifier';
import { AlertLogLevel, AlertMessage, LogAlertContext } from '../types';

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
export class LogAlert {
  /** Log levels this alert subscribes to. */
  logLevels: AlertLogLevel[] = [];

  /** Optional predicate that decides whether the alert should fire. */
  filterFn?: (trigger: LogAlertContext) => boolean | Promise<boolean>;

  /** Function that converts the trigger into an {@link AlertMessage}
   *  (or a plain string, which is auto-wrapped as `{ subject: 'Alert', text: <string> }`). */
  notifyFn?: (
    trigger: LogAlertContext
  ) => string | AlertMessage | Promise<string | AlertMessage>;

  /**
   * @param notifiers - The channels that will receive the alert when it fires.
   */
  constructor(public readonly notifiers: Notifier[]) {}

  /**
   * Only fire the alert when the predicate returns true for the trigger.
   */
  filter(fn: (trigger: LogAlertContext) => boolean | Promise<boolean>): this {
    this.filterFn = fn;
    return this;
  }

  /**
   * Trigger this alert when a log message is emitted at any of the given levels.
   */
  onLog(...levels: AlertLogLevel[]): this {
    this.logLevels.push(...levels);
    return this;
  }

  /**
   * Define how the {@link AlertMessage} is built from the trigger.
   * Returning a string is shorthand for `{ subject: 'Alert', text: <string> }`.
   */
  notify(
    fn: (
      trigger: LogAlertContext
    ) => string | AlertMessage | Promise<string | AlertMessage>
  ): this {
    this.notifyFn = fn;
    return this;
  }
}
