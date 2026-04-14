# Vendure Social Authentication for Administrators

[Official documentation here](https://plugins.pinelab.studio/plugin/vendure-plugin-admin-social-auth)

Allow admins to login with social accounts like Google.

> **Note:** This plugin (v2.0.0+) only works with the React Dashboard. For the Angular Admin UI, use [v1.4.0](https://www.npmjs.com/package/@pinelab/vendure-plugin-admin-social-auth/v/1.4.0).

The plugin setup allows for easy extension of other auth providers. Contributions welcome: Contact us via Discord or Github and we'll help you get started on contributing.

You will be able to login if an administrator with your email address already exists in Vendure. Roles and permissions are still handled in Vendure. This plugin disables the native authentication method, so you will only be able to login via Google.

![image](https://plugins.pinelab.studio/plugin-images/admin-google.png)

## Set up Google login

First, you need to get your Google Client id using these steps: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid.
This should give you a client id that looks something like `xxxxx.apps.googleusercontent.com`

1. Install `google-auth-library`: `npm install google-auth-library`

2. In your `vendure-config.ts`, add the plugin:

```ts
import { AdminSocialAuthPlugin } from '@pinelab/vendure-plugin-admin-social-auth';

...
plugins: [
      AdminSocialAuthPlugin.init({
        google: {
          oAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        },
      }),
]
```

3. Run `npx vite build`

4. Start the server and navigate to `localhost:3000/dashboard/`
5. Login with your Google account
6. If an administrator exists with the same email address, you will be redirected to your dashboard.

## Managing administrators

Administrators are managed via the default Vendure Admin UI. Just create an administrator with the same email address as the social account.
When an admin logs in with a social account for the first time, the social auth method will be added to the `user.authenticationMethods`.
