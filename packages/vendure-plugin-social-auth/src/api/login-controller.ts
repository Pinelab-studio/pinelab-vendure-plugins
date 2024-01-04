import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { Body, Controller, Get, Headers, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { SocialAuthPluginOptions } from '../social-auth.plugin';
import { PLUGIN_INIT_OPTIONS } from '../constants';

/**
 * Custom login page
 */
@Controller()
export class LoginController {

constructor(
    @Inject(PLUGIN_INIT_OPTIONS) private options: SocialAuthPluginOptions
    ) { }

  @Get('social-auth/login')
  async getLogin(
    @Res() res: Response,
  ): Promise<void> {
    res.send(`
<head>
  <title>Login</title>
  <script src="https://apis.google.com/js/platform.js" async defer></script>
  <meta name="google-signin-client_id" content="${this.options.adminLoginProviders[0].googleOAuthClientId}">
  <script>
  console.log('hello')
    function onSignIn(googleUser) {
        console.log('called');
        var profile = googleUser.getBasicProfile();
        console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
        console.log('Name: ' + profile.getName());
        console.log('Image URL: ' + profile.getImageUrl());
        console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
    }
  </script>
</head>
<html>

<div class="g-signin2" data-onsuccess="onSignIn"></div>

</html>
    `);
  }
}