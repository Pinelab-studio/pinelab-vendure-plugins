import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { AlertingPluginOptions } from './types';
import { AlertingService } from './services/alerting.service';

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
    this.options = {
      ...this.options,
      ...options,
    };
    return AlertingPlugin;
  }
}
