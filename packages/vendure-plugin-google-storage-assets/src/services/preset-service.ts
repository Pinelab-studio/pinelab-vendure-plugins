import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
  JobQueueService,
  JobQueue,
  JsonCompatible,
  Logger,
  AssetService,
  SerializedRequestContext,
  EventBus,
  AssetEvent,
  RequestContext,
  ID,
  Asset,
  AssetType,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { GoogleStorageAssetConfig } from '../types';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { GoogleStorageStrategy } from './google-storage-strategy';
import sharp from 'sharp';
import { removeExtension } from './util';
import fs from 'fs/promises';

interface AssetJobData {
  assetIds: ID[];
  ctx: SerializedRequestContext;
}

@Injectable()
export class PresetService implements OnApplicationBootstrap {
  private jobQueue!: JobQueue<JsonCompatible<AssetJobData>>;
  private strategy: GoogleStorageStrategy;

  constructor(
    private jobQueueService: JobQueueService,
    private assetService: AssetService,
    private eventBus: EventBus,
    private connection: TransactionalConnection,
    @Inject(PLUGIN_INIT_OPTIONS)
    private config: GoogleStorageAssetConfig
  ) {
    this.strategy = new GoogleStorageStrategy();
  }

  async onApplicationBootstrap() {
    await this.init();
    this.eventBus.ofType(AssetEvent).subscribe((event) => {
      if (event.type === 'created') {
        this.jobQueue
          .add(
            {
              assetIds: [event.entity.id],
              ctx: event.ctx.serialize(),
            },
            { retries: 2 }
          )
          .catch((e) => {
            Logger.error(
              `Failed to add asset ${
                event.entity.id
              } to preset generation queue: ${asError(e).message}`,
              loggerCtx
            );
          });
      }
    });
  }

  // Call this after constructing the service to initialize the job queue
  async init() {
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'generate-google-asset-presets',
      process: async (job) => {
        const ctx = RequestContext.deserialize(job.data.ctx);
        await this.generatePresets(ctx, job.data.assetIds).catch((e) => {
          Logger.warn(
            `Failed to generate presets for asset ${job.data.assetIds.join(
              ', '
            )}: ${asError(e).message}`,
            loggerCtx
          );
        });
      },
    });
  }

  /**
   * Generate presets for asset and store via the Google Storage Strategy
   */
  async generatePresets(ctx: RequestContext, assetIds: ID[]): Promise<void> {
    for (const assetId of assetIds) {
      const asset = await this.assetService.findOne(ctx, assetId);
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`);
      }
      const localFile = await this.strategy.downloadRemoteToLocalTmpFile(
        asset.preview
      );
      const originalSizeInKB = (asset.fileSize / 1024).toFixed(1);

      const presetUrls: Record<string, string> = {};

      // Iterate over each preset configuration
      for (const [presetName, { extension, generateFn }] of Object.entries(
        this.config.presets
      )) {
        const buffer = await generateFn(sharp(localFile));
        // Create a preset file name like "presets/1c/myimage_123_thumbnail.webp"
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const presetFileName = this.createPresetFileName(
          asset.source,
          presetName,
          extension
        );
        await this.strategy.writeFileFromBuffer(presetFileName, buffer);
        // Set preset in custom fields object
        presetUrls[presetName] = presetFileName;
        // Log the processed preset name
        const sizeInKB = (buffer.length / 1024).toFixed(1);
        Logger.info(
          `Generated preset '${presetName}' for asset ${asset.id}: ${originalSizeInKB}KB > ${sizeInKB}KB`,
          loggerCtx
        );
      }
      await this.assetService.update(ctx, {
        id: assetId,
        customFields: {
          presets: JSON.stringify(presetUrls),
        },
      });
      Logger.info(`Saved presets for asset ${asset.id}`, loggerCtx);
      // Clean up the local file
      await fs.unlink(localFile);
    }
  }

  /**
   * Create a preset file name like "presets/1c/myimage_123_thumbnail.webp"
   *
   * Uses the asset source path, but replaces 'source' with 'presets' and adds the preset name and extension
   */
  createPresetFileName(
    assetSourcePath: string,
    presetName: string,
    extension: string
  ) {
    let presetPath = removeExtension(assetSourcePath);
    presetPath = presetPath.replace('source', 'presets');
    return `${presetPath}_${presetName}.${extension}`;
  }

  /**
   * Parse asset.customFields.presets and transform urls to absolute urls
   */
  getPresetUrls(ctx: RequestContext, asset: Asset): Record<string, string> {
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

  /**
   * Pushes jobs for all assets to the job queue.
   */
  async createPresetJobsForAllAssets(ctx: RequestContext) {
    const batchSize = 10;
    let skip = 0;
    let hasMore = true;
    let totalProcessed = 0;
    while (hasMore) {
      const assets = await this.connection.getRepository(ctx, Asset).find({
        where: { type: AssetType.IMAGE },
        take: batchSize,
        skip,
        select: ['id'],
      });
      if (assets.length === 0) {
        hasMore = false;
        break;
      }
      const serializedCtx = ctx.serialize();
      await this.jobQueue.add(
        { ctx: serializedCtx, assetIds: assets.map((asset) => asset.id) },
        { retries: 2 }
      );
      totalProcessed += assets.length;
      skip += batchSize;
    }
    Logger.info(`Created jobs for ${totalProcessed} assets`, loggerCtx);
  }
}
