# vendure-plugin-simple-cms

## Goal

Provide a simple CMS plugin for Vendure that lets admins define content models and manage content blocks in the dashboard, with content exposed through the Shop API.

## Functional requirements

1. **JSON-defined content models**
   - The plugin must allow content models to be defined in JSON.
   - A content model defines:
     - model key / code
     - display name
     - mode (`single` or `list`)
     - field definitions
   - The JSON format should be stable and versionable so it can be stored in source control.

2. **Reuse built-in Vendure field types**
   - Field definitions must use existing Vendure-compatible field types where possible (e.g. string, text, int, float, boolean, datetime, relation-like references where supported).
   - Do not introduce custom field types when a built-in type can satisfy the requirement.

3. **Single and list content models**
   - A model can be configured as:
     - `single`: only one content block can exist for this model (example: homepage).
     - `list`: multiple content blocks can exist for this model (example: blogs, landing pages, FAQs).
   - The plugin must enforce these rules when creating content blocks.

4. **Translatable content**
   - Content blocks must support translations per Vendure language.
   - Translatable fields should store values per language and allow fallback behavior where applicable.
   - The dashboard editor must allow creating/updating content per language.

5. **React dashboard listing page**
   - Provide a React dashboard page (using `@vendure/dashboard`) listing all content blocks.
   - The listing shows at least:
     - title / identifier
     - content model type
     - updated date
     - publication or status (if available)

6. **Content block detail page**
   - Provide a React dashboard detail page used for both:
     - creating a new content block
     - editing an existing content block
   - The form fields must be rendered from the selected JSON content model.

7. **Filter by content model type**
   - The listing page must support filtering content blocks by content model type.
   - Filtering must be usable for both `single` and `list` model types.

8. **Expose content through Shop API**
   - Content blocks must be queryable from the Shop API.
   - API should support:
     - fetching by content model key/code
     - fetching single model content
     - listing content for list models
     - language-aware responses for translatable fields

## Implementation baseline

- Follow Vendure plugin conventions for backend and dashboard extensions.
- Keep model definitions and content retrieval predictable so storefronts can consume content without custom mapping per request.
