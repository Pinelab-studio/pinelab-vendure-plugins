import {
    AuthenticationStrategy,
    ExternalAuthenticationService,
    Injector,
    Logger,
    RequestContext,
    User,
} from '@vendure/core';
import { JWT } from 'google-auth-library';
import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';

export type GoogleAuthData = {
    credentialJWT: string;
};

interface GoogleAuthPayload {
    iss: string,
    azp: string
    aud: string
    sub: string
    email: string
    email_verified: boolean
    nbf: number,
    name: string
    picture: string
    given_name: string
    family_name: string
    locale: string
    iat: number,
    exp: number,
    jti: string
}

const loggerCtx = 'GoogleAuthStrategy';

/**
 * Authenticate based on Google.
 * 
 * Based on the example here https://docs.vendure.io/guides/core-concepts/auth/#google-authentication
 */
export class GoogleAuthStrategy implements AuthenticationStrategy<GoogleAuthData> {
    readonly name = 'google';
    private client!: import('google-auth-library').OAuth2Client;
    private externalAuthenticationService: ExternalAuthenticationService | undefined;

    constructor(private clientId: string) {
    }

    async init(injector: Injector) {
        // The ExternalAuthenticationService is a helper service which encapsulates much
        // of the common functionality related to dealing with external authentication
        // providers.
        this.externalAuthenticationService = injector.get(ExternalAuthenticationService);
        const { OAuth2Client } = await import('google-auth-library');
        this.client = new OAuth2Client(this.clientId);
    }

    defineInputType(): DocumentNode {
        return gql`
        input GoogleAuthInput {
            """
            The encoded response.credential returned by the Google Sign-In API
            """
            credentialJWT: String!
        }
    `;
    }

    async authenticate(ctx: RequestContext, { credentialJWT }: GoogleAuthData): Promise<User | false> {
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

            // First we check to see if this user has already authenticated in our
            // Vendure server using this Google account. If so, we return that
            // User object, and they will be now authenticated in Vendure.
            const user = await this.externalAuthenticationService!.findAdministratorUser(ctx, this.name, payload.email);
            console.log('USER', user);
            if (user) {
                return user;
            }

            // If no user was found, we need to create a new User and Customer based
            // on the details provided by Google. The ExternalAuthenticationService
            // provides a convenience method which encapsulates all of this into
            // a single method call.
            return this.externalAuthenticationService!.createCustomerAndUser(ctx, {
                strategy: this.name,
                externalIdentifier: payload.sub,
                verified: payload.email_verified || false,
                emailAddress: payload.email,
                firstName: payload.given_name,
                lastName: payload.family_name,
            });
        } catch (error: any) {
            Logger.error(`Error verifying Google JWT: ${error}`, loggerCtx, error?.stack);
            return false;
        }

    }
}