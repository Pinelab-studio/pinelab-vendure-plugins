import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  Allow,
  Asset,
  ConfigService,
  Ctx,
  ID,
  Permission,
  RequestContext,
} from '@vendure/core';
import { GoogleStorageStrategy } from '../services/google-storage-strategy';

@Resolver()
export class AssetThumbnailResolvers {
  private readonly strategy: GoogleStorageStrategy;

  constructor(private configService: ConfigService) {
    this.strategy = new GoogleStorageStrategy();
  }

  /**
   * @deprecated Use Asset.presets.<presetName> instead.
   */
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

  @ResolveField('presets')
  @Resolver('Asset')
  presets(
    @Ctx() ctx: RequestContext,
    @Parent() asset: Asset
  ): Record<string, string> {
    if (!asset.customFields?.presets) {
      return {};
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const generatedPresets: Record<string, string> = JSON.parse(
      asset.customFields.presets
    );
    // Transform urls to absolute urls
    const presetResponse: Record<string, string> = {};
    for (const [presetName, presetUrl] of Object.entries(generatedPresets)) {
      presetResponse[presetName] = this.strategy.toAbsoluteUrl(
        ctx.req,
        presetUrl
      );
    }
    return presetResponse;
  }

  @Mutation()
  @Allow(Permission.UpdateCatalog)
  async generateGoogleStorageAssetPresets(
    @Ctx() ctx: RequestContext
  ): Promise<boolean> {
    // TODO: implement
    return false;
  }
}
