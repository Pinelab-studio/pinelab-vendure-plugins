import { PluginCommonModule, VendurePlugin } from "@vendure/core";
import { GoogleAuthStrategy } from "./api/google-auth-strategy";
import { LoginController } from "./api/login-controller";

import { PLUGIN_INIT_OPTIONS } from "./constants";

export interface GoogleInput {
  googleOAuthClientId: string;
}

export interface SocialAuthPluginOptions {
  /**
   * Determine what type of login providers are available for the admin.
   */
  adminLoginProviders: (GoogleInput)[];
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
    for (const provider of AdminSocialAuthPlugin.options.adminLoginProviders) {
      if (provider.googleOAuthClientId) {
        config.authOptions.adminAuthenticationStrategy = [
          new GoogleAuthStrategy(provider.googleOAuthClientId),
        ];
      }
      // TODO add other providers here
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
