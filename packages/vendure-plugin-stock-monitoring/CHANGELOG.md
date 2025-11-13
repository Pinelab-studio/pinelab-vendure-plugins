# 2.0.2 (2025-11-13)

- Documentation update

# 2.0.1 (2025-11-06)

- Updated official documentation URL

# 2.0.0 (2025-10-17)

- Added support for per variant thresholds
- Emitting event when a variant's stock level drops below a given threshold
- Processing stock checking in worker instead of main process.
- BREAKING: removed email handler functionality. You can implement your own email handler by listening to the event `StockLevelBelowThresholdEvent`.

# 1.6.0 (2025-06-04)

- Upgrade to Vendure to 3.3.2

# 1.5.1 (2025-03-27)

- Prevent error `column "stockonhand" does not exist` on Postgres

# 1.5.0 (2024-12-19)

- Update Vendure to 3.1.1

# 1.4.1 (2024-08-04)

- Update compatibility range (#480)

# 1.4.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 1.3.2 (2024-02-27)

- Show max 100 out of stock items instead of 50

# 1.3.1 (2023-11-21)

- Fixed link to products from stock widget

# 1.3.0 (2023-11-09)

- Fixed `reduceSum` function call bug
- Made `StockWidgetComponent` standalone and removed `StockWidgetSharedModule` and `StockWidgetModule`

# 1.2.0 (2023-10-26)

- Fix broken links as described [here](https://github.com/Pinelab-studio/pinelab-vendure-plugins/issues/277)

# 1.1.0 (2023-10-24)

- Updated vendure to 2.1.1
