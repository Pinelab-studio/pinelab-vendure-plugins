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
<html>
  <head>
    <title>Login</title>
    <meta name="google-signin-client_id" content="${this.options.adminLoginProviders[0].googleOAuthClientId}">
    <script src="https://accounts.google.com/gsi/client" async></script>
  </head>
  <body>

    <div class="center-screen">

        <br/>
        <br/>

        <h1>Vendure login</h1>

        <br/>
        <br/>

    </div>

    <div class="center-screen">

      <div id="g_id_onload"
      data-client_id="356042804683-gnu05tq9f41ojgcm2oml3sfc98pdcie8.apps.googleusercontent.com"
      data-context="signin"
      data-ux_mode="popup"
      data-callback="handleCredentialResponse"
      data-auto_prompt="false">
      </div>

      <div class="g_id_signin"
          data-type="standard"
          data-shape="rectangular"
          data-theme="outline"
          data-text="signin_with"
          data-size="large"
          data-logo_alignment="left">
      </div>

    </div>

  <script type="text/javascript">
    async function handleCredentialResponse(response) {
      console.log('handleCredentialResponse', response)
      const res = await fetch('/admin-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: \`mutation { authenticate(input: { google: {credentialJWT: "\${response.credential}"}}) { ... on CurrentUser { identifier } ... on ErrorResult { message } }}\` }),
    });
    const json = await res.json();
    console.log(json);
  }
  </script>

  </body>
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #282828;
    }
    .center-screen {
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
  </style>
</html>
    `);
  }
}