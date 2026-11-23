import { PermissionDefinition } from '@vendure/core';

export const contentHealthLoggerCtx = 'ContentHealth';
/**
 * Injection token for the `contentHealth` options of `ContentAutomationPlugin.init()`.
 * Resolves to `undefined` when content health is not configured.
 */
export const CONTENT_HEALTH_OPTIONS = Symbol('CONTENT_HEALTH_OPTIONS');

/**
 * Shows the content health Dashboard UI. Only registered when content health is enabled, so the UI is
 * hidden otherwise. Presentation only: the Admin API keeps its own permission requirements.
 */
export const contentHealthPermission = new PermissionDefinition({
  name: 'ContentHealth',
  description: 'Allows viewing content health issues in the Dashboard',
});
