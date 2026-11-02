# Pinelab Plugin Philosophy

Writing code is getting easier. Building something that works reliably in production still takes time. Our plugins provide the tested building blocks, so each project doesn't have to start from scratch.

## Open for extension, closed for modification

You should be able to adapt a plugin without changing its source code. Configuration, strategies, and hooks let the **consumer**—the project using the plugin—add its own behavior.

Think **"send orders to a fulfillment platform"**, not **"send orders to MyParcel."**

- The plugin handles the shared workflow: background jobs, retries, tracking progress, and showing results in the Dashboard.
- The consumer maps a Vendure order to the object the platform expects and sends it using its own API credentials.
- If the platform changes its API or the project adds a custom field, the consumer updates that mapping or integration. The plugin stays the same.

The goal is fewer plugin upgrades. A change to your business rules or an external API shouldn't require a new plugin version. Upgrade when the framework itself needs a bug fix, security fix, Vendure compatibility update, or an improvement you need.

## Keep it simple

- Reuse what Vendure already provides.
- Keep project-specific rules, field mappings, and provider choices in the consumer.
- Add extension points for real needs, not every possible future use case. A strategy supplies replaceable behavior; a hook runs your code at a defined point in the workflow.
- Test the shared workflow independently of any one project's integration.
- Explain what the plugin does, how to use it, and how to extend it. Include working examples and make failure behavior clear.

Plugins are building blocks, not always complete features. Our [recipes](https://plugins.pinelab.studio/recipes/) show how to put them together.
