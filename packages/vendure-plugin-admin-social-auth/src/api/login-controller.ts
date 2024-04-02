import { Controller, Get, Inject, Res } from '@nestjs/common';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { AdminUiConfig } from '@vendure/common/lib/shared-types';
import { ConfigService, VENDURE_VERSION } from '@vendure/core';
import { Response } from 'express';
import fs from 'fs/promises';
import Handlebars from 'handlebars';
import { AdminSocialAuthPluginOptions } from '../admin-social-auth.plugin';
import { PLUGIN_INIT_OPTIONS } from '../constants';

/**
 * Custom login page
 */
@Controller()
export class LoginController {
  constructor(
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: AdminSocialAuthPluginOptions,
    private readonly configService: ConfigService
  ) {}

  @Get('social-auth/login')
  async getLogin(@Res() res: Response): Promise<void> {
    /* eslint-disable -- Dirty hack to get the private static adminUiConfig*/
    const adminUiConfig: Partial<AdminUiConfig> | undefined = (
      AdminUiPlugin as any
    ).options?.adminUiConfig;
    /* eslint-enable */
    const loginHtml = await fs.readFile(
      `${__dirname}/../ui/login.html`,
      'utf8'
    );
    const tokenMethod = this.configService.authOptions.tokenMethod;
    const rendered = Handlebars.compile(loginHtml)({
      clientId: this.options.google?.oAuthClientId,
      version: VENDURE_VERSION,
      brand: adminUiConfig?.brand,
      hideVendureBranding: adminUiConfig?.hideVendureBranding,
      isCookieTokenMethodEnabled:
        tokenMethod === 'cookie' || tokenMethod.includes('cookie'),
      hideVersion: adminUiConfig?.hideVersion,
    });
    res.send(rendered);
  }
}
