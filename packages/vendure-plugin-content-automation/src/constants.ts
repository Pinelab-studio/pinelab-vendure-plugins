import { PermissionDefinition } from '@vendure/core';

export const loggerCtx = 'ContentAutomationPlugin';
export const PLUGIN_INIT_OPTIONS = Symbol('PLUGIN_INIT_OPTIONS');

/**
 * Shows the content automation Dashboard UI. Only registered when automation is enabled, so the UI is
 * hidden otherwise. Presentation only: the Admin API keeps its own permission requirements.
 */
export const contentAutomationPermission = new PermissionDefinition({
  name: 'ContentAutomation',
  description: 'Allows viewing content automation in the Dashboard',
});
