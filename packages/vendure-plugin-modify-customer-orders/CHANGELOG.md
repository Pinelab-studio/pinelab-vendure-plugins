# 1.3.2-beta (2024-11-12)

- Ensure orders that transition from AddingItems to Draft also get de-activated

# 1.3.1 (2024-08-04)

- Update compatibility range (#480)

# 1.3.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 1.2.0 (2024-02-01)

- Place the transition logic into its own service class as suggested in #343

# 1.1.5 (2024-01-28)

- Transition the `Order` from `AddingItems` to `Draft` rather than copy all the fields and make a new `Draft` `Order`

# 1.1.1 (2024-01-23)

- Deactivate order when an active order already exists, instead of deleting it.

# 1.1.0 (2023-10-24)

- Updated vendure to 2.1.1
