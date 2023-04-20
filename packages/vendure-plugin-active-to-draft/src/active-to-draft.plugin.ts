import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { adminApiExtension } from './api/api.extension';
import { AdminApiResolver } from './api/api.resolver';
import { OrderTransitionListenerService } from './api/order-transition-listener.service';
import { convertToDraftButton } from './ui';
@VendurePlugin({
  imports: [PluginCommonModule],
  adminApiExtensions: {
    resolvers: [AdminApiResolver],
    schema: adminApiExtension,
  },
  providers: [OrderTransitionListenerService],
})
export class ActiveToDraftPlugin {
  static ui: AdminUiExtension = convertToDraftButton;
}
