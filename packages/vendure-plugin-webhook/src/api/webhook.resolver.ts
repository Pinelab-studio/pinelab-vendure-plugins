import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  Allow,
  Ctx,
  ForbiddenError,
  Permission,
  PermissionDefinition,
  RequestContext,
} from '@vendure/core';
import {
  Webhook,
  WebhookInput,
  WebhookRequestTransformer,
} from '../generated/graphql-types';
import { RequestTransformer } from './request-transformer';
import { Webhook as WebhookEntity } from './webhook.entity';
import { WebhookService } from './webhook.service';

// Permission needs to be defined first
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

  @Mutation()
  @Allow(webhookPermission.Permission)
  async setWebhooks(
    @Ctx() ctx: RequestContext,
    @Args('webhooks') webhooks: WebhookInput[]
  ): Promise<Webhook[]> {
    const currentWebhooks = await this.webhookService.getAllWebhooks(ctx);
    const newWebhooks = webhooks.filter(
      (webhook) =>
        !currentWebhooks.some(
          (w) =>
            w.channelAgnostic &&
            w.event === webhook.event &&
            w.url === webhook.url
        )
    );
    // Check if any of the new webhooks are being set as channel-agnostic
    const hasChannelAgnosticWebhook = newWebhooks.some(
      (webhook) => webhook.channelAgnostic === true
    );
    if (hasChannelAgnosticWebhook) {
      // Check if the current user has the "CreateChannel" permission
      // In Vendure, permissions are checked through the session's channelPermissions
      const channelPermissions = ctx.session?.user?.channelPermissions || [];
      const hasPermission = channelPermissions.some((perm) =>
        perm.permissions?.includes(Permission.CreateChannel)
      );
      if (!hasPermission) {
        throw new ForbiddenError();
      }
    }
    return this.webhookService.saveWebhooks(ctx, webhooks);
  }

  @Query()
  @Allow(webhookPermission.Permission)
  async webhooks(@Ctx() ctx: RequestContext): Promise<Webhook[]> {
    return this.webhookService.getAllWebhooks(ctx);
  }

  @Query()
  @Allow(webhookPermission.Permission)
  async availableWebhookEvents(): Promise<string[]> {
    return this.webhookService.getAvailableEvents();
  }

  @Query()
  @Allow(webhookPermission.Permission)
  async availableWebhookRequestTransformers(): Promise<
    WebhookRequestTransformer[]
  > {
    const transformers = this.webhookService.getAvailableTransformers();
    return transformers.map(mapToGraphqlTransformer);
  }
}

@Resolver('Webhook')
export class WebhookRequestTransformerResolver {
  constructor(private webhookService: WebhookService) {}

  /**
   * Resolve `webhook.transformerName` to the actual RequestTransformer object
   */
  @ResolveField()
  async requestTransformer(
    @Ctx() ctx: RequestContext,
    @Parent() webhook: WebhookEntity
  ): Promise<WebhookRequestTransformer | undefined> {
    if (!webhook.transformerName) {
      return;
    }
    const transformers = this.webhookService.getAvailableTransformers();
    const transformer = transformers.find(
      (t) => t.name === webhook.transformerName
    );
    if (!transformer) {
      return;
    }
    return mapToGraphqlTransformer(transformer);
  }
}

export function mapToGraphqlTransformer(
  transformer: RequestTransformer<any>
): WebhookRequestTransformer {
  return {
    name: transformer.name,
    supportedEvents: transformer.supportedEvents.map(
      (event: any) => event.name
    ),
  };
}
