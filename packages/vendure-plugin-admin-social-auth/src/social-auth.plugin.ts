import { Logger, PluginCommonModule, VendurePlugin } from "@vendure/core";
import { GoogleAuthStrategy } from "./api/google-auth-strategy";
import { LoginController } from "./api/login-controller";

import { loggerCtx, PLUGIN_INIT_OPTIONS } from "./constants";

export interface GoogleInput {
  oAuthClientId: string;
}

export interface SocialAuthPluginOptions {
  google?: GoogleInput;
}

@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [
    LoginController
  ],
  providers: [
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => AdminSocialAuthPlugin.options,
    },
  ],
  configuration: (config) => {
    if (AdminSocialAuthPlugin.options.google?.oAuthClientId) {
      config.authOptions.adminAuthenticationStrategy.push(
        new GoogleAuthStrategy(AdminSocialAuthPlugin.options.google.oAuthClientId),
      );
      Logger.info(`Registered Google auth login for administrators`, loggerCtx);
    }
    return config;
  },
})
export class AdminSocialAuthPlugin {
  static options: SocialAuthPluginOptions;

  static init(options: SocialAuthPluginOptions) {
    this.options = options;
    return AdminSocialAuthPlugin;
  }
}
