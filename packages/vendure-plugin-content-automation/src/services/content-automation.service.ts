import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  Channel,
  ChannelService,
  ID,
  Injector,
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
  hash: string,
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
    moduleRef: ModuleRef,
  ) {
    this.injector = new Injector(moduleRef);
  }

  /** Validates strategy names at startup before registering the job queue. */
  async onApplicationBootstrap(): Promise<void> {
    const duplicates = findDuplicates(
      (this.options.automationStrategies ?? []).map(
        (strategy) => strategy.name,
      ),
    );
    if (duplicates.length) {
      throw new Error(
        `Content automation strategy names must be unique. Duplicates: ${duplicates.join(
          ', ',
        )}`,
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
            asError(e).stack,
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
        { retries: JOB_RETRIES },
      );
      jobsCreated++;
    });
    Logger.info(`Created ${jobsCreated} content automation jobs`, loggerCtx);
    return { jobsCreated };
  }

  /** Lists strategies that can be manually run for a product. */
  getProductStrategyNames(): string[] {
    return (this.options.automationStrategies ?? [])
      .filter((strategy) => strategy.entityType === 'product')
      .map((strategy) => strategy.name);
  }

  /**
   * Runs one product strategy synchronously across active-channel languages, bypassing hash checks.
   * Errors propagate to the caller; completed languages are not rolled back.
   */
  async runStrategyForProduct(
    ctx: RequestContext,
    productId: ID,
    strategyName: string,
  ) {
    const strategy = (this.options.automationStrategies ?? []).find(
      (candidate) =>
        candidate.name === strategyName && candidate.entityType === 'product',
    );
    if (!strategy) {
      throw new Error(`Unknown product automation strategy '${strategyName}'`);
    }
    const channel = await this.channelService.getChannelFromToken(
      ctx.channel.token,
    );
    const results = [];
    for (const languageCode of this.getLanguages(channel)) {
      const languageCtx = await this.requestContextService.create({
        apiType: 'admin',
        channelOrToken: channel,
        languageCode,
      });
      const inputs = await strategy.loadInputData(languageCtx, this.injector);
      const input = inputs.find(
        (candidate) => String(candidate.id) === String(productId),
      );
      const update = input
        ? await this.generateAndStore(
            languageCtx,
            strategy,
            input,
            this.hashInput(languageCtx, strategy, input),
            { force: true },
          )
        : undefined;
      results.push({
        languageCode,
        generated: !!update,
        resultMessage: update?.resultMessage ?? null,
      });
    }
    return results;
  }

  /**
   * Creates a job per strategy and language for a single product, in the active channel, for every
   * strategy whose `entityType` is `'product'`. Only inputs with the product's id are used.
   * Loading inputs fails per strategy and language: the error is logged and the rest is processed.
   */
  async createJobsForProduct(
    ctx: RequestContext,
    productId: ID,
  ): Promise<{ jobsCreated: number }> {
    // Loaded via the ChannelService, so the channel includes its default tax and shipping zones
    const channel = await this.channelService.getChannelFromToken(
      ctx.channel.token,
    );
    const strategies = (this.options.automationStrategies ?? []).filter(
      (strategy) => strategy.entityType === 'product',
    );
    let jobsCreated = 0;
    for (const strategy of strategies) {
      for (const languageCode of this.getLanguages(channel)) {
        const languageCtx = await this.requestContextService.create({
          apiType: 'admin',
          channelOrToken: channel,
          languageCode,
        });
        try {
          const inputs = await strategy.loadInputData(
            languageCtx,
            this.injector,
          );
          for (const input of inputs) {
            if (String(input.id) !== String(productId)) continue;
            await this.jobQueue.add(
              {
                ctx: languageCtx.serialize(),
                strategyName: strategy.name,
                input,
                hash: this.hashInput(languageCtx, strategy, input),
                // A manual run regenerates, also when the input didn't change
                force: true,
              },
              { retries: JOB_RETRIES },
            );
            jobsCreated++;
          }
        } catch (e) {
          Logger.error(
            `Failed to create content automation jobs of strategy '${strategy.name}' for product ${productId} and language '${languageCode}': ${asError(e).message}`,
            loggerCtx,
            asError(e).stack,
          );
        }
      }
    }
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
          asError(e).stack,
        );
      }
    });
    Logger.info(
      `Initial population finished: ${processed} processed, ${failed} failed`,
      loggerCtx,
    );
    return { processed, failed };
  }

  /**
   * Resolves the strategy of the job, and generates the content for its input.
   */
  async handleJob(data: ContentAutomationJobData): Promise<void> {
    const ctx = RequestContext.deserialize(data.ctx);
    const strategy = (this.options.automationStrategies ?? []).find(
      (s) => s.name === data.strategyName,
    );
    if (!strategy) {
      throw new Error(
        `No content automation strategy with name '${data.strategyName}' configured`,
      );
    }
    await this.generateAndStore(ctx, strategy, data.input, data.hash, {
      force: data.force,
    });
  }

  /**
   * Calls the strategy to generate and save the content, and stores a
   * `ContentAutomationUpdate` only when the strategy returns a result.
   * Skips the input if this hash was stored in the meantime, e.g. by a duplicate job,
   * unless `force` is set.
   */
  async generateAndStore(
    ctx: RequestContext,
    strategy: AnyStrategy,
    input: { id: ID },
    hash: string,
    options?: { force?: boolean },
  ): Promise<ContentAutomationUpdate | undefined> {
    if (
      !options?.force &&
      (await this.isProcessed(ctx, strategy.name, input.id, hash))
    ) {
      return;
    }
    const result = await strategy.generateAndSaveContent(
      ctx,
      this.injector,
      input,
    );
    if (result === false) {
      return;
    }
    const repository = this.connection.getRepository(
      ctx,
      ContentAutomationUpdate,
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
      }),
    );
  }

  /**
   * Lists the content automation updates of the active channel.
   */
  async findUpdates(
    ctx: RequestContext,
    options?: ListQueryOptions<ContentAutomationUpdate>,
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
    handler: ChangedInputHandler,
  ): Promise<void> {
    const defaultCtx = await this.requestContextService.create({
      apiType: 'admin',
    });
    // Loaded via the ChannelService, so the channels include their default tax and
    // shipping zones, which are needed by services that calculate prices.
    const { items: channels } = await this.channelService.findAll(defaultCtx);
    for (const strategy of this.options.automationStrategies ?? []) {
      for (const channel of channels) {
        for (const languageCode of this.getLanguages(channel)) {
          const ctx = await this.requestContextService.create({
            apiType: 'admin',
            channelOrToken: channel,
            languageCode,
          });
          await this.processChangedInputs(
            ctx,
            strategy,
            channel,
            languageCode,
            handler,
          );
        }
      }
    }
  }

  /** Processes one strategy/channel/language combination, isolating input failures. */
  private async processChangedInputs(
    ctx: RequestContext,
    strategy: AnyStrategy,
    channel: Channel,
    languageCode: LanguageCode,
    handler: ChangedInputHandler,
  ): Promise<void> {
    let inputs: Array<{ id: ID }>;
    let processedHashes: Map<string, string>;
    try {
      inputs = await strategy.loadInputData(ctx, this.injector);
      processedHashes = await this.getProcessedHashes(ctx, strategy.name);
    } catch (e) {
      Logger.error(
        `Failed to load inputs of strategy '${strategy.name}' for channel '${channel.code}' and language '${languageCode}': ${asError(e).message}`,
        loggerCtx,
        asError(e).stack,
      );
      return;
    }
    for (const input of inputs) {
      try {
        const hash = this.hashInput(ctx, strategy, input);
        if (processedHashes.get(String(input.id)) === hash) continue;
        await handler(ctx, strategy, input, hash);
      } catch (e) {
        Logger.error(
          `Failed to process an input of strategy '${strategy.name}' for channel '${channel.code}' and language '${languageCode}': ${asError(e).message}`,
          loggerCtx,
          asError(e).stack,
        );
      }
    }
  }

  /**
   * Loads the latest successful hash per entity for this strategy, channel
   * and language, so inputs can be compared without a query per input.
   */
  private async getProcessedHashes(
    ctx: RequestContext,
    strategyName: string,
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
      updates.map((update) => [String(update.entityId), update.hash]),
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
    hash: string,
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

  /** Returns the strategy's hash of an input, or the default hash of all its fields. */
  private hashInput(
    ctx: RequestContext,
    strategy: AnyStrategy,
    input: { id: ID },
  ): string {
    return normalizeHash(
      strategy.generateHash
        ? strategy.generateHash(ctx, input)
        : defaultHash(input),
    );
  }

  private getLanguages(channel: Channel): LanguageCode[] {
    return channel.availableLanguageCodes?.length
      ? channel.availableLanguageCodes
      : [channel.defaultLanguageCode];
  }
}
