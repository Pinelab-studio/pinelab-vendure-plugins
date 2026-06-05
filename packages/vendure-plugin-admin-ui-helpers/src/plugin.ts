import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';

@VendurePlugin({
  imports: [PluginCommonModule],
  compatibility: '>=3.2.0',
  dashboard: './dashboard/index.tsx',
})
export class AdminUIHelpersPlugin {}
