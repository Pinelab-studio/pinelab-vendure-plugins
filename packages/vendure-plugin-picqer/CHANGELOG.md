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
