# Vendure Alerting Plugin

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-alerting)

Send notifications based on Vendure events and log messages via configurable notifiers like webhooks, slack or N8N.

## Getting started

```ts
import {
  AlertingPlugin,
  EventAlert,
  LogAlert,
  WebhookNotifier,
} from '@pinelab/vendure-plugin-alerting';
import { PaymentStateTransitionEvent } from '@vendure/core';

// Slack example. Get the webhook URL from your slack account: https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/
const slack = new WebhookNotifier({
  name: 'slack',
  url: process.env.SLACK_WEBHOOK!,
});

const n8n = new WebhookNotifier({
  name: 'n8n',
  url: 'https://n8n.example.com/webhook/alert',
});

const plugins: VendurePlugin[] = [
  AlertingPlugin.init({
    alerts: [
      // Alert on order payment failure
      new EventAlert([slack, n8n])
        .on(PaymentStateTransitionEvent)
        .filter((e) => e.toState === 'Error')
        .notify((e) => `Payment error for order "${e.order.code}"`),

      // Alert on any error log from PaymentService
      new LogAlert([slack])
        .onLog('error', 'warn')
        .filter((log) => log.loggerCtx === 'PaymentService')
        .notify((log) => ({
          subject: `[${log.level}] ${log.loggerCtx}`,
          text: log.message,
        })),
    ],
    // Deduplicate identical notifications to prevent alert storms: Only notify every once per X ms
    deduplicationWindowMs: 60_000, // default
  }),
];
```

## API

### `EventAlert<E extends VendureEvent = never>`

Builder class for defining event-based alerts. The generic `E` is inferred from the events passed to `on()`.

| Method          | Description                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| `on(...events)` | Trigger on one or more Vendure events.                                            |
| `filter(fn)`    | Only alert if `fn(event)` returns `true`.                                         |
| `notify(fn)`    | Build the `AlertMessage`. `fn` can return a `string` or an `AlertMessage` object. |

### `LogAlert`

Builder class for defining log-based alerts.

| Method             | Description                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| `onLog(...levels)` | Trigger on log messages at the given levels.                                      |
| `filter(fn)`       | Only alert if `fn(logContext)` returns `true`.                                    |
| `notify(fn)`       | Build the `AlertMessage`. `fn` can return a `string` or an `AlertMessage` object. |

### `Notifier`

Interface for outgoing delivery channels.

```ts
interface Notifier {
  readonly name: string;
  notify(message: AlertMessage): Promise<void>;
}
```

### `WebhookNotifier`

Generic HTTP notifier. Sends the `AlertMessage` as JSON by default.

```ts
new WebhookNotifier({
  name: string;
  url: string;
  method?: 'POST' | 'GET'; // default POST
  headers?: Record<string, string>;
});
```

Per-request headers can be provided via `message.metadata.headers` in the `notify` callback.

### `AlertMessage`

```ts
interface AlertMessage {
  subject: string;
  text: string;
  metadata?: Record<string, any>;
}
```

# Custom Notifiers

Implement the `Notifier` interface to create custom channels (e.g. email, SMS).

```ts
import { AlertMessage, Notifier } from '@pinelab/vendure-plugin-alerting';

export class CustomNotifier implements Notifier {
  name = 'my-custom-notifier';

  notify(message: AlertMessage): Promise<void> {
    // This is where you would implement the logic to send the alert message to your desired destination,
  }
}
```

## Deduplication

Identical alerts (same notifier + subject + text) fired within `deduplicationWindowMs` are dropped. This prevents alert storms when many events fire in rapid succession.

## Retry

Alert delivery is backed by the Vendure JobQueue. If a notifier throws, the job is retried with the configured retry strategy.

## License

MIT
