import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Channel,
  ChannelService,
  Injector,
  ID,
  JobQueue,
  JobQueueService,
  LanguageCode,
  ListQueryBuilder,
  ListQueryOptions,
  Logger,
  PaginatedList,
  RequestContext,
  RequestContextService,
  TransactionalConnection,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { loggerCtx, PLUGIN_INIT_OPTIONS } from '../constants';
import { ContentAutomationUpdate } from '../entities/content-automation-update.entity';
import {
  ContentAutomationJobData,
  ContentAutomationPluginOptions,
  ContentAutomationStrategy,
} from '../types';
import { defaultHash, findDuplicates, normalizeHash } from './util';

const JOB_RETRIES = 3;

type AnyStrategy = ContentAutomationStrategy<{ id: ID }>;

/**
 * Called for every input that changed since its last successful generation.
 */
type ChangedInputHandler = (
  ctx: RequestContext,
  strategy: AnyStrategy,
  input: { id: ID },
  hash: string
) => Promise<void>;

@Injectable()
export class ContentAutomationService implements OnApplicationBootstrap {
  private jobQueue!: JobQueue<ContentAutomationJobData>;
  private readonly injector: Injector;

  constructor(
    private readonly connection: TransactionalConnection,
    private readonly jobQueueService: JobQueueService,
    private readonly listQueryBuilder: ListQueryBuilder,
    private readonly channelService: ChannelService,
    private readonly requestContextService: RequestContextService,
    @Inject(PLUGIN_INIT_OPTIONS)
    private readonly options: ContentAutomationPluginOptions,
    moduleRef: ModuleRef
  ) {
    this.injector = new Injector(moduleRef);
  }

  /** Validates strategy names at startup before registering the job queue. */
  async onApplicationBootstrap(): Promise<void> {
    const duplicates = findDuplicates(
      this.options.automationStrategies.map((strategy) => strategy.name)
    );
    if (duplicates.length) {
      throw new Error(
        `Content automation strategy names must be unique. Duplicates: ${duplicates.join(
          ', '
        )}`
      );
    }
    this.jobQueue = await this.jobQueueService.createQueue({
      name: 'content-automation',
      process: async (job) =>
        this.handleJob(job.data).catch((e) => {
          Logger.error(
            `Failed to generate content for strategy '${
              job.data.strategyName
            }': ${asError(e).message}`,
            loggerCtx,
            asError(e).stack
          );
          throw e;
        }),
    });
  }

  /**
   * Creates one job per input that changed since its last successful generation,
   * for every strategy, channel and language. Used by the nightly scheduled task.
   */
  async createJobsForChangedInputs(): Promise<{ jobsCreated: number }> {
    let jobsCreated = 0;
    await this.forEachChangedInput(async (ctx, strategy, input, hash) => {
      await this.jobQueue.add(
        { ctx: ctx.serialize(), strategyName: strategy.name, input, hash },
        { retries: JOB_RETRIES }
      );
      jobsCreated++;
    });
    Logger.info(`Created ${jobsCreated} content automation jobs`, loggerCtx);
    return { jobsCreated };
  }

  /**
   * Does the same as the nightly run, but processes the changed inputs
   * sequentially instead of creating jobs. Use this to populate the initial
   * state, to prevent a burst of jobs when no state exists yet.
   * Failures are logged, and processing continues with the next input.
   */
  async runInitialPopulation(): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;
    await this.forEachChangedInput(async (ctx, strategy, input, hash) => {
      try {
        await this.generateAndStore(ctx, strategy, input, hash);
        processed++;
      } catch (e) {
        failed++;
        Logger.error(
          `Failed to generate content for strategy '${strategy.name}': ${
            asError(e).message
          }`,
          loggerCtx,
          asError(e).stack
        );
      }
    });
    Logger.info(
      `Initial population finished: ${processed} processed, ${failed} failed`,
      loggerCtx
    );
    return { processed, failed };
  }

  /**
   * Resolves the strategy of the job, and generates the content for its input.
   */
  async handleJob(data: ContentAutomationJobData): Promise<void> {
    const ctx = RequestContext.deserialize(data.ctx);
    const strategy = this.options.automationStrategies.find(
      (s) => s.name === data.strategyName
    );
    if (!strategy) {
      throw new Error(
        `No content automation strategy with name '${data.strategyName}' configured`
      );
    }
    await this.generateAndStore(ctx, strategy, data.input, data.hash);
  }

  /**
   * Calls the strategy to generate and save the content, and stores a
   * `ContentAutomationUpdate` only when the strategy returns a result.
   * Skips the input if this hash was stored in the meantime, e.g. by a duplicate job.
   */
  async generateAndStore(
    ctx: RequestContext,
    strategy: AnyStrategy,
    input: { id: ID },
    hash: string
  ): Promise<ContentAutomationUpdate | undefined> {
    if (await this.isProcessed(ctx, strategy.name, input.id, hash)) {
      return;
    }
    const result = await strategy.generateAndSaveContent(
      ctx,
      this.injector,
      input
    );
    if (result === false) {
      return;
    }
    const repository = this.connection.getRepository(
      ctx,
      ContentAutomationUpdate
    );
    const key = {
      strategyName: strategy.name,
      entityId: String(input.id),
      channelId: String(ctx.channelId),
      languageCode: ctx.languageCode,
    };
    const existing = await repository.findOne({ where: key });
    return repository.save(
      new ContentAutomationUpdate({
        ...key,
        id: existing?.id,
        hash,
        resultMessage: result.resultMessage ?? null,
        entityUrl: result.entityUrl ?? null,
      })
    );
  }

  /**
   * Lists the content automation updates of the active channel.
   */
  async findUpdates(
    ctx: RequestContext,
    options?: ListQueryOptions<ContentAutomationUpdate>
  ): Promise<PaginatedList<ContentAutomationUpdate>> {
    const [items, totalItems] = await this.listQueryBuilder
      .build(ContentAutomationUpdate, options, {
        ctx,
        where: { channelId: String(ctx.channelId) },
      })
      .getManyAndCount();
    return { items, totalItems };
  }

  /**
   * Loads the inputs of every strategy, for every channel and language, and
   * calls the handler for each input whose hash hasn't been processed yet.
   * When loading inputs fails, the error is logged and the next
   * strategy/channel/language is processed. When processing a single input
   * fails, the error is logged and the next input is processed.
   *
   * @param handler the callback; either push to job queue or handle syncronously; up to the caller
   */
  private async forEachChangedInput(
    handler: ChangedInputHandler
  ): Promise<void> {
    const defaultCtx = await this.requestContextService.create({
      apiType: 'admin',
    });
    // Loaded via the ChannelService, so the channels include their default tax and
    // shipping zones, which are needed by services that calculate prices.
    const { items: channels } = await this.channelService.findAll(defaultCtx);
    for (const strategy of this.options.automationStrategies) {
      for (const channel of channels) {
        for (const languageCode of this.getLanguages(channel)) {
          const ctx = await this.requestContextService.create({
            apiType: 'admin',
            channelOrToken: channel,
            languageCode,
          });
          let inputs: Array<{ id: ID }>;
          let processedHashes: Map<string, string>;
          try {
            inputs = await strategy.loadInputData(ctx, this.injector);
            processedHashes = await this.getProcessedHashes(ctx, strategy.name);
          } catch (e) {
            Logger.error(
              `Failed to load inputs of strategy '${
                strategy.name
              }' for channel '${
                channel.code
              }' and language '${languageCode}': ${asError(e).message}`,
              loggerCtx,
              asError(e).stack
            );
            continue;
          }
          for (const input of inputs) {
            try {
              const hash = normalizeHash(
                strategy.generateHash
                  ? strategy.generateHash(ctx, input)
                  : defaultHash(input)
              );
              if (processedHashes.get(String(input.id)) === hash) {
                // This means the hash for this entity is the same as last time, so we skip it
                continue;
              }
              await handler(ctx, strategy, input, hash);
            } catch (e) {
              Logger.error(
                `Failed to process an input of strategy '${
                  strategy.name
                }' for channel '${
                  channel.code
                }' and language '${languageCode}': ${asError(e).message}`,
                loggerCtx,
                asError(e).stack
              );
            }
          }
        }
      }
    }
  }

  /**
   * Loads the latest successful hash per entity for this strategy, channel
   * and language, so inputs can be compared without a query per input.
   */
  private async getProcessedHashes(
    ctx: RequestContext,
    strategyName: string
  ): Promise<Map<string, string>> {
    const updates = await this.connection
      .getRepository(ctx, ContentAutomationUpdate)
      .find({
        select: { entityId: true, hash: true },
        where: {
          strategyName,
          channelId: String(ctx.channelId),
          languageCode: ctx.languageCode,
        },
      });
    return new Map(
      updates.map((update) => [String(update.entityId), update.hash])
    );
  }

  /**
   * Checks whether this hash matches the entity's latest successful generation
   * for this strategy, channel and language.
   */
  private async isProcessed(
    ctx: RequestContext,
    strategyName: string,
    entityId: ID,
    hash: string
  ): Promise<boolean> {
    const latest = await this.connection
      .getRepository(ctx, ContentAutomationUpdate)
      .findOne({
        where: {
          strategyName,
          channelId: String(ctx.channelId),
          languageCode: ctx.languageCode,
          entityId: String(entityId),
        },
      });
    return latest?.hash === hash;
  }

  private getLanguages(channel: Channel): LanguageCode[] {
    return channel.availableLanguageCodes?.length
      ? channel.availableLanguageCodes
      : [channel.defaultLanguageCode];
  }
}
