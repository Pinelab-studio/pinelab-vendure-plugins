import { Controller, Get, Inject, Res } from '@nestjs/common';
import {
  ConfigService,
  VENDURE_VERSION
} from '@vendure/core';
import { Response } from 'express';
import fs from 'fs/promises';
import Handlebars from 'handlebars';
import { PLUGIN_INIT_OPTIONS } from '../constants';
import { SocialAuthPluginOptions } from '../social-auth.plugin';
import { AdminUiConfig } from '@vendure/common/lib/shared-types';

/**
 * Custom login page
 */
@Controller()
export class LoginController {

constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private readonly options: SocialAuthPluginOptions,
    private configService: ConfigService,
    ) { }

  @Get('social-auth/login')
  async getLogin(
    @Res() res: Response,
  ): Promise<void> {
    const adminUiPlugin = (this.configService.plugins.find(plugin => (plugin as any).options?.adminUiConfig));
    const adminUiConfig: Partial<AdminUiConfig> | undefined  =  (adminUiPlugin as any).options?.adminUiConfig;
    const loginHtml = await fs.readFile(`${__dirname}/../ui/login.html`, 'utf8');
    const rendered = Handlebars.compile(loginHtml)({ 
      clientId: this.options.google?.oAuthClientId,
      version: VENDURE_VERSION,
      brand: adminUiConfig?.brand,
      hideVendureBranding: adminUiConfig?.hideVendureBranding,
      hideVersion: adminUiConfig?.hideVersion,
    });
    res.send(rendered);
  }
}