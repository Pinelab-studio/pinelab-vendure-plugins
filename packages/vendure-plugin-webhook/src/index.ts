import { PermissionDefinition } from '@vendure/core';
// Permission needs to be defined first
export const webhookPermission = new PermissionDefinition({
  name: 'SetWebhook',
  description: 'Allows setting a webhook URL',
});

export * from './webhook.plugin';
export * from './api/webhook-plugin-options';
