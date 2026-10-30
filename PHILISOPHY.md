# Pinelab Plugin Philosophy

In the AI age, implementation becomes cheaper. What remains valuable is a reliable, battle-tested framework. Pinelab plugins should provide simple frameworks for building features on Vendure, rather than tightly coupled implementations of a single project's requirements.

## Open for extension, closed for modification

Consumers should be able to adapt a plugin through its public configuration, strategies, and hooks without modifying the plugin itself. Adding a project-specific field, changing a payload format, or choosing a different provider should not require a new plugin release.

Think **"a plugin to send orders to a fulfillment platform"**, not **"a plugin to send orders to MyParcel."** The framework owns the reusable workflow; the consumer supplies the platform-specific integration. Changes to that platform's API or the consumer's custom fields belong in that integration, not in the framework.

Prefer existing Vendure capabilities and small, well-defined extension points. Do not build speculative abstractions for every imaginable use case. Extensibility does not remove the need for bug fixes, security fixes, compatibility updates, or improvements to the framework itself.

## Separate infrastructure from business rules

A plugin owns the reusable infrastructure its feature needs, such as scheduling, background jobs, state tracking, error handling, and Dashboard visibility. The consumer owns project-specific business rules, field selection, formatting, external providers, and credentials supplied through configuration.

The [Content Automation Plugin](https://plugins.pinelab.studio/plugin/vendure-plugin-content-automation/) illustrates this separation. It orchestrates content generation and enrichment, detects changed inputs, processes jobs per channel and language, and reports results. Consumer-defined strategies decide which inputs matter, how content is generated, and where it is saved. The plugin does not prescribe an AI provider, prompt, or set of output fields.

Most plugins are building blocks, not complete features on their own. Document how consumers compose those blocks into working features, with clear setup instructions and examples. See the [Pinelab recipes](https://plugins.pinelab.studio/recipes/) for application-level guidance.

## Terminology

These terms describe patterns already used in this repository:

- **Plugin:** A reusable Vendure extension that provides infrastructure and documented public extension points. For example, the [Content Automation Plugin](./packages/vendure-plugin-content-automation/README.md) coordinates work while delegating content generation to strategies.
- **Consumer:** The project or developer using a plugin, configuring it, and supplying project-specific behavior. The [Store Credit README](./packages/vendure-plugin-store-credit/README.md#gift-card-code-security) illustrates a consuming project's responsibility for generating secure gift card codes.
- **Strategy:** A replaceable implementation of a defined behavior, supplied through plugin configuration. A strategy can be an object, class, or function according to its public contract. Examples include [content automation strategies](./packages/vendure-plugin-content-automation/README.md#writing-a-strategy) and [address lookup strategies](./packages/vendure-plugin-address-lookup/README.md#custom-lookup-strategies).
- **Hook:** A consumer-supplied callback invoked at a documented point in a plugin's workflow. For example, Store Credit's [`createGiftCardWallet` hook](./packages/vendure-plugin-store-credit/README.md#gift-cards) lets consumers decide whether and how to create a gift card wallet. Here, "hook" means a workflow callback, not an HTTP webhook or React hook.

Strategies and hooks can overlap in implementation. Use a strategy to describe replaceable behavior and a hook to describe a callback at a particular workflow point; neither requires introducing a class hierarchy.

## Design checklist

When designing a new plugin:

- Identify the reusable workflow and separate it from consumer-specific decisions.
- Reuse Vendure's built-in capabilities before introducing custom infrastructure.
- Expose the configuration, strategies, or hooks consumers need to control business rules, field mapping, formatting, and external integrations.
- Document extension-point inputs, outputs, invocation timing, and failure behavior.
- Test the framework's observable behavior independently of one consumer's implementation.
- Start the README with a human-readable paragraph or bullet points explaining what the plugin does and how to use it.
