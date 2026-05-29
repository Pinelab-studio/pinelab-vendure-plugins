import { ModuleRef } from '@nestjs/core';
import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  EventBus,
  Injector,
  JobQueue,
  JobQueueService,
  Logger,
  RequestContext,
  Type,
  VendureEvent,
  VendureLogger,
} from '@vendure/core';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import {
  AlertingPluginOptions,
  AlertLogLevel,
  AlertMessage,
  AlertTrigger,
  LogAlertContext,
} from '../types';
import { EventAlert } from '../config/event-alert';
import { LogAlert } from '../config/log-alert';
import { Notifier } from '../config/notifier';
import { AlertingLogger } from './alert-logger';

type AlertJobData = {
  notifierName: string;
  alertMessage: AlertMessage;
};

@Injectable()
export class AlertingService implements OnModuleInit, OnApplicationBootstrap {
  private jobQueue!: JobQueue<any>;
  private dedupMap = new Map<string, number>();
  private notifiersByName = new Map<string, Notifier>();

  private injector: Injector;

  constructor(
    private eventBus: EventBus,
    private jobQueueService: JobQueueService,
    @Inject(PLUGIN_INIT_OPTIONS) private options: AlertingPluginOptions,
    private moduleRef: ModuleRef
  ) {
    this.injector = new Injector(this.moduleRef);
  }

  async onModuleInit(): Promise<void> {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'alerting-notify',
      process: async (job) => {
        try {
          await this.processJob(job.data.notifierName, job.data.alertMessage);
        } catch (e: unknown) {
          const err = e instanceof Error ? e : new Error(String(e));
          Logger.error(
            `Failed to process alert job for notifier "${job.data.notifierName}": ${err.message}`,
            loggerCtx,
            err.stack
          );
          throw e;
        }
      },
    });
  }

  onApplicationBootstrap(): void {
    // Build notifier lookup from all alerts
    for (const alert of this.options.alerts) {
      for (const notifier of alert.notifiers) {
        this.notifiersByName.set(notifier.name, notifier);
      }
    }

    // Subscribe to configured events (EventAlert only)
    for (const alert of this.options.alerts) {
      if (alert instanceof EventAlert) {
        for (const EventType of alert.events) {
          this.eventBus.ofType(EventType).subscribe(async (event) => {
            try {
              await this.handleTrigger(alert, event);
            } catch (e: unknown) {
              Logger.error(
                `Failed to handle event ${
                  (event as any).constructor.name
                } for alert: ${e}`,
                loggerCtx
              );
            }
          });
        }
      }
    }

    // Subscribe to log buffer (LogAlert only)
    AlertingLogger.setHandler((log) => {
      for (const alert of this.options.alerts) {
        if (alert instanceof LogAlert && alert.logLevels.includes(log.level)) {
          this.handleTrigger(alert, log).catch((e) => {
            Logger.error(`Failed to handle log alert: ${e}`, loggerCtx);
          });
        }
      }
    });
  }

  static wrapLogger(logger: VendureLogger): VendureLogger {
    return new AlertingLogger(logger);
  }

  private async handleTrigger(
    alert: EventAlert<any> | LogAlert,
    trigger: VendureEvent | LogAlertContext
  ): Promise<void> {
    let raw: string | AlertMessage;

    if (alert instanceof LogAlert) {
      // Prevent infinite loops: skip logs emitted by this plugin
      const logCtx = (trigger as LogAlertContext).loggerCtx;
      if (logCtx === loggerCtx) {
        return;
      }

      // Apply filter if configured
      if (alert.filterFn) {
        const passes = await alert.filterFn(trigger as LogAlertContext);
        if (!passes) {
          return;
        }
      }

      if (!alert.notifyFn) {
        return;
      }
      raw = await alert.notifyFn(trigger as LogAlertContext);
    } else if (alert instanceof EventAlert) {
      // Apply filter if configured
      if (alert.filterFn) {
        const passes = await alert.filterFn(trigger as VendureEvent);
        if (!passes) {
          return;
        }
      }

      if (!alert.eventNotifyFn) {
        return;
      }
      const event = trigger as VendureEvent;
      const ctx = (event as any).ctx as RequestContext | undefined;
      raw = await alert.eventNotifyFn(ctx, this.injector, event);
    } else {
      return;
    }

    const message: AlertMessage =
      typeof raw === 'string' ? { subject: 'Alert', text: raw } : raw;

    // Enqueue one job per notifier
    for (const notifier of alert.notifiers) {
      await this.jobQueue.add({
        notifierName: notifier.name,
        alertMessage: message,
      } as AlertJobData);
    }
  }

  private async processJob(
    notifierName: string,
    message: AlertMessage
  ): Promise<void> {
    const windowMs = this.options.deduplicationWindowMs ?? 60_000;
    const key = this.dedupKey(notifierName, message);

    const lastSent = this.dedupMap.get(key);
    const now = Date.now();
    if (lastSent && now - lastSent < windowMs) {
      Logger.info(
        `Dropping duplicate alert for notifier "${notifierName}" with subject "${message.subject}"`,
        loggerCtx
      );
      return;
    }

    this.dedupMap.set(key, now);
    this.cleanupDedupMap(windowMs);

    const notifier = this.notifiersByName.get(notifierName);
    if (!notifier) {
      throw new Error(`Notifier "${notifierName}" not found`);
    }
    await notifier.notify(message);
    Logger.info(
      `Sent alert to notifier "${notifierName}" with subject "${message.subject}"`,
      loggerCtx
    );
  }

  private dedupKey(notifierName: string, message: AlertMessage): string {
    const str = `${notifierName}:${message.subject}:${message.text}`;
    return this.hash(str);
  }

  private hash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString(16);
  }

  private cleanupDedupMap(windowMs: number): void {
    const cutoff = Date.now() - windowMs;
    for (const [key, ts] of this.dedupMap.entries()) {
      if (ts < cutoff) {
        this.dedupMap.delete(key);
      }
    }
  }
}
