# 4.4.1 (2025-07-31)

- Disabled license check, because Vendure license server is offline

# 4.4.0 (2025-06-04)

- Upgrade to Vendure to 3.3.2

# 4.3.1 (2025-05-21)

- Don't create invoice job for orders that don't have an orderPlacedAt date.

# 4.3.0 (2025-04-23)

- Notify admins that they need to regenerate the invoice, when the order total doesn't match the invoice total anymore.

# 4.2.1 (2025-03-18)

- Include surcharges as relation, to prevent incomplete tax summaries, and thus incomplete credit invoices

# 4.2.0 (2024-12-19)

- Update Vendure to 3.1.1

# 4.1.1 (2024-11-12)

- Better error message extraction from Xero API response
- Limit search term for looking up contacts in Xero by max 50 characters, to prevent Xero API errors
- Log unknown errors on invoice with timestamp when accounting export fails

# 4.1.0 (2024-08-30)

- Exporting credit invoices via accounting strategies now have their own method interface
- Don't allow accounting export when the order totals changed, to prevent mismatch between accounting export and invoice
- Added Due Date to Xero exports, which is needed for invoice approval

# 4.0.3 (2024-08-27)

- Try to find Xero contact by name first, then by email address

# 4.0.2 (2024-08-27)

- Log created credit note and invoice totals when creation succeeded

# 4.0.1 (2024-08-22)

- Return error to Admin when Accounting Export job couldn't be created

# 4.0.0 (2024-08-20)

- Introduced exporting invoices to external Accounting platforms
- Added `isCreditInvoice` as column in the DB in an Invoice
- Created a reference to parent invoice for credit invoices `invoice.isCreditInvoiceFor`. This is only populated for invoices generated with V4.
- Replaced pdf-creator-node (which uses PhantomJS) with Puppeteer, because PhantomJS is deprecated.

# 3.2.0 (2024-08-01)

- Show `Regenerate invoice` as warning button when order total differs from the latest invoice total ( see #485)

# 3.1.3 (2024-08-04)

- Update compatibility range (#480)

# 3.1.2 (2024-07-09)

- Fetch customer relation for orders by default

# 3.1.1 (2024-07-09)

- Important performance improvement for projects with larger amounts (> 60000) of invoices

# 3.1.0 (2024-07-05)

- Improved default HTML template
- Allow setting a start invoice number, from where the counting should start

# 3.0.0 (2024-07-01)

- Consumers must supply a valid license key. See LICENSE for more details
- Without valid license key, the admin UI functionality is restricted, but invoice generation will still continue
- Publishing to Vendure Hub registry from now on: https://registry.next.vendure.io/

# 2.4.1 (2024-06-27)

- Hide invoices component on order detail when user doesn't have permission

# 2.4.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 2.3.3 (2024-06-22)

- Allow searching by invoice number in Invoices list

# 2.3.2 (2024-06-13)

- Don't throw errors when a cancelled invoice doesn't have a previous invoice, but log and return instead.

# 2.3.1 (2024-06-05)

- Sort invoices by created at

# 2.3.0 (2024-06-05)

- Invoice listing page and bulk download of invoices

# 2.2.0 (2024-06-04)

- When an order is cancelled, generate credit invoice, and no invoice regeneration after that

# 2.1.1 (2024-06-04)

- Prevent the possibility of connecting the wrong invoice file to an order with concurrent invoice generation. See #433

# 2.1.0 (2024-02-14)

- Work on ui improvements as described in #352

# 2.0.2 (2024-02-07)

- Sort by latest invoices first in admin UI
- Don't throw error for orders without customer, because the order can be in an active state

# 2.0.1 (2024-01-23)

- Added script for migrating to V2
- Updated default template to support credit invoices

# 2.0.0 (2024-01-07)

- Allow creating new invoices for orders via the Admin UI. Credit invoices will be generated when a previous invoice exists.
- Credit invoice generation can be disabled, the plugin will then just generate a new invoice.
- BREAKING: DB migration is needed, check the README on how to migrate from V1 to V2.
- BREAKING: When using credit invoices, make sure to update your template so it can handle credit invoices. Checkout the included `defaultTemplate` as reference.
- BREAKING: Downloading multiple invoices has been removed. Invoices are now downloaded on a per order basis via the Admin UI.

# 1.2.0 (2023-10-24)

- Updated vendure to 2.1.1

# 1.1.0 (2023-08-14)

- Allow specifying invoice template storage in DB by specifying DB engine: INVOICES_PLUGIN_DB_ENGINE=mysql ([#243](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/243))
