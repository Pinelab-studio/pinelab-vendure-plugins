## Common Pitfalls

### Import `graphql` from `@/gql`, NOT from `@vendure/dashboard`

The `graphql` function from `@vendure/dashboard` uses a **static** introspection based on the core Vendure schema only. It does not know about custom types from plugins (e.g. `Invoice`, `InvoiceList`).

Always import `graphql` from the **project-specific** gql-tada instance:

```tsx
// WRONG - uses core Vendure schema only, custom plugin types are unknown
import { graphql } from '@vendure/dashboard';

// CORRECT - uses the generated schema that includes all plugin types
import { graphql } from '@/gql';
```

The `@/gql` alias points to the generated `src/gql/graphql.ts` file (configured in `vite.config.mts` via `gqlOutputPath` and in the Vite `resolve.alias`).

**Symptoms of using the wrong import:**

- `ListPage` only queries `id` fields instead of all selected fields
- gql-tada type inference doesn't work (everything is `any`)
- Query field optimization strips all custom fields

### PaginatedList types must implement the `PaginatedList` interface

The `ListPage` component identifies paginated list types by checking if the GraphQL type **implements the `PaginatedList` interface**. Simply having `items` and `totalItems` fields is not enough.

The item type must also `implement Node` (requires `id: ID!`), because `PaginatedList` defines `items: [Node!]!`.

```graphql
# WRONG - ListPage won't recognize this as a paginated list
type Invoice {
  id: ID!
  # ...
}
type InvoiceList {
  items: [Invoice!]!
  totalItems: Int!
}

# CORRECT - both interfaces are required
type Invoice implements Node {
  id: ID!
  # ...
}
type InvoiceList implements PaginatedList {
  items: [Invoice!]!
  totalItems: Int!
}
```

**Symptoms of missing `implements PaginatedList`:**

- `ListPage` renders but shows no data
- The GraphQL query only requests `id` fields
- No error messages in the console

**Symptoms of missing `implements Node` on the item type:**

- Schema validation error mentioning `PaginatedList`

### Vite dev server CORS

When running the Vite dev server separately from the Vendure server, you may get CORS errors because the dashboard (e.g. `localhost:5173`) makes requests to the Vendure API (e.g. `localhost:3050`).

Fix this by adding CORS config to `vite.config.mts`, **not** to the Vendure config:

```ts
// vite.config.mts
export default defineConfig({
  server: {
    cors: {
      origin: true,
      credentials: true,
    },
  },
  // ... rest of config
});
```

### Dashboard path in `@VendurePlugin` decorator

The `dashboard` path is resolved relative to the **source file** of the plugin (e.g. `src/invoice.plugin.ts`).

```ts
// If plugin is at src/my.plugin.ts and dashboard is at src/dashboard/index.tsx:
@VendurePlugin({
  dashboard: './dashboard/index.tsx',  // CORRECT - relative to src/
})

// WRONG - this would resolve to the package root, not src/
@VendurePlugin({
  dashboard: '../dashboard/index.tsx',
})
```

### `FormFieldWrapper` requires `FormProvider`

The shadcn `FormControl` used inside `FormFieldWrapper` calls `useFormContext()` internally. You must wrap your form JSX with `<FormProvider>` from `react-hook-form`:

```tsx
import { FormProvider, useForm } from 'react-hook-form';

function MyConfigPage() {
  const form = useForm({ defaultValues: { enabled: false } });

  return (
    <FormProvider {...form}>
      <Page pageId="my-config">
        <PageLayout>
          <PageBlock column="main" blockId="config-form">
            <FormFieldWrapper
              control={form.control}
              name="enabled"
              label="Enabled"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </PageBlock>
        </PageLayout>
      </Page>
    </FormProvider>
  );
}
```

**Symptom:** `Cannot destructure property 'getFieldState' of useFormContext as it is null`
