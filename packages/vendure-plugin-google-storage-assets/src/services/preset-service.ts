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
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { GoogleStorageAssetConfig } from '../types';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { GoogleStorageStrategy } from './google-storage-strategy';
import sharp from 'sharp';
import { removeExtension } from './util';
import fs from 'fs/promises';

interface AssetJobData {
  assetId: ID;
  ctx: SerializedRequestContext;
}

@Injectable()
export class PresetService implements OnApplicationBootstrap {
  private jobQueue?: JobQueue<JsonCompatible<AssetJobData>>;

  constructor(
    private jobQueueService: JobQueueService,
    private assetService: AssetService,
    private eventBus: EventBus,
    @Inject(PLUGIN_INIT_OPTIONS)
    private config: GoogleStorageAssetConfig
  ) {}

  async onApplicationBootstrap() {
    await this.init();
    this.eventBus.ofType(AssetEvent).subscribe((event) => {
      if (event.type === 'created') {
        this.jobQueue
          ?.add(
            {
              assetId: event.entity.id,
              ctx: event.ctx.serialize(),
            },
            { retries: 3 }
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
        await this.generatePresets(ctx, job.data.assetId).catch((e) => {
          Logger.warn(
            `Failed to generate presets for asset ${job.data.assetId}: ${
              asError(e).message
            }`,
            loggerCtx
          );
        });
      },
    });
  }

  /**
   * Generate presets for asset and store via the Google Storage Strategy
   */
  async generatePresets(ctx: RequestContext, assetId: ID): Promise<void> {
    const storageStrategy = new GoogleStorageStrategy();
    const asset = await this.assetService.findOne(ctx, assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }
    const localFile = await storageStrategy.downloadRemoteToLocalTmpFile(
      asset.preview
    );

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
      await storageStrategy.writeFileFromBuffer(presetFileName, buffer);
      // Set preset in custom fields object
      presetUrls[presetName] = presetFileName;
      // Log the processed preset name
      const sizeInKB = (buffer.length / 1024).toFixed(2);
      Logger.info(
        `Generated preset: ${presetName} for asset '${asset.name}' (${asset.id}): ${sizeInKB} KB`,
        loggerCtx
      );
    }
    await this.assetService.update(ctx, {
      id: assetId,
      customFields: {
        presets: JSON.stringify(presetUrls),
      },
    });
    Logger.info(
      `Saved presets for asset '${asset.name}' (${asset.id})`,
      loggerCtx
    );
    // Clean up the local file
    await fs.unlink(localFile);
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
}
