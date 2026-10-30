import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { AlertingService } from './services/alerting.service';
import { AlertingPluginOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    AlertingService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => AlertingPlugin.options,
    },
  ],
  configuration: (config) => {
    config.logger = AlertingService.wrapLogger(config.logger);
    return config;
  },
  compatibility: '>=3.2.0',
})
export class AlertingPlugin {
  static options: AlertingPluginOptions = {
    alerts: [],
  };

  static init(options: AlertingPluginOptions): Type<AlertingPlugin> {
    AlertingPlugin.options = {
      ...AlertingPlugin.options,
      ...options,
    };
    return AlertingPlugin;
  }
}
