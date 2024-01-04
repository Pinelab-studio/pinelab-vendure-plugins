import {
    AuthenticationStrategy,
    ExternalAuthenticationService,
    Injector,
    RequestContext,
    User,
} from '@vendure/core';
import { OAuth2Client } from 'google-auth-library';
import { DocumentNode } from 'graphql';
import gql from 'graphql-tag';

export type GoogleAuthData = {
    token: string;
};

/**
 * Authenticate based on Google.
 * 
 * Based on the example here https://docs.vendure.io/guides/core-concepts/auth/#google-authentication
 */
export class GoogleAuthStrategy implements AuthenticationStrategy<GoogleAuthData> {
    readonly name = 'google';
    private client: OAuth2Client;
    private externalAuthenticationService: ExternalAuthenticationService | undefined;

    constructor(private clientId: string) {
        // The clientId is obtained by creating a new OAuth client ID as described
        // in the Google guide linked above.
        this.client = new OAuth2Client(clientId);
    }

    init(injector: Injector) {
        // The ExternalAuthenticationService is a helper service which encapsulates much
        // of the common functionality related to dealing with external authentication
        // providers.
        this.externalAuthenticationService = injector.get(ExternalAuthenticationService);
    }

    defineInputType(): DocumentNode {
        // Here we define the expected input object expected by the `authenticate` mutation
        // under the "google" key.
        return gql`
        input GoogleAuthInput {
            token: String!
        }
    `;
    }

    async authenticate(ctx: RequestContext, data: GoogleAuthData): Promise<User | false> {
        // Here is the logic that uses the token provided by the storefront and uses it
        // to find the user data from Google.
        const ticket = await this.client.verifyIdToken({
            idToken: data.token,
            audience: this.clientId,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return false;
        }

        // First we check to see if this user has already authenticated in our
        // Vendure server using this Google account. If so, we return that
        // User object, and they will be now authenticated in Vendure.
        const user = await this.externalAuthenticationService!.findCustomerUser(ctx, this.name, payload.sub);
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
    }
}