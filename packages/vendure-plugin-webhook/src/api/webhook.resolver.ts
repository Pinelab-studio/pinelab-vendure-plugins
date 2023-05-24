import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, RequestContext } from '@vendure/core';
import { WebhookService } from './webhook.service';
import { PermissionDefinition } from '@vendure/core';

export const webhookPermission = new PermissionDefinition({
  name: 'SetWebhook',
  description: 'Allows setting a webhook URL',
});

/**
 * Graphql resolvers for retrieving and updating webhook for channel
 */
@Resolver()
export class WebhookResolver {
  constructor(private webhookService: WebhookService) {}

  @Query()
  @Allow(webhookPermission.Permission)
  async webhook(@Ctx() ctx: RequestContext): Promise<string | undefined> {
    const webhook = await this.webhookService.getWebhook(
      ctx.channelId as string
    );
    return webhook?.url;
  }

  @Mutation()
  @Allow(webhookPermission.Permission)
  async updateWebhook(
    @Ctx() ctx: RequestContext,
    @Args('url') url: string
  ): Promise<string | undefined> {
    const webhook = await this.webhookService.saveWebhook(
      url,
      ctx.channelId as string
    );
    return webhook?.url;
  }
}
