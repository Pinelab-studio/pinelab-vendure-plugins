# Vendure Social Authentication for Administrators

Allow admins to login with social accounts like Google.

Currently this plugin only supports Google login for the Admin UI! The plugin setup allows for easy extension of other auth providers though. Contributions welcome: Contact us via Discord and we'll help you get started on contributing.

You will be able to login if an administrator with your email address already exists in Vendure. Roles and permissions are still handled in Vendure. This plugin disables the native authentication method, so you will only be able to login via Google.

## Set up Google login

First, you need to get your Google Client id using these steps: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid.
This should give you a client id that looks something like `xxxxx.apps.googleusercontent.com`

1. Install `google-auth-library`: `yarn add google-auth-library`

2. In your `vendure-config.ts`, add the plugin and set the new login url in the AdminUiPlugin:

```ts
import { AdminSocialAuthPlugin } from '@pinelab/vendure-plugin-admin-social-auth';

...
plugins: [
      AdminSocialAuthPlugin.init({
        adminLoginProviders: [{
          googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        }],
      }),
      // Set the new custom login URL
      AdminUiPlugin.init({
          port: 3002,
          adminUiConfig: {
              loginUrl: '/social-auth/login',
          },
      }),
]
```

3. Start the server and navigate to `localhost:3000/admin`, it should automatically redirect you to `/social-auth/login`
4. Login with your Google account
5. If an administrator exists with the same email address, you will be redirected to your dashboard.

# Managing administrators

Administrators are managed via the default Vendure Admin UI. Just create an administrator with the same email address as the social account.
When an admin logs in with a social account for the first time, the social auth method will be added to the `user.authenticationMethods`.

If you want to login with the `superadmin` username/password again, you will need to disable this plugin and remove the `adminUiConfig.loginUrl` setting from the AdminUiPlugin again.
