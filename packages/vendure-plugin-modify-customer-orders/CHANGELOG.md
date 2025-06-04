# 1.6.0 (2025-06-04)

- Upgrade to Vendure to 3.3.2

# 1.5.0 (2025-02-27)

- Correctly unset active order on customer
- When assigning a draft order to a customer, transition the customers existing active order of customer to draft.

# 1.4.0 (2024-12-19)

- Update Vendure to 3.1.1

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
