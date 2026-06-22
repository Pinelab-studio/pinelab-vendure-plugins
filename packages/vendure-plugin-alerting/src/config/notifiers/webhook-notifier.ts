import fetch from 'node-fetch';
import { AlertMessage } from '../../types';
import { Notifier } from '../notifier';

interface WebhookNotifierConfig {
  name: string;
  url: string;
  method?: 'POST' | 'GET';
  headers?: Record<string, string>;
}

export class WebhookNotifier implements Notifier {
  readonly name: string;

  constructor(private config: WebhookNotifierConfig) {
    this.name = config.name;
  }

  async notify(message: AlertMessage): Promise<void> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(this.config.headers || {}),
      ...(message.metadata?.headers || {}),
    };
    const body =
      this.config.method === 'GET'
        ? undefined
        : JSON.stringify(message.metadata?.body ?? message);
    const res = await fetch(this.config.url, {
      method: this.config.method || 'POST',
      headers,
      body,
    });
    if (!res.ok) {
      throw new Error(
        `Webhook ${this.name} returned ${res.status}: ${await res.text()}`
      );
    }
  }
}
