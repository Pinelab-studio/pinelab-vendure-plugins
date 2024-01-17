# Vendure Social Authentication for Administrators

Allow admins to login with social accounts like Google.

Currently this plugin only supports Google login for the Admin UI! The plugin setup allows for easy extension of other auth providers in either shop or admin though. Contributions welcome: Contact us via Discord and we'll help you get started on contributing.

## Allow admins to login with Google

https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

1. Install `google-auth-library`: `yarn add google-auth-library`

2. In your vendure-config, add the plugin:
```ts
import { SocialAuthPlugin } from '@pinelab/vendure-plugin-social-auth';

...
plugins: [
      SocialAuthPlugin.init({
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
// TODO this checks for existance of users, regardless of auth strategy







