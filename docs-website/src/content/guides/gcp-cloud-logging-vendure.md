---
slug: gcp-cloud-logging-vendure
title: Send Vendure logs to Google Cloud Logging
description: Wire up a custom VendureLogger that sends server and worker logs to Google Cloud Logging via Winston, so everything is visible in the GCP Log Viewer.
pubDate: 2026-06-25
author: Martijn
heroImage: https://images.unsplash.com/photo-1623018035782-b269248df916?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&w=2000
heroImageSmall: https://images.unsplash.com/photo-1623018035782-b269248df916?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&w=500
heroImageAlt: Cloud computing dashboard with charts and logs
---

When you run Vendure on Google Cloud Run (or any GCP environment) the default `console.log` output is technically captured, but it shows up as plain text streams. To get structured logs, filtering by severity, service name, and trace correlation, you need a logger that talks directly to the Cloud Logging API.

This guide walks through a minimal `CloudLogger` implementation using **Winston** and **`@google-cloud/logging-winston`**, plus the wiring needed to keep a local `DefaultLogger` for development.

## Dependencies

```bash
npm install winston @google-cloud/logging-winston
```

No extra GCP configuration is required if your runtime already has a service account with the `Logs Writer` role (Compute Engine instances get this by default).

## The logger implementation

Create a new class that implements Vendure's `VendureLogger` interface. The implementation is a thin wrapper around a Winston logger that uses the `LoggingWinston` transport to push every log entry to GCP.

```ts
// vendure/src/config/gcp-logger.ts
import winston, { format, Logger } from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';
import { VendureLogger } from '@vendure/core';

const { combine, errors } = format;

export class GCPLogger implements VendureLogger {
  constructor(private logger: Logger, name: string) {}

  error(message: string, context?: string, trace?: string) {
    this.logger.error(message, { trace, labels: this.getLabels(context) });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { labels: this.getLabels(context) });
  }

  info(message: string, context?: string) {
    this.logger.info(message, { labels: this.getLabels(context) });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { labels: this.getLabels(context) });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { labels: this.getLabels(context) });
  }

  private getLabels(context?: string) {
    return {
      module: context,
      name: process.env.LOGGER_FILENAME ?? 'LOGGER_FILENAME-not-set', // Should resolve to 'server' or 'worker'
    };
  }
}

export function createGCPLogger(): GCPLogger {
  // This will be the log file name in Google Cloud under the dropdown Log names in GCP
  const cloudLoggingWinston = new LoggingWinston({
    logName: 'vendure_prod',
  });

  const winstonLogger = winston.createLogger({
    format: combine(errors({ stack: true })),
    level: 'info',
    transports: [cloudLoggingWinston],
  });

  return new GCPLogger(winstonLogger);
}
```

Key details:

- **`logName: 'vendure_prod'`** is the log name you will see in the GCP Log Viewer dropdown.
- **`level: 'info'`** means `debug` and `verbose` are filtered out before they reach Cloud Logging. Keep this in mind if you need lower levels in production.
- **`labels: { name, module }`** make the logs filterable by service (server vs worker) and by Vendure context (e.g. `JobQueueService`).
- **`errors({ stack: true })`** ensures stack traces are captured and sent as part of the error log entry.

## Wiring it into the Vendure config

The shared `vendure-config.ts` should still use the familiar `DefaultLogger` when running locally. For production, we leave the logger as `undefined` so the entry points can inject the cloud variant.

```ts
// vendure/src/vendure-config.ts
import { DefaultLogger, LogLevel, VendureConfig } from '@vendure/core';

const IS_LOCAL = process.env.APP_ENV === 'local';

export const config: VendureConfig = {
  // ... all your existing options
  // When local use default logger, otherwise push to GCP logs.
  logger: IS_LOCAL
    ? new DefaultLogger({ level: LogLevel.Debug })
    : createGCPLogger(),
  plugins: [
    // ...
  ],
};
```

## Differentiating server and worker

Vendure has two entry points: `index.ts` for the server and `index-worker.ts` for the worker. Both import the same config object, but we want separate log labels so we can tell in the Log Viewer whether a message came from the server or the worker.

Spread the config and override the logger for each process:

```ts
// vendure/src/index.ts
import { bootstrap } from '@vendure/core';
import { config } from './vendure-config';

process.env.LOGGER_FILENAME = 'server';

bootstrap(config).catch((err) => {
  console.log(err);
});
```

```ts
// vendure/src/index-worker.ts
import { bootstrapWorker } from '@vendure/core';
import { config } from './vendure-config';

process.env.LOGGER_FILENAME = 'worker';

bootstrapWorker(config)
  .then(async (worker) => {
    await worker.startJobQueue();
    await worker.startHealthCheckServer({ port: 3001 });
  })
  .catch((err) => {
    console.log(err);
  });
```

## What you see in GCP Log Viewer

Once deployed, open the [Log Viewer](https://console.cloud.google.com/logs) and select the `vendure_prod` log name. Every log entry carries the standard Winston metadata plus the custom labels you added:

- `severity` — `ERROR`, `WARN`, `INFO`, etc.
- `labels.name` — `server` or `worker`
- `labels.module` — the Vendure context string (e.g. `ProductService`, `JobQueueService`)
- `trace` — populated for `error()` calls, so you can jump from the log entry to the full stack trace

You can query directly with the Log Viewer filter bar, for example:

```
labels.name="worker"
severity=ERROR
```

## Wrapping up

The pattern is straightforward: **implement `VendureLogger` with a Winston transport, keep the local default for development, and inject the cloud variant per entry point**. This gives you structured, filterable, severity-aware logs in GCP without sacrificing the simple console output you rely on during local development.
