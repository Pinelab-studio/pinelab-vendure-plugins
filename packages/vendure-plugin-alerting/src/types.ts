import { EventAlert, LogAlert } from './config/alert';

export interface AlertMessage {
  subject: string;
  text: string;
  metadata?: Record<string, any>;
}

export type AlertLogLevel = 'info' | 'warn' | 'error';

export interface LogAlertContext {
  level: AlertLogLevel;
  message: string;
  loggerCtx?: string;
}

export type AlertTrigger<E = unknown> = E | LogAlertContext;

export interface AlertingPluginOptions {
  alerts: Array<EventAlert<any> | LogAlert>;
  /**
   * Time window for deduplication in ms. Identical AlertMessages
   * (same notifier + subject + text hash) within this window are dropped.
   * Default: 60_000
   */
  deduplicationWindowMs?: number;
}
