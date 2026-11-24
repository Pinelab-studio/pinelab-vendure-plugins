# Coding standards

## General

- **Keep features decoupled.** Avoid cross-feature imports and dependencies. Place shared functionality in a common module rather than making one feature depend on another.
- Start each plugin README with a human-readable description—a single paragraph or bullet points explaining what the plugin does and how to use it.
- Prefer built-in or ready-made configuration, strategies, services and React components supplied by Vendure over custom code, even if that means sacrificing some functionality.

## Vendure backend

- Keep business logic in `src/services`. Extract complex functionality into pure functions in `src/services/util.ts` so it can be unit tested.

## Vendure React Dashboard

- Use React with `@vendure/dashboard` for all new admin UI work.
- Use Vendure's style and colors so extensions have the same look and feel as existing components.
- Use `defineDashboardExtension` to register dashboard extensions.

## Versioning

- Use semantic versioning for packages.
- Format changelog entries as `# X.Y.Z (YYYY-MM-DD)`, followed by bullet points, newest version first.
