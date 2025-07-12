import { Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Allow,
  Asset,
  ConfigService,
  Ctx,
  Logger,
  Permission,
  RequestContext,
} from '@vendure/core';
import { PresetService } from '../services/preset-service';
import { asError } from 'catch-unknown';
import { loggerCtx } from '../constants';

@Resolver()
export class AssetThumbnailResolvers {
  constructor(
    private configService: ConfigService,
    private presetService: PresetService
  ) {}

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
    try {
      return this.presetService.getPresetUrls(ctx, asset);
    } catch (error) {
      Logger.error(
        `Failed to get preset URL's from custom field for asset ${asset.id}: ${
          asError(error).message
        }`,
        loggerCtx
      );
      return {};
    }
  }

  @Mutation()
  @Allow(Permission.UpdateAsset)
  async generateGoogleStorageAssetPresets(
    @Ctx() ctx: RequestContext
  ): Promise<boolean> {
    await this.presetService.createPresetJobsForAllAssets(ctx);
    return true;
  }
}
