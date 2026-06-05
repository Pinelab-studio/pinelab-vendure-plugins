import { Controller, Get, Inject } from '@nestjs/common';
import { AdminSocialAuthPluginOptions } from '../admin-social-auth.plugin';
import { PLUGIN_INIT_OPTIONS } from '../constants';

/**
 * Custom login page
 */
@Controller()
export class LoginController {
  constructor(
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: AdminSocialAuthPluginOptions
  ) {}

  @Get('social-auth/config')
  getConfig(): { googleClientId: string | undefined } {
    return { googleClientId: this.options.google?.oAuthClientId };
  }
}
