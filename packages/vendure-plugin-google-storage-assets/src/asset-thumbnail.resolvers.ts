import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Asset, ConfigService, Ctx, RequestContext } from '@vendure/core';

@Resolver()
export class AssetThumbnailResolvers {
  constructor(private configService: ConfigService) {}

  @ResolveField('thumbnail')
  @Resolver('Asset')
  thumbnail(@Ctx() ctx: RequestContext, @Parent() asset: Asset): string {
    const { assetOptions } = this.configService;
    if (assetOptions.assetStorageStrategy.toAbsoluteUrl) {
      return assetOptions.assetStorageStrategy.toAbsoluteUrl(
        ctx.req!,
        `${asset.preview}_thumbnail.jpg`
      );
    } else {
      return `${asset.preview}_thumbnail.jpg`;
    }
  }
}
