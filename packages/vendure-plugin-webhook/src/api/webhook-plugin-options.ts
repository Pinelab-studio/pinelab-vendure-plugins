import { Injector, ProductEvent, VendureEvent } from '@vendure/core';

export interface WebhookRequestFnResult {
  body?: ArrayBuffer | ArrayBufferView | NodeJS.ReadableStream | string;
  headers?: Record<string, string>;
}
export type WebhookRequestFn<T> = (
  event: T,
  injector: Injector
) => Promise<WebhookRequestFnResult>;

export interface WebhookPluginOptions<T extends VendureEvent> {
  /**
   * Trigger webhooks if one of these events occur.
   */
  events: { new (...args: any[]): VendureEvent }[];
  /**
   * Do a POST or a GET request
   */
  httpMethod: 'GET' | 'POST';
  /**
   * Define a custom body and headers for the webhook request
   */
  requestFn?: WebhookRequestFn<T>;
  /**
   * Wait for more events for the same channel before calling webhook
   * Delay is in ms
   */
  delay?: number;
  /**
   * Disable the plugin. Default is false
   */
  disabled?: boolean;
}
