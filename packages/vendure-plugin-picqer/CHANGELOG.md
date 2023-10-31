# 2.0.0

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
