# 1.1.0 (2023-10-20)

- Updated vendure to 2.1.1
# 1.0.11

- Don't throw insufficient stock errors on incoming webhooks, because it will eventually disable the entire webhook in Picqer

# 1.0.10

- Send streetline1 + streetline2 as address in Picqer

# 1.0.8

- Send telephone and email address to Picqer for guest orders

# 1.0.7

- Don't set contact name in Picqer if it's the same as customer name ([#267](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/267))
