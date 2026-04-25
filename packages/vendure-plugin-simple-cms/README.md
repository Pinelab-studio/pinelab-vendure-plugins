# Vendure Simple CMS Plugin

The goal of this plugin is to provide simple content management within Vendure. It is **not** intended as a page builder or drag-and-drop editor, but instead allows you to define structured content types such as a `Hero title, image and text` block, `Blog posts`, or other simple content entities. It can be seen as a kind of mini, simplified version of Directus.

Configuration of content types is similar to how custom fields are defined in Vendure itself: you specify which fields are available for each type of content (e.g., string, number, boolean, relation, or struct fields), and can indicate which fields are translatable.

This keeps things flexible and familiar for Vendure developers, focused on structured content rather than complex layouts or design tools.

Features:

- Pre-defined content types
- Translatable fields
- Relation, struct and primitive fields
- Content entries
- Content entry translations

// TODO example type definitions and storefront usage

## TODO

- Emit events for content entry CRUD
