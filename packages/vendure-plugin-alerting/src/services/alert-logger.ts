import { VendureLogger } from '@vendure/core';
import { AlertLogLevel, LogAlertContext } from '../types';

/**
 * VendureLogger wrapper that forwards log calls to the original logger
 * and buffers entries so the AlertingService can process them.
 */
export class AlertingLogger implements VendureLogger {
  private static logBuffer: LogAlertContext[] = [];
  private static isReady = false;
  private static onLogHandler?: (log: LogAlertContext) => void;

  static setHandler(handler: (log: LogAlertContext) => void): void {
    this.onLogHandler = handler;
    this.isReady = true;
    // Flush buffered logs
    while (this.logBuffer.length > 0) {
      const log = this.logBuffer.shift()!;
      handler(log);
    }
  }

  static pushLog(level: AlertLogLevel, message: string, ctx?: string): void {
    const log: LogAlertContext = { level, message, loggerCtx: ctx };
    if (this.isReady && this.onLogHandler) {
      this.onLogHandler(log);
    } else {
      this.logBuffer.push(log);
    }
  }

  constructor(private readonly wrapped: VendureLogger) {}

  info(message: string, ctx?: string): void {
    this.wrapped.info(message, ctx);
    AlertingLogger.pushLog('info', message, ctx);
  }

  warn(message: string, ctx?: string): void {
    this.wrapped.warn(message, ctx);
    AlertingLogger.pushLog('warn', message, ctx);
  }

  error(message: string, ctx?: string, trace?: string): void {
    this.wrapped.error(message, ctx, trace);
    AlertingLogger.pushLog('error', message, ctx);
  }

  debug(message: string, ctx?: string): void {
    this.wrapped.debug(message, ctx);
  }

  verbose(message: string, ctx?: string): void {
    this.wrapped.verbose(message, ctx);
  }
}
