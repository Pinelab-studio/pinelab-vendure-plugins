import { PluginCommonModule, RuntimeVendureConfig, VendurePlugin } from '@vendure/core';
import { EBoekhoudenService } from './api/e-boekhouden.service';
import { EBoekhoudenOptions } from './api/types';
import { channelCustomFields, eBoekhoudenPermission } from './custom-fields';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [EBoekhoudenService],
  configuration: (config: RuntimeVendureConfig) => {
    config.authOptions.customPermissions.push(eBoekhoudenPermission);
    config.customFields.Channel.push(...channelCustomFields);
    return config;
  },
  compatibility: '>=2.2.0',
})
export class EBoekhoudenPlugin {
  static options: EBoekhoudenOptions;

  static init(options: EBoekhoudenOptions): typeof EBoekhoudenPlugin {
    this.options = options;
    return EBoekhoudenPlugin;
  }
}
