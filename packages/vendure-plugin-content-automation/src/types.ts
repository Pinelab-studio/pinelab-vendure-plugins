import {
  ID,
  Injector,
  RequestContext,
  SerializedRequestContext,
} from '@vendure/core';

/**
 * The result of a successful content generation, stored on the
 * `ContentAutomationUpdate` record and shown in the dashboard.
 */
export interface ContentAutomationResult {
  /** Free text message, e.g. 'Updated meta title and description' */
  resultMessage?: string;
  /** Optional Dashboard URL for viewing the entity, e.g. `/products/1` */
  entityUrl?: string;
}

/**
 * Definition of a content automation strategy.
 * A Vendure project can have multiple automation strategies, for example a
 * product description strategy and a variant 'usage' content strategy.
 */
export interface ContentAutomationStrategy<
  TInput extends { id: ID } = { id: ID }
> {
  /**
   * Stable, unique key, e.g. "product-description-ai".
   * Used in persisted processing state, so don't change it after going live.
   */
  name: string;

  /**
   * Called once per language per channel. Should return all input data needed
   * to generate content for this strategy. TInput has to be serializable,
   * because it is passed to a background job.
   */
  loadInputData(ctx: RequestContext, injector: Injector): Promise<TInput[]>;

  /**
   * Returns a deterministic fingerprint of the source fields relevant to generation.
   * Inputs are tracked separately by their id, strategy, channel and language.
   * Optional: by default the plugin generates a hash from all fields in the input.
   */
  generateHash?(ctx: RequestContext, input: TInput): string;

  /**
   * Generates and applies content to the entity. This may call AI, an external API, or local code.
   * The consumer is in charge of saving the entity!
   *
   * Return `false` to intentionally skip this input for this run. Nothing is stored, so the
   * input is offered again on the next run: return `false` before doing expensive work.
   * Throw an error for transient failures: the job fails and is retried, without storing the new hash.
   * During the initial population, the error is logged and processing continues with the next input.
   */
  generateAndSaveContent(
    ctx: RequestContext,
    injector: Injector,
    input: TInput
  ): Promise<ContentAutomationResult | false>;
}

/**
 * The data of a single content generation job. Has to be fully serializable,
 * because job queues like Google Cloud Tasks pass it over HTTP.
 */
export interface ContentAutomationJobData {
  ctx: SerializedRequestContext;
  strategyName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Consumer-defined serializable fields
  input: { id: ID; [key: string]: any };
  hash: string;
}

/**
 * The options passed to `ContentAutomationPlugin.init()`.
 */
export interface ContentAutomationPluginOptions {
  /**
   * Different strategies may automate different entity types or use different content providers.
   */
  automationStrategies: Array<ContentAutomationStrategy<{ id: ID }>>;
}
