# 3.5.0 (2024-12-19)

- Update Vendure to 3.1.1

# 3.4.2 (2024-11-13)

- Make falling back to parent product featured asset configurable, so that only images of variants are synced to Picqer.

# 3.4.1 (2024-10-08)

- Removed unused order line index in `pushPicqerOrderLineFields` strategy

# 3.4.0 (2024-10-08)

- Allow specifying additional fields on order.products when pushing orders to Picqer

# 3.3.1 (2024-09-26)

- Find channel's default translation for products when sending to Picqer.

# 3.3.0 (2024-09-17)

- Transition to `Shipped` state first (#504)

# 3.2.1 (2024-08-14)

- Check for empty strings when sending `invoicename` to Picqer. Fallback to customer email address to make sure orders are sent to Picqer.

# 3.2.0 (2024-08-04)

- Allow configuration to trigger sync on custom field updates (#484)

# 3.1.2 (2024-08-02)

- Update compatibility range (#480)

# 3.1.1 (2024-06-26)

- Get the correct variant translation based on the channel's default language
- Fetch all registered webhooks when there are more than 100 using pagination

# 3.1.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 3.0.0 (2024-05-15)

- The Picqer plugin now requires manual installation of the default order process with `checkFulfillment: false` to prevent overriding other custom order processes in the consuming projects.

# 2.4.4 (2024-04-09)

- Don't fall back to shipping address when passing billing address to Picqer

# 2.4.3 (2024-04-03)

- Correctly set product name in Picqer based on Vendure variant name. Falls back to first translation available before falling back to using SKU as name.

# 2.4.2 (2024-03-13)

- Don't update stock of products in Vendure that have `unlimitedstock=true` in Picqer

# 2.4.1 (2024-01-29)

- Fix types of pushing and pulling Picqer data

# 2.4.0 (2023-12-12)

- Sync warehouses including names on full sync and stock level sync

# 2.3.1 (2023-12-05)

- Throw error when trying to fulfill, because fulfilment shouldn't be used together with Picqer.

# 2.3.0 (2023-11-28)

- Expose endpoint to periodically pull stock levels
- Install order process that allows skipping fulfillments when transitioning to Shipped or Delivered

# 2.2.4 (2023-11-21)

- Take Picqer allocated stock into account when setting stock on hand

# 2.2.3 (2023-11-21)

- Log order code when order couldn't be added to push-order queue

# 2.2.2 (2023-11-14)

- Remove order lines when removed in Picqer

# 2.2.1 (2023-11-14)

- Update stock of virtual/assembled products based on assembled_stock webhook

# 2.2.0 (2023-11-02)

- Always created products as active in Picqer
- Log order code for failed pushes of orders to Picqer

# 2.1.0 (2023-11-02)

- Updated vendure to 2.1.1

# 2.0.2

- Try to fulfill again on order status changed webhooks, to support fulfilling of back orders.

# 2.0.1

- Push to Picqer even when fulfilling failed. Log order codes and manual steps needed when fulfillment fails.

# 2.0.0

- Complete orders on `orders.status_changed` webhooks, instead of `picklists.closed` hooks. ([#281](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/281))

# 1.0.13

- Patch priority order of names when sending to Picqer: invoicename ?? deliveryname ?? customerFullname

# 1.0.12

- Set company as name and full name as contactname for placed orders.

# 1.0.11

- Don't throw insufficient stock errors on incoming webhooks, because it will eventually disable the entire webhook in Picqer

# 1.0.10

- Send streetline1 + streetline2 as address in Picqer

# 1.0.8

- Send telephone and email address to Picqer for guest orders

# 1.0.7

- Don't set contact name in Picqer if it's the same as customer name ([#267](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/267))
