import {
  AdministratorService,
  AuthenticationStrategy,
  ExternalAuthenticationMethod,
  Injector,
  Logger,
  RequestContext,
  TransactionalConnection,
  User,
} from '@vendure/core';
import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';

export interface GoogleAuthData {
  credentialJWT: string;
}

const loggerCtx = 'GoogleAuthStrategy';

/**
 * Authenticate based on Google.
 *
 * Based on the example here https://docs.vendure.io/guides/core-concepts/auth/#google-authentication
 */
export class GoogleAuthStrategy
  implements AuthenticationStrategy<GoogleAuthData>
{
  readonly name = 'google';
  private client!: import('google-auth-library').OAuth2Client;
  private adminService: AdministratorService | undefined;
  private connection: TransactionalConnection | undefined;

  constructor(private readonly clientId: string) {}

  async init(injector: Injector) {
    this.adminService = injector.get(AdministratorService);
    this.connection = injector.get(TransactionalConnection);
    // Inline import, because the google-auth-library package is only available if consumers specify Google as auth method
    const { OAuth2Client } = await import('google-auth-library');
    this.client = new OAuth2Client(this.clientId);
  }

  defineInputType(): DocumentNode {
    return gql`
      input GoogleAuthInput {
        """
        The encoded response credential returned by the Google Sign-In API
        """
        credentialJWT: String!
      }
    `;
  }

  async authenticate(
    ctx: RequestContext,
    { credentialJWT }: GoogleAuthData
  ): Promise<User | false> {
    // Here is the logic that uses the token provided by the storefront and uses it
    // to find the user data from Google.
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credentialJWT,
        audience: this.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return false;
      }
      const email = payload.email;
      // First we check to see if this user is an admin in our Vendure server
      const admins = await this.adminService!.findAll(
        ctx,
        { filter: { emailAddress: { eq: email } } },
        ['user', 'user.authenticationMethods']
      );
      if (admins.totalItems > 1) {
        Logger.error(
          `Multiple admins for '${email}' found. Only one should exist. Unable to login`,
          loggerCtx
        );
        return false;
      }
      if (admins.totalItems === 0) {
        // No admins exist for this email address, not logging in
        Logger.warn(
          `Attempted login with '${email}', but this is not an administrator`,
          loggerCtx
        );
        return false;
      }
      // An admin exists in Vendure
      const admin = admins.items[0];
      let user = admin.user;
      // Check if GoogleAuth already enabled, otherwise enable it for this admin
      const hasGoogleAuth = user.authenticationMethods.find(
        (m) => (m as ExternalAuthenticationMethod).strategy === this.name
      );
      if (!hasGoogleAuth) {
        user = await this.addGoogleAuthMethod(ctx, user, email);
      }
      Logger.info(`Admin '${email}' logged in`, loggerCtx);
      return user;
    } catch (error) {
      if (error instanceof Error) {
        Logger.error(
          `Error authenticating with Google login: ${error.message}`,
          loggerCtx,
          error.stack
        );
      } else {
        Logger.error(
          `Unknown error authenticating with Google login: ${String(error)}`,
          loggerCtx
        );
      }
      return false;
    }
  }

  /**
   * Adds Google auth as authentication method for this user.
   */
  private async addGoogleAuthMethod(
    ctx: RequestContext,
    user: User,
    externalIdentifier: string
  ): Promise<User> {
    const googleAuthMethod = await this.connection!.getRepository(
      ctx,
      ExternalAuthenticationMethod
    ).save(
      new ExternalAuthenticationMethod({
        externalIdentifier,
        strategy: this.name,
      })
    );
    user.authenticationMethods.push(googleAuthMethod);
    return await this.connection!.getRepository(ctx, User).save(user);
  }
}
