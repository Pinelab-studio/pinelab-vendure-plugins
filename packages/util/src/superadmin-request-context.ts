import {
  Injector,
  Channel,
  RequestContext,
  TransactionalConnection,
  User,
  ConfigService,
} from '@vendure/core';

export async function getSuperadminContextInChannel(
  injector: Injector,
  channel: Channel
): Promise<RequestContext> {
  const connection = injector.get(TransactionalConnection);
  const configService = injector.get(ConfigService);
  const { superadminCredentials } = configService.authOptions;
  const superAdminUser = await connection
    .getRepository(User)
    .findOneOrFail({ where: { identifier: superadminCredentials.identifier } });
  return new RequestContext({
    channel,
    apiType: 'admin',
    isAuthorized: true,
    authorizedAsOwnerOnly: false,
    session: {
      id: '',
      token: '',
      expires: new Date(),
      cacheExpiry: 999999,
      user: {
        id: superAdminUser.id,
        identifier: superAdminUser.identifier,
        verified: true,
        channelPermissions: [],
      },
    },
  });
}
