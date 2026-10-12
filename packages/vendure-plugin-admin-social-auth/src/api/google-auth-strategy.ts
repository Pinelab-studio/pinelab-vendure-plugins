import {
  Administrator,
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
import { IsNull } from 'typeorm';

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
  private connection: TransactionalConnection | undefined;

  constructor(private readonly clientId: string) {}

  async init(injector: Injector) {
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
      // Login is unauthenticated, so do not use AdministratorService.findAll(),
      // which filters administrators by the active user's role visibility.
      const admins = await this.connection!.getRepository(
        ctx,
        Administrator
      ).find({
        where: { emailAddress: email, deletedAt: IsNull() },
        relations: ['user', 'user.authenticationMethods'],
      });
      if (admins.length > 1) {
        Logger.error(
          `Multiple admins for '${email}' found. Only one should exist. Unable to login`,
          loggerCtx
        );
        return false;
      }
      if (admins.length === 0) {
        // No admins exist for this email address, not logging in
        Logger.warn(
          `Attempted login from user that is not an administrator`,
          loggerCtx
        );
        return false;
      }
      // An admin exists in Vendure
      const admin = admins[0];
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
