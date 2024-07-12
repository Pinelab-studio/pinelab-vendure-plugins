# 2.0.0 (2024-06-21)

- Make `primaryCollection` custom field channel aware.

# 1.5.0 (2024-06-21)

- Updated Vendure to 2.2.6

# 1.4.2 (2023-10-24)

- Primary collection filter should hide Private collections (#395)

# 1.4.1 (2023-10-24)

- Fixed issue when creating a new product in Vendure (#367)

# 1.4.0 (2023-10-24)

- Updated vendure to 2.1.1

# 1.3.0 (2023-10-24)

- Config option `customFieldUITabName` added

# 1.2.2 (2023-10-01)

- Renamed admin ui extention `NgModule` from `SharedExtensionModule` to `PrimaryCollectionSharedExtensionModule`
- the `/src/ui` folder will be copied into dist folder when running `yarn build`

# 1.2.1 (2023-10-01)

- Fix `Error: Cannot find module '../types.ts'`

# 1.2.0 (2023-10-01)

- Export the service class `PrimaryCollectionHelperService` which can be used to assign `primaryCollection`s to products without existing value

# 1.1.1 (2023-09-28)

- Products will have a `primaryCollection` as a custom field which can be selected via Admin UI.

# 1.0.1 (2023-09-22)

- Added index barrel file to export plugin ([#261](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/261))

# 1.0.0 (2023-09-18)

- Initial setup([#258](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/258))
