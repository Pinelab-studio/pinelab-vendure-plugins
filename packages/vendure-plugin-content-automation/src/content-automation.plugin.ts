import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { adminApiExtensions } from './api/api-extensions';
import { ContentAutomationResolver } from './api/content-automation.resolver';
import { contentAutomationTask } from './config/content-automation-scheduled-task';
import { PLUGIN_INIT_OPTIONS } from './constants';
import { ContentAutomationUpdate } from './entities/content-automation-update.entity';
import { ContentAutomationService } from './services/content-automation.service';
import { findDuplicates } from './services/util';
import { ContentAutomationPluginOptions } from './types';

/**
 * @description
 * Orchestrates bulk generation/enrichment of entity content through
 * consumer-provided strategies, for every channel and language.
 * The plugin ships no content logic: see `ContentAutomationStrategy`.
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  entities: [ContentAutomationUpdate],
  providers: [
    ContentAutomationService,
    {
      provide: PLUGIN_INIT_OPTIONS,
      useFactory: () => ContentAutomationPlugin.options,
    },
  ],
  adminApiExtensions: {
    schema: adminApiExtensions,
    resolvers: [ContentAutomationResolver],
  },
  configuration: (config) => {
    config.schedulerOptions.tasks.push(contentAutomationTask);
    return config;
  },
  dashboard: './dashboard/index.tsx',
  compatibility: '>=3.3.0',
})
export class ContentAutomationPlugin {
  static options: ContentAutomationPluginOptions = {
    automationStrategies: [],
  };

  /**
   * Initializes the plugin with the given automation strategies.
   * Throws if multiple strategies have the same name.
   */
  static init(
    options: ContentAutomationPluginOptions
  ): Type<ContentAutomationPlugin> {
    const duplicates = findDuplicates(
      options.automationStrategies.map((s) => s.name)
    );
    if (duplicates.length) {
      throw new Error(
        `Content automation strategy names must be unique. Duplicates: ${duplicates.join(
          ', '
        )}`
      );
    }
    this.options = {
      ...this.options,
      ...options,
    };
    return ContentAutomationPlugin;
  }
}
