# 2.1.0 (2023-09-18)

- using `@HandleLoadingState('$activeOrder')` for queries and mutations that handle `activeOrder`s (like `addItemToOrder`, `applyCouponCode`, etc)
- using `@HandleLoadingState('$currentUser')` for queries and mutations that handle `currentUser` (like `login`)
- Test `VendureOrderClient`'s data and loading states in vue by installing `@nanostores/vue`
