import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import path from 'path';
import { AdminUiExtension } from '@vendure/ui-devkit/compiler';
import { EBoekhoudenService } from './api/e-boekhouden.service';
import { EBoekhoudenConfigEntity } from './api/e-boekhouden-config.entity';
import { schema } from './api/schema.graphql';
import { EBoekhoudenResolver } from './api/e-boekhouden.resolver';
import { eBoekhoudenPermission } from './index';

@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [EBoekhoudenConfigEntity],
  providers: [EBoekhoudenService],
  adminApiExtensions: {
    schema,
    resolvers: [EBoekhoudenResolver],
  },
  configuration: (config) => {
    config.authOptions.customPermissions.push(eBoekhoudenPermission);
    return config;
  },
})
export class EBoekhoudenPlugin {
  static ui: AdminUiExtension = {
    extensionPath: path.join(__dirname, 'ui'),
    ngModules: [
      {
        type: 'lazy',
        route: 'e-boekhouden',
        ngModuleFileName: 'e-boekhouden.module.ts',
        ngModuleName: 'EBoekhoudenModule',
      },
      {
        type: 'shared',
        ngModuleFileName: 'e-boekhouden-nav.module.ts',
        ngModuleName: 'EBoekhoudenNavModule',
      },
    ],
  };
}
