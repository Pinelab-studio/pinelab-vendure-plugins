---
title: AI integration
description: Use Pinelab's production-tested Vendure plugins and recipes with your AI coding assistant.
---

Generating code is easy; generating production-tested code is hard. Code needs to run in production to mature, and that is what our plugins and recipes are for.

Even if you are not planning to use our plugins, their documentation can give your AI assistant better context about what is possible with Vendure plugins.

## Best practices: always reference

[best-practices.md](/best-practices.md) combines our best practices into a single Markdown file. These instructions apply to all Vendure projects. At Pinelab, we always reference them when implementing or reviewing code, and we keep them short and dense.

Reference the file directly in your prompt:

```text
Read https://plugins.pinelab.studio/best-practices.md and apply these
instructions throughout this Vendure project. Review the current changes
against them and explain any violations and suggested fixes.
```

## Recipes and plugins: find existing solutions

[recipes-and-plugins.md](/recipes-and-plugins.md) indexes feature-specific recipes and plugin READMEs, with short descriptions and links to the Markdown documents on GitHub. At Pinelab, we reference this index when implementing a new feature so the assistant can check whether we have already done something similar or built a plugin for it. Follow the relevant links, not every document, and prefer an existing plugin when it fits. Check its installation instructions and Vendure compatibility before using it.

For example:

```text
I want to add SEO metadata and structured data to my Vendure storefront.
Read https://plugins.pinelab.studio/best-practices.md and follow its instructions.
Read https://plugins.pinelab.studio/recipes-and-plugins.md and look for
similar work or an existing plugin. Follow the relevant GitHub links to read
the recipes or plugin READMEs before proposing custom code.
Use what applies to this project and propose a plan before implementing.
```

Both Markdown files are refreshed on every website build: best practices and recipes come from our engineering repository, and plugin information comes from this repository's package documentation.

Always review generated changes and test them against your own Vendure configuration before deploying.
