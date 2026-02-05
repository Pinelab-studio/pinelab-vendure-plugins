# 2.2.0 (2026-02-05)

- Upgraded to Vendure 3.5.3

# 2.1.2 (2025-11-13)

- Documentation update

# 2.1.1 (2025-11-06)

- Updated official documentation URL

# 2.1.0 (2025-07-15)

- Allow generating presets only for assets that don't have presets yet

# 2.0.0 (2025-07-11)

- Added support for presets. The first time you set presets, or change preset settings, you will need to regenerate the presets for all existing assets with `generateGoogleStorageAssetPresets`.
- Breaking: Config is now passed into `GoogleStorageAssetsPlugin.init({})`, instead of to the `GoogleStorageStrategy` constructor
- Breaking: `Asset.thumbnail` is now deprecated, use `Asset.presets.<presetName>` instead. `Asset.thumbnail` still resolves to old thumbnails, **but will not work for new assets**
- Breaking: A database migration is needed, because a custom field is added to the `Asset` entity for saving the presets.

# 1.4.0 (2025-06-04)

- Upgrade to Vendure to 3.3.2

# 1.3.0 (2024-12-19)

- Update Vendure to 3.1.1

# 1.2.2 (2024-10-31)

- Use asset server for admin with Vendure V3 support

# 1.2.1 (2024-08-04)

- Update compatibility range (#480)

# 1.2.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 1.1.0 (2023-10-24)

- Updated vendure to 2.1.1
