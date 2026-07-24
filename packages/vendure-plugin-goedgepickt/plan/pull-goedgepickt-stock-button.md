## Plan

- **Goal:** Add a standalone "Pull stock from Goedgepickt" button on the product detail page that fetches stock for all variants of a product from Goedgepickt and updates their stock levels in Vendure, returning a detailed result with per-SKU errors.

- **Files to change:**

  - `src/api/schema.graphql.ts` — Add `GoedgepicktPullStockResult` and `GoedgepicktPullStockError` types, and `pullGoedgepicktStock(productId: ID!): GoedgepicktPullStockResult!` mutation.
  - `src/api/goedgepickt.resolver.ts` — Add `pullGoedgepicktStock` mutation resolver with `@Allow(Permission.UpdateProduct)`.
  - `src/api/goedgepickt.service.ts` — Add `pullStockForProduct(ctx, productId)` method that gets all variants for a product, fetches Goedgepickt stock per SKU, updates Vendure stock, and returns structured `{ success, updatedVariants, errors }`.
  - `src/dashboard/index.tsx` — Add new `actionBarItems` entry for `pageId: 'product-detail'` with `type: 'button'` (standalone button, not dropdown).
  - `src/dashboard/components/PullStockFromGoedgepicktButton.tsx` — New component that reads `productId` from `context.entity`, calls the mutation via `useMutation`, and shows detailed success/error toast notifications using the mutation result.

- **Steps:**

  1. Extend `src/api/schema.graphql.ts` with the new types and mutation.
  2. Add `pullGoedgepicktStock` resolver to `src/api/goedgepickt.resolver.ts` with `Permission.UpdateProduct` guard.
  3. Add `pullStockForProduct` to `src/api/goedgepickt.service.ts`:
     a. Get all variants for the given product ID by adding an optional `productId` parameter to the existing `getVariants` helper method.
     b. For each variant, call `client.findProductBySku(sku)` to get Goedgepickt stock.
     c. Collect successful lookups into `StockInput[]` and failed lookups into `errors[]`.
     d. Call `updateVendureStock(ctx, stockInputs)` with the successful ones.
     e. Return `{ success, updatedVariants, errors }`.
  4. Generate GraphQL types with `yarn generate` (or `yarn codegen`).
  5. Create `src/dashboard/components/PullStockFromGoedgepicktButton.tsx`:
     a. Use `context.entity` to get the product ID.
     b. Use `useMutation` with the generated `pullGoedgepicktStock` mutation document.
     c. Show a success toast when the mutation succeeds (e.g., "Updated stock for 3 variants").
     d. Show an error toast when the mutation fails (e.g., "Failed to update stock for 2 variants: see logs"). Include error details from the `errors` field if available.
  6. Register the new action bar item in `src/dashboard/index.tsx` for `pageId: 'product-detail'` with `type: 'button'`.
  7. Build the plugin with `yarn build` and `npx vite build` (for the dashboard).
  8. Run tests with `yarn test` to verify no regressions.

- **Risks / open questions:**
  - The `getVariants` helper currently paginates (100 per page). If a product has many variants, the new `pullStockForProduct` method will iterate through all pages via the existing pagination. The `productId` parameter is added to the existing `getVariants` helper.
  - The mutation runs synchronously. If a product has many variants (e.g., 50+), the Goedgepickt API calls could be slow. For a manual admin button, this is acceptable, but we should consider a loading state in the UI.
  - The `updateVendureStock` method resets `stockAllocated` to 0 for all updated variants. This is the existing behavior and should remain unchanged, but admins should be aware that pulling stock will clear allocations.
