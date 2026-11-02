---
title: AI integration
description: Use Pinelab's production-tested Vendure plugins and recipes with your AI coding assistant.
---

At Pinelab, we use the resources on this website in two ways: We have **best practices**, which we always load into context and we have other resources like **recipes** and **plugins**, which we only reference explicitly.

## Best practices: always reference

[best-practices-only.md](/best-practices-only.md) combines our best practices into a single Markdown file. These instructions apply to all our Vendure projects. At Pinelab, we always reference them when implementing or reviewing code.

```text
// Example prompt

Implement feature XYZ and make sure it adheres to the best practices from
https://engineering.pinelab.studio/best-practices-only.md
```

## Recipes and plugins: find existing solutions

[resources_index.md](/resources_index.md) indexes feature-specific recipes and plugin READMEs, with short descriptions linking to the Markdown documents on GitHub.

At Pinelab, we reference this index file explicitly when researching a new feature.

```text
// Example prompt

/plan I want to add SEO metadata and structured data to my Vendure project.
Read https://engineering.pinelab.studio/resources_index.md and look for
similar work or existing plugins.
```
