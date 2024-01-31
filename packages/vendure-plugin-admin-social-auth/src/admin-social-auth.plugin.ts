import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { GoogleAuthStrategy } from './api/google-auth-strategy';
import { LoginController } from './api/login-controller';

import { loggerCtx, PLUGIN_INIT_OPTIONS } from './constants';

export interface GoogleInput {
  oAuthClientId: string;
}

export interface AdminSocialAuthPluginOptions {
  google?: GoogleInput;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [LoginController],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => AdminSocialAuthPlugin.options,
    },
  ],
  configuration: (config) => {
    const pluginOptions = AdminSocialAuthPlugin.options;
    // Reset the adminAuthenticationStrategy to an empty array, because we only want social logins
    config.authOptions.adminAuthenticationStrategy = [];
    // Set Google as auth
    if (pluginOptions.google?.oAuthClientId) {
      config.authOptions.adminAuthenticationStrategy.push(
        new GoogleAuthStrategy(pluginOptions.google.oAuthClientId)
      );
      Logger.info(`Registered Google auth login for administrators`, loggerCtx);
    }
    return config;
  },
})
export class AdminSocialAuthPlugin {
  static options: AdminSocialAuthPluginOptions;

  static init(
    options: AdminSocialAuthPluginOptions
  ): typeof AdminSocialAuthPlugin {
    this.options = options;
    return AdminSocialAuthPlugin;
  }
}
