import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  DateTime: any;
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: any;
  /** The `Upload` scalar type represents a file upload. */
  Upload: any;
};

export type AddFulfillmentToOrderResult =
  | CreateFulfillmentError
  | EmptyOrderLineSelectionError
  | Fulfillment
  | FulfillmentStateTransitionError
  | InsufficientStockOnHandError
  | InvalidFulfillmentHandlerError
  | ItemsAlreadyFulfilledError;

export type AddItemInput = {
  productVariantId: Scalars['ID'];
  quantity: Scalars['Int'];
};

export type AddManualPaymentToOrderResult = ManualPaymentStateError | Order;

export type AddNoteToCustomerInput = {
  id: Scalars['ID'];
  isPublic: Scalars['Boolean'];
  note: Scalars['String'];
};

export type AddNoteToOrderInput = {
  id: Scalars['ID'];
  isPublic: Scalars['Boolean'];
  note: Scalars['String'];
};

export type Address = Node & {
  __typename?: 'Address';
  city?: Maybe<Scalars['String']>;
  company?: Maybe<Scalars['String']>;
  country: Country;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  defaultBillingAddress?: Maybe<Scalars['Boolean']>;
  defaultShippingAddress?: Maybe<Scalars['Boolean']>;
  fullName?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  phoneNumber?: Maybe<Scalars['String']>;
  postalCode?: Maybe<Scalars['String']>;
  province?: Maybe<Scalars['String']>;
  streetLine1: Scalars['String'];
  streetLine2?: Maybe<Scalars['String']>;
  updatedAt: Scalars['DateTime'];
};

export type AdjustOrderLineInput = {
  orderLineId: Scalars['ID'];
  quantity: Scalars['Int'];
};

export type Adjustment = {
  __typename?: 'Adjustment';
  adjustmentSource: Scalars['String'];
  amount: Scalars['Int'];
  description: Scalars['String'];
  type: AdjustmentType;
};

export enum AdjustmentType {
  DistributedOrderPromotion = 'DISTRIBUTED_ORDER_PROMOTION',
  Other = 'OTHER',
  Promotion = 'PROMOTION',
}

export type Administrator = Node & {
  __typename?: 'Administrator';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  emailAddress: Scalars['String'];
  firstName: Scalars['String'];
  id: Scalars['ID'];
  lastName: Scalars['String'];
  updatedAt: Scalars['DateTime'];
  user: User;
};

export type AdministratorFilterParameter = {
  createdAt?: InputMaybe<DateOperators>;
  emailAddress?: InputMaybe<StringOperators>;
  firstName?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  lastName?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type AdministratorList = PaginatedList & {
  __typename?: 'AdministratorList';
  items: Array<Administrator>;
  totalItems: Scalars['Int'];
};

export type AdministratorListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<AdministratorFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<AdministratorSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type AdministratorPaymentInput = {
  metadata?: InputMaybe<Scalars['JSON']>;
  paymentMethod?: InputMaybe<Scalars['String']>;
};

export type AdministratorRefundInput = {
  paymentId: Scalars['ID'];
  reason?: InputMaybe<Scalars['String']>;
};

export type AdministratorSortParameter = {
  createdAt?: InputMaybe<SortOrder>;
  emailAddress?: InputMaybe<SortOrder>;
  firstName?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  lastName?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type Allocation = Node &
  StockMovement & {
    __typename?: 'Allocation';
    createdAt: Scalars['DateTime'];
    id: Scalars['ID'];
    orderLine: OrderLine;
    productVariant: ProductVariant;
    quantity: Scalars['Int'];
    type: StockMovementType;
    updatedAt: Scalars['DateTime'];
  };

/** Returned if an attempting to refund an OrderItem which has already been refunded */
export type AlreadyRefundedError = ErrorResult & {
  __typename?: 'AlreadyRefundedError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  refundId: Scalars['ID'];
};

export type Asset = Node & {
  __typename?: 'Asset';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  fileSize: Scalars['Int'];
  focalPoint?: Maybe<Coordinate>;
  height: Scalars['Int'];
  id: Scalars['ID'];
  mimeType: Scalars['String'];
  name: Scalars['String'];
  preview: Scalars['String'];
  source: Scalars['String'];
  tags: Array<Tag>;
  thumbnail: Scalars['String'];
  type: AssetType;
  updatedAt: Scalars['DateTime'];
  width: Scalars['Int'];
};

export type AssetFilterParameter = {
  createdAt?: InputMaybe<DateOperators>;
  fileSize?: InputMaybe<NumberOperators>;
  height?: InputMaybe<NumberOperators>;
  id?: InputMaybe<IdOperators>;
  mimeType?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  preview?: InputMaybe<StringOperators>;
  source?: InputMaybe<StringOperators>;
  thumbnail?: InputMaybe<StringOperators>;
  type?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
  width?: InputMaybe<NumberOperators>;
};

export type AssetList = PaginatedList & {
  __typename?: 'AssetList';
  items: Array<Asset>;
  totalItems: Scalars['Int'];
};

export type AssetListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<AssetFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<AssetSortParameter>;
  tags?: InputMaybe<Array<Scalars['String']>>;
  tagsOperator?: InputMaybe<LogicalOperator>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type AssetSortParameter = {
  createdAt?: InputMaybe<SortOrder>;
  fileSize?: InputMaybe<SortOrder>;
  height?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  mimeType?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  preview?: InputMaybe<SortOrder>;
  source?: InputMaybe<SortOrder>;
  thumbnail?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
  width?: InputMaybe<SortOrder>;
};

export enum AssetType {
  Binary = 'BINARY',
  Image = 'IMAGE',
  Video = 'VIDEO',
}

export type AssignAssetsToChannelInput = {
  assetIds: Array<Scalars['ID']>;
  channelId: Scalars['ID'];
};

export type AssignProductVariantsToChannelInput = {
  channelId: Scalars['ID'];
  priceFactor?: InputMaybe<Scalars['Float']>;
  productVariantIds: Array<Scalars['ID']>;
};

export type AssignProductsToChannelInput = {
  channelId: Scalars['ID'];
  priceFactor?: InputMaybe<Scalars['Float']>;
  productIds: Array<Scalars['ID']>;
};

export type AssignPromotionsToChannelInput = {
  channelId: Scalars['ID'];
  promotionIds: Array<Scalars['ID']>;
};

export type AuthenticationInput = {
  native?: InputMaybe<NativeAuthInput>;
};

export type AuthenticationMethod = Node & {
  __typename?: 'AuthenticationMethod';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  strategy: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type AuthenticationResult = CurrentUser | InvalidCredentialsError;

export type BooleanCustomFieldConfig = CustomField & {
  __typename?: 'BooleanCustomFieldConfig';
  description?: Maybe<Array<LocalizedString>>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<Array<LocalizedString>>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

/** Operators for filtering on a list of Boolean fields */
export type BooleanListOperators = {
  inList: Scalars['Boolean'];
};

/** Operators for filtering on a Boolean field */
export type BooleanOperators = {
  eq?: InputMaybe<Scalars['Boolean']>;
};

/** Returned if an attempting to cancel lines from an Order which is still active */
export type CancelActiveOrderError = ErrorResult & {
  __typename?: 'CancelActiveOrderError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  orderState: Scalars['String'];
};

export type CancelOrderInput = {
  /** Specify whether the shipping charges should also be cancelled. Defaults to false */
  cancelShipping?: InputMaybe<Scalars['Boolean']>;
  /** Optionally specify which OrderLines to cancel. If not provided, all OrderLines will be cancelled */
  lines?: InputMaybe<Array<OrderLineInput>>;
  /** The id of the order to be cancelled */
  orderId: Scalars['ID'];
  reason?: InputMaybe<Scalars['String']>;
};

export type CancelOrderResult =
  | CancelActiveOrderError
  | EmptyOrderLineSelectionError
  | MultipleOrderError
  | Order
  | OrderStateTransitionError
  | QuantityTooGreatError;

/** Returned if the Payment cancellation fails */
export type CancelPaymentError = ErrorResult & {
  __typename?: 'CancelPaymentError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  paymentErrorMessage: Scalars['String'];
};

export type CancelPaymentResult =
  | CancelPaymentError
  | Payment
  | PaymentStateTransitionError;

export type Cancellation = Node &
  StockMovement & {
    __typename?: 'Cancellation';
    createdAt: Scalars['DateTime'];
    id: Scalars['ID'];
    orderLine: OrderLine;
    productVariant: ProductVariant;
    quantity: Scalars['Int'];
    type: StockMovementType;
    updatedAt: Scalars['DateTime'];
  };

export type Channel = Node & {
  __typename?: 'Channel';
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  currencyCode: CurrencyCode;
  customFields?: Maybe<Scalars['JSON']>;
  defaultLanguageCode: LanguageCode;
  defaultShippingZone?: Maybe<Zone>;
  defaultTaxZone?: Maybe<Zone>;
  id: Scalars['ID'];
  pricesIncludeTax: Scalars['Boolean'];
  token: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

/**
 * Returned when the default LanguageCode of a Channel is no longer found in the `availableLanguages`
 * of the GlobalSettings
 */
export type ChannelDefaultLanguageError = ErrorResult & {
  __typename?: 'ChannelDefaultLanguageError';
  channelCode: Scalars['String'];
  errorCode: ErrorCode;
  language: Scalars['String'];
  message: Scalars['String'];
};

export type Collection = Node & {
  __typename?: 'Collection';
  assets: Array<Asset>;
  breadcrumbs: Array<CollectionBreadcrumb>;
  children?: Maybe<Array<Collection>>;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  featuredAsset?: Maybe<Asset>;
  filters: Array<ConfigurableOperation>;
  id: Scalars['ID'];
  isPrivate: Scalars['Boolean'];
  languageCode?: Maybe<LanguageCode>;
  name: Scalars['String'];
  parent?: Maybe<Collection>;
  position: Scalars['Int'];
  productVariants: ProductVariantList;
  slug: Scalars['String'];
  translations: Array<CollectionTranslation>;
  updatedAt: Scalars['DateTime'];
};

export type CollectionProductVariantsArgs = {
  options?: InputMaybe<ProductVariantListOptions>;
};

export type CollectionBreadcrumb = {
  __typename?: 'CollectionBreadcrumb';
  id: Scalars['ID'];
  name: Scalars['String'];
  slug: Scalars['String'];
};

export type CollectionFilterParameter = {
  createdAt?: InputMaybe<DateOperators>;
  description?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  isPrivate?: InputMaybe<BooleanOperators>;
  languageCode?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  position?: InputMaybe<NumberOperators>;
  slug?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type CollectionList = PaginatedList & {
  __typename?: 'CollectionList';
  items: Array<Collection>;
  totalItems: Scalars['Int'];
};

export type CollectionListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<CollectionFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<CollectionSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

/**
 * Which Collections are present in the products returned
 * by the search, and in what quantity.
 */
export type CollectionResult = {
  __typename?: 'CollectionResult';
  collection: Collection;
  count: Scalars['Int'];
};

export type CollectionSortParameter = {
  createdAt?: InputMaybe<SortOrder>;
  description?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  position?: InputMaybe<SortOrder>;
  slug?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type CollectionTranslation = {
  __typename?: 'CollectionTranslation';
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  slug: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type ConfigArg = {
  __typename?: 'ConfigArg';
  name: Scalars['String'];
  value: Scalars['String'];
};

export type ConfigArgDefinition = {
  __typename?: 'ConfigArgDefinition';
  defaultValue?: Maybe<Scalars['JSON']>;
  description?: Maybe<Scalars['String']>;
  label?: Maybe<Scalars['String']>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  required: Scalars['Boolean'];
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type ConfigArgInput = {
  name: Scalars['String'];
  /** A JSON stringified representation of the actual value */
  value: Scalars['String'];
};

export type ConfigurableOperation = {
  __typename?: 'ConfigurableOperation';
  args: Array<ConfigArg>;
  code: Scalars['String'];
};

export type ConfigurableOperationDefinition = {
  __typename?: 'ConfigurableOperationDefinition';
  args: Array<ConfigArgDefinition>;
  code: Scalars['String'];
  description: Scalars['String'];
};

export type ConfigurableOperationInput = {
  arguments: Array<ConfigArgInput>;
  code: Scalars['String'];
};

export type Coordinate = {
  __typename?: 'Coordinate';
  x: Scalars['Float'];
  y: Scalars['Float'];
};

export type CoordinateInput = {
  x: Scalars['Float'];
  y: Scalars['Float'];
};

export type Country = Node & {
  __typename?: 'Country';
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  enabled: Scalars['Boolean'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  translations: Array<CountryTranslation>;
  updatedAt: Scalars['DateTime'];
};

export type CountryFilterParameter = {
  code?: InputMaybe<StringOperators>;
  createdAt?: InputMaybe<DateOperators>;
  enabled?: InputMaybe<BooleanOperators>;
  id?: InputMaybe<IdOperators>;
  languageCode?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type CountryList = PaginatedList & {
  __typename?: 'CountryList';
  items: Array<Country>;
  totalItems: Scalars['Int'];
};

export type CountryListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<CountryFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<CountrySortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type CountrySortParameter = {
  code?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type CountryTranslation = {
  __typename?: 'CountryTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type CountryTranslationInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  id?: InputMaybe<Scalars['ID']>;
  languageCode: LanguageCode;
  name?: InputMaybe<Scalars['String']>;
};

/** Returned if the provided coupon code is invalid */
export type CouponCodeExpiredError = ErrorResult & {
  __typename?: 'CouponCodeExpiredError';
  couponCode: Scalars['String'];
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned if the provided coupon code is invalid */
export type CouponCodeInvalidError = ErrorResult & {
  __typename?: 'CouponCodeInvalidError';
  couponCode: Scalars['String'];
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned if the provided coupon code is invalid */
export type CouponCodeLimitError = ErrorResult & {
  __typename?: 'CouponCodeLimitError';
  couponCode: Scalars['String'];
  errorCode: ErrorCode;
  limit: Scalars['Int'];
  message: Scalars['String'];
};

export type CreateAddressInput = {
  city?: InputMaybe<Scalars['String']>;
  company?: InputMaybe<Scalars['String']>;
  countryCode: Scalars['String'];
  customFields?: InputMaybe<Scalars['JSON']>;
  defaultBillingAddress?: InputMaybe<Scalars['Boolean']>;
  defaultShippingAddress?: InputMaybe<Scalars['Boolean']>;
  fullName?: InputMaybe<Scalars['String']>;
  phoneNumber?: InputMaybe<Scalars['String']>;
  postalCode?: InputMaybe<Scalars['String']>;
  province?: InputMaybe<Scalars['String']>;
  streetLine1: Scalars['String'];
  streetLine2?: InputMaybe<Scalars['String']>;
};

export type CreateAdministratorInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  emailAddress: Scalars['String'];
  firstName: Scalars['String'];
  lastName: Scalars['String'];
  password: Scalars['String'];
  roleIds: Array<Scalars['ID']>;
};

export type CreateAssetInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  file: Scalars['Upload'];
  tags?: InputMaybe<Array<Scalars['String']>>;
};

export type CreateAssetResult = Asset | MimeTypeError;

export type CreateChannelInput = {
  code: Scalars['String'];
  currencyCode: CurrencyCode;
  customFields?: InputMaybe<Scalars['JSON']>;
  defaultLanguageCode: LanguageCode;
  defaultShippingZoneId: Scalars['ID'];
  defaultTaxZoneId: Scalars['ID'];
  pricesIncludeTax: Scalars['Boolean'];
  token: Scalars['String'];
};

export type CreateChannelResult = Channel | LanguageNotAvailableError;

export type CreateCollectionInput = {
  assetIds?: InputMaybe<Array<Scalars['ID']>>;
  customFields?: InputMaybe<Scalars['JSON']>;
  featuredAssetId?: InputMaybe<Scalars['ID']>;
  filters: Array<ConfigurableOperationInput>;
  isPrivate?: InputMaybe<Scalars['Boolean']>;
  parentId?: InputMaybe<Scalars['ID']>;
  translations: Array<CreateCollectionTranslationInput>;
};

export type CreateCollectionTranslationInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  description: Scalars['String'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  slug: Scalars['String'];
};

export type CreateCountryInput = {
  code: Scalars['String'];
  customFields?: InputMaybe<Scalars['JSON']>;
  enabled: Scalars['Boolean'];
  translations: Array<CountryTranslationInput>;
};

export type CreateCustomerGroupInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  customerIds?: InputMaybe<Array<Scalars['ID']>>;
  name: Scalars['String'];
};

export type CreateCustomerInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  emailAddress: Scalars['String'];
  firstName: Scalars['String'];
  lastName: Scalars['String'];
  phoneNumber?: InputMaybe<Scalars['String']>;
  title?: InputMaybe<Scalars['String']>;
};

export type CreateCustomerResult = Customer | EmailAddressConflictError;

export type CreateFacetInput = {
  code: Scalars['String'];
  customFields?: InputMaybe<Scalars['JSON']>;
  isPrivate: Scalars['Boolean'];
  translations: Array<FacetTranslationInput>;
  values?: InputMaybe<Array<CreateFacetValueWithFacetInput>>;
};

export type CreateFacetValueInput = {
  code: Scalars['String'];
  customFields?: InputMaybe<Scalars['JSON']>;
  facetId: Scalars['ID'];
  translations: Array<FacetValueTranslationInput>;
};

export type CreateFacetValueWithFacetInput = {
  code: Scalars['String'];
  translations: Array<FacetValueTranslationInput>;
};

/** Returned if an error is thrown in a FulfillmentHandler's createFulfillment method */
export type CreateFulfillmentError = ErrorResult & {
  __typename?: 'CreateFulfillmentError';
  errorCode: ErrorCode;
  fulfillmentHandlerError: Scalars['String'];
  message: Scalars['String'];
};

export type CreateGroupOptionInput = {
  code: Scalars['String'];
  translations: Array<ProductOptionGroupTranslationInput>;
};

export type CreatePaymentMethodInput = {
  checker?: InputMaybe<ConfigurableOperationInput>;
  code: Scalars['String'];
  customFields?: InputMaybe<Scalars['JSON']>;
  description?: InputMaybe<Scalars['String']>;
  enabled: Scalars['Boolean'];
  handler: ConfigurableOperationInput;
  name: Scalars['String'];
};

export type CreateProductInput = {
  assetIds?: InputMaybe<Array<Scalars['ID']>>;
  customFields?: InputMaybe<Scalars['JSON']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  facetValueIds?: InputMaybe<Array<Scalars['ID']>>;
  featuredAssetId?: InputMaybe<Scalars['ID']>;
  translations: Array<ProductTranslationInput>;
};

export type CreateProductOptionGroupInput = {
  code: Scalars['String'];
  customFields?: InputMaybe<Scalars['JSON']>;
  options: Array<CreateGroupOptionInput>;
  translations: Array<ProductOptionGroupTranslationInput>;
};

export type CreateProductOptionInput = {
  code: Scalars['String'];
  customFields?: InputMaybe<Scalars['JSON']>;
  productOptionGroupId: Scalars['ID'];
  translations: Array<ProductOptionGroupTranslationInput>;
};

export type CreateProductVariantInput = {
  assetIds?: InputMaybe<Array<Scalars['ID']>>;
  customFields?: InputMaybe<Scalars['JSON']>;
  facetValueIds?: InputMaybe<Array<Scalars['ID']>>;
  featuredAssetId?: InputMaybe<Scalars['ID']>;
  optionIds?: InputMaybe<Array<Scalars['ID']>>;
  outOfStockThreshold?: InputMaybe<Scalars['Int']>;
  price?: InputMaybe<Scalars['Int']>;
  productId: Scalars['ID'];
  sku: Scalars['String'];
  stockOnHand?: InputMaybe<Scalars['Int']>;
  taxCategoryId?: InputMaybe<Scalars['ID']>;
  trackInventory?: InputMaybe<GlobalFlag>;
  translations: Array<ProductVariantTranslationInput>;
  useGlobalOutOfStockThreshold?: InputMaybe<Scalars['Boolean']>;
};

export type CreateProductVariantOptionInput = {
  code: Scalars['String'];
  optionGroupId: Scalars['ID'];
  translations: Array<ProductOptionTranslationInput>;
};

export type CreatePromotionInput = {
  actions: Array<ConfigurableOperationInput>;
  conditions: Array<ConfigurableOperationInput>;
  couponCode?: InputMaybe<Scalars['String']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  enabled: Scalars['Boolean'];
  endsAt?: InputMaybe<Scalars['DateTime']>;
  name: Scalars['String'];
  perCustomerUsageLimit?: InputMaybe<Scalars['Int']>;
  startsAt?: InputMaybe<Scalars['DateTime']>;
};

export type CreatePromotionResult = MissingConditionsError | Promotion;

export type CreateRoleInput = {
  channelIds?: InputMaybe<Array<Scalars['ID']>>;
  code: Scalars['String'];
  description: Scalars['String'];
  permissions: Array<Permission>;
};

export type CreateShippingMethodInput = {
  calculator: ConfigurableOperationInput;
  checker: ConfigurableOperationInput;
  code: Scalars['String'];
  customFields?: InputMaybe<Scalars['JSON']>;
  fulfillmentHandler: Scalars['String'];
  translations: Array<ShippingMethodTranslationInput>;
};

export type CreateTagInput = {
  value: Scalars['String'];
};

export type CreateTaxCategoryInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  isDefault?: InputMaybe<Scalars['Boolean']>;
  name: Scalars['String'];
};

export type CreateTaxRateInput = {
  categoryId: Scalars['ID'];
  customFields?: InputMaybe<Scalars['JSON']>;
  customerGroupId?: InputMaybe<Scalars['ID']>;
  enabled: Scalars['Boolean'];
  name: Scalars['String'];
  value: Scalars['Float'];
  zoneId: Scalars['ID'];
};

export type CreateZoneInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  memberIds?: InputMaybe<Array<Scalars['ID']>>;
  name: Scalars['String'];
};

/**
 * @description
 * ISO 4217 currency code
 *
 * @docsCategory common
 */
export enum CurrencyCode {
  /** United Arab Emirates dirham */
  Aed = 'AED',
  /** Afghan afghani */
  Afn = 'AFN',
  /** Albanian lek */
  All = 'ALL',
  /** Armenian dram */
  Amd = 'AMD',
  /** Netherlands Antillean guilder */
  Ang = 'ANG',
  /** Angolan kwanza */
  Aoa = 'AOA',
  /** Argentine peso */
  Ars = 'ARS',
  /** Australian dollar */
  Aud = 'AUD',
  /** Aruban florin */
  Awg = 'AWG',
  /** Azerbaijani manat */
  Azn = 'AZN',
  /** Bosnia and Herzegovina convertible mark */
  Bam = 'BAM',
  /** Barbados dollar */
  Bbd = 'BBD',
  /** Bangladeshi taka */
  Bdt = 'BDT',
  /** Bulgarian lev */
  Bgn = 'BGN',
  /** Bahraini dinar */
  Bhd = 'BHD',
  /** Burundian franc */
  Bif = 'BIF',
  /** Bermudian dollar */
  Bmd = 'BMD',
  /** Brunei dollar */
  Bnd = 'BND',
  /** Boliviano */
  Bob = 'BOB',
  /** Brazilian real */
  Brl = 'BRL',
  /** Bahamian dollar */
  Bsd = 'BSD',
  /** Bhutanese ngultrum */
  Btn = 'BTN',
  /** Botswana pula */
  Bwp = 'BWP',
  /** Belarusian ruble */
  Byn = 'BYN',
  /** Belize dollar */
  Bzd = 'BZD',
  /** Canadian dollar */
  Cad = 'CAD',
  /** Congolese franc */
  Cdf = 'CDF',
  /** Swiss franc */
  Chf = 'CHF',
  /** Chilean peso */
  Clp = 'CLP',
  /** Renminbi (Chinese) yuan */
  Cny = 'CNY',
  /** Colombian peso */
  Cop = 'COP',
  /** Costa Rican colon */
  Crc = 'CRC',
  /** Cuban convertible peso */
  Cuc = 'CUC',
  /** Cuban peso */
  Cup = 'CUP',
  /** Cape Verde escudo */
  Cve = 'CVE',
  /** Czech koruna */
  Czk = 'CZK',
  /** Djiboutian franc */
  Djf = 'DJF',
  /** Danish krone */
  Dkk = 'DKK',
  /** Dominican peso */
  Dop = 'DOP',
  /** Algerian dinar */
  Dzd = 'DZD',
  /** Egyptian pound */
  Egp = 'EGP',
  /** Eritrean nakfa */
  Ern = 'ERN',
  /** Ethiopian birr */
  Etb = 'ETB',
  /** Euro */
  Eur = 'EUR',
  /** Fiji dollar */
  Fjd = 'FJD',
  /** Falkland Islands pound */
  Fkp = 'FKP',
  /** Pound sterling */
  Gbp = 'GBP',
  /** Georgian lari */
  Gel = 'GEL',
  /** Ghanaian cedi */
  Ghs = 'GHS',
  /** Gibraltar pound */
  Gip = 'GIP',
  /** Gambian dalasi */
  Gmd = 'GMD',
  /** Guinean franc */
  Gnf = 'GNF',
  /** Guatemalan quetzal */
  Gtq = 'GTQ',
  /** Guyanese dollar */
  Gyd = 'GYD',
  /** Hong Kong dollar */
  Hkd = 'HKD',
  /** Honduran lempira */
  Hnl = 'HNL',
  /** Croatian kuna */
  Hrk = 'HRK',
  /** Haitian gourde */
  Htg = 'HTG',
  /** Hungarian forint */
  Huf = 'HUF',
  /** Indonesian rupiah */
  Idr = 'IDR',
  /** Israeli new shekel */
  Ils = 'ILS',
  /** Indian rupee */
  Inr = 'INR',
  /** Iraqi dinar */
  Iqd = 'IQD',
  /** Iranian rial */
  Irr = 'IRR',
  /** Icelandic króna */
  Isk = 'ISK',
  /** Jamaican dollar */
  Jmd = 'JMD',
  /** Jordanian dinar */
  Jod = 'JOD',
  /** Japanese yen */
  Jpy = 'JPY',
  /** Kenyan shilling */
  Kes = 'KES',
  /** Kyrgyzstani som */
  Kgs = 'KGS',
  /** Cambodian riel */
  Khr = 'KHR',
  /** Comoro franc */
  Kmf = 'KMF',
  /** North Korean won */
  Kpw = 'KPW',
  /** South Korean won */
  Krw = 'KRW',
  /** Kuwaiti dinar */
  Kwd = 'KWD',
  /** Cayman Islands dollar */
  Kyd = 'KYD',
  /** Kazakhstani tenge */
  Kzt = 'KZT',
  /** Lao kip */
  Lak = 'LAK',
  /** Lebanese pound */
  Lbp = 'LBP',
  /** Sri Lankan rupee */
  Lkr = 'LKR',
  /** Liberian dollar */
  Lrd = 'LRD',
  /** Lesotho loti */
  Lsl = 'LSL',
  /** Libyan dinar */
  Lyd = 'LYD',
  /** Moroccan dirham */
  Mad = 'MAD',
  /** Moldovan leu */
  Mdl = 'MDL',
  /** Malagasy ariary */
  Mga = 'MGA',
  /** Macedonian denar */
  Mkd = 'MKD',
  /** Myanmar kyat */
  Mmk = 'MMK',
  /** Mongolian tögrög */
  Mnt = 'MNT',
  /** Macanese pataca */
  Mop = 'MOP',
  /** Mauritanian ouguiya */
  Mru = 'MRU',
  /** Mauritian rupee */
  Mur = 'MUR',
  /** Maldivian rufiyaa */
  Mvr = 'MVR',
  /** Malawian kwacha */
  Mwk = 'MWK',
  /** Mexican peso */
  Mxn = 'MXN',
  /** Malaysian ringgit */
  Myr = 'MYR',
  /** Mozambican metical */
  Mzn = 'MZN',
  /** Namibian dollar */
  Nad = 'NAD',
  /** Nigerian naira */
  Ngn = 'NGN',
  /** Nicaraguan córdoba */
  Nio = 'NIO',
  /** Norwegian krone */
  Nok = 'NOK',
  /** Nepalese rupee */
  Npr = 'NPR',
  /** New Zealand dollar */
  Nzd = 'NZD',
  /** Omani rial */
  Omr = 'OMR',
  /** Panamanian balboa */
  Pab = 'PAB',
  /** Peruvian sol */
  Pen = 'PEN',
  /** Papua New Guinean kina */
  Pgk = 'PGK',
  /** Philippine peso */
  Php = 'PHP',
  /** Pakistani rupee */
  Pkr = 'PKR',
  /** Polish złoty */
  Pln = 'PLN',
  /** Paraguayan guaraní */
  Pyg = 'PYG',
  /** Qatari riyal */
  Qar = 'QAR',
  /** Romanian leu */
  Ron = 'RON',
  /** Serbian dinar */
  Rsd = 'RSD',
  /** Russian ruble */
  Rub = 'RUB',
  /** Rwandan franc */
  Rwf = 'RWF',
  /** Saudi riyal */
  Sar = 'SAR',
  /** Solomon Islands dollar */
  Sbd = 'SBD',
  /** Seychelles rupee */
  Scr = 'SCR',
  /** Sudanese pound */
  Sdg = 'SDG',
  /** Swedish krona/kronor */
  Sek = 'SEK',
  /** Singapore dollar */
  Sgd = 'SGD',
  /** Saint Helena pound */
  Shp = 'SHP',
  /** Sierra Leonean leone */
  Sll = 'SLL',
  /** Somali shilling */
  Sos = 'SOS',
  /** Surinamese dollar */
  Srd = 'SRD',
  /** South Sudanese pound */
  Ssp = 'SSP',
  /** São Tomé and Príncipe dobra */
  Stn = 'STN',
  /** Salvadoran colón */
  Svc = 'SVC',
  /** Syrian pound */
  Syp = 'SYP',
  /** Swazi lilangeni */
  Szl = 'SZL',
  /** Thai baht */
  Thb = 'THB',
  /** Tajikistani somoni */
  Tjs = 'TJS',
  /** Turkmenistan manat */
  Tmt = 'TMT',
  /** Tunisian dinar */
  Tnd = 'TND',
  /** Tongan paʻanga */
  Top = 'TOP',
  /** Turkish lira */
  Try = 'TRY',
  /** Trinidad and Tobago dollar */
  Ttd = 'TTD',
  /** New Taiwan dollar */
  Twd = 'TWD',
  /** Tanzanian shilling */
  Tzs = 'TZS',
  /** Ukrainian hryvnia */
  Uah = 'UAH',
  /** Ugandan shilling */
  Ugx = 'UGX',
  /** United States dollar */
  Usd = 'USD',
  /** Uruguayan peso */
  Uyu = 'UYU',
  /** Uzbekistan som */
  Uzs = 'UZS',
  /** Venezuelan bolívar soberano */
  Ves = 'VES',
  /** Vietnamese đồng */
  Vnd = 'VND',
  /** Vanuatu vatu */
  Vuv = 'VUV',
  /** Samoan tala */
  Wst = 'WST',
  /** CFA franc BEAC */
  Xaf = 'XAF',
  /** East Caribbean dollar */
  Xcd = 'XCD',
  /** CFA franc BCEAO */
  Xof = 'XOF',
  /** CFP franc (franc Pacifique) */
  Xpf = 'XPF',
  /** Yemeni rial */
  Yer = 'YER',
  /** South African rand */
  Zar = 'ZAR',
  /** Zambian kwacha */
  Zmw = 'ZMW',
  /** Zimbabwean dollar */
  Zwl = 'ZWL',
}

export type CurrentUser = {
  __typename?: 'CurrentUser';
  channels: Array<CurrentUserChannel>;
  id: Scalars['ID'];
  identifier: Scalars['String'];
};

export type CurrentUserChannel = {
  __typename?: 'CurrentUserChannel';
  code: Scalars['String'];
  id: Scalars['ID'];
  permissions: Array<Permission>;
  token: Scalars['String'];
};

export type CustomField = {
  description?: Maybe<Array<LocalizedString>>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<Array<LocalizedString>>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type CustomFieldConfig =
  | BooleanCustomFieldConfig
  | DateTimeCustomFieldConfig
  | FloatCustomFieldConfig
  | IntCustomFieldConfig
  | LocaleStringCustomFieldConfig
  | RelationCustomFieldConfig
  | StringCustomFieldConfig
  | TextCustomFieldConfig;

export type CustomFields = {
  __typename?: 'CustomFields';
  Address: Array<CustomFieldConfig>;
  Administrator: Array<CustomFieldConfig>;
  Asset: Array<CustomFieldConfig>;
  Channel: Array<CustomFieldConfig>;
  Collection: Array<CustomFieldConfig>;
  Country: Array<CustomFieldConfig>;
  Customer: Array<CustomFieldConfig>;
  CustomerGroup: Array<CustomFieldConfig>;
  Facet: Array<CustomFieldConfig>;
  FacetValue: Array<CustomFieldConfig>;
  Fulfillment: Array<CustomFieldConfig>;
  GlobalSettings: Array<CustomFieldConfig>;
  Order: Array<CustomFieldConfig>;
  OrderLine: Array<CustomFieldConfig>;
  PaymentMethod: Array<CustomFieldConfig>;
  Product: Array<CustomFieldConfig>;
  ProductOption: Array<CustomFieldConfig>;
  ProductOptionGroup: Array<CustomFieldConfig>;
  ProductVariant: Array<CustomFieldConfig>;
  Promotion: Array<CustomFieldConfig>;
  ShippingMethod: Array<CustomFieldConfig>;
  TaxCategory: Array<CustomFieldConfig>;
  TaxRate: Array<CustomFieldConfig>;
  User: Array<CustomFieldConfig>;
  Zone: Array<CustomFieldConfig>;
};

export type Customer = Node & {
  __typename?: 'Customer';
  addresses?: Maybe<Array<Address>>;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  emailAddress: Scalars['String'];
  firstName: Scalars['String'];
  groups: Array<CustomerGroup>;
  history: HistoryEntryList;
  id: Scalars['ID'];
  lastName: Scalars['String'];
  orders: OrderList;
  phoneNumber?: Maybe<Scalars['String']>;
  title?: Maybe<Scalars['String']>;
  updatedAt: Scalars['DateTime'];
  user?: Maybe<User>;
};

export type CustomerHistoryArgs = {
  options?: InputMaybe<HistoryEntryListOptions>;
};

export type CustomerOrdersArgs = {
  options?: InputMaybe<OrderListOptions>;
};

export type CustomerFilterParameter = {
  createdAt?: InputMaybe<DateOperators>;
  emailAddress?: InputMaybe<StringOperators>;
  firstName?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  lastName?: InputMaybe<StringOperators>;
  phoneNumber?: InputMaybe<StringOperators>;
  postalCode?: InputMaybe<StringOperators>;
  title?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type CustomerGroup = Node & {
  __typename?: 'CustomerGroup';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  customers: CustomerList;
  id: Scalars['ID'];
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type CustomerGroupCustomersArgs = {
  options?: InputMaybe<CustomerListOptions>;
};

export type CustomerGroupFilterParameter = {
  createdAt?: InputMaybe<DateOperators>;
  id?: InputMaybe<IdOperators>;
  name?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type CustomerGroupList = PaginatedList & {
  __typename?: 'CustomerGroupList';
  items: Array<CustomerGroup>;
  totalItems: Scalars['Int'];
};

export type CustomerGroupListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<CustomerGroupFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<CustomerGroupSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type CustomerGroupSortParameter = {
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type CustomerList = PaginatedList & {
  __typename?: 'CustomerList';
  items: Array<Customer>;
  totalItems: Scalars['Int'];
};

export type CustomerListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<CustomerFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<CustomerSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type CustomerSortParameter = {
  createdAt?: InputMaybe<SortOrder>;
  emailAddress?: InputMaybe<SortOrder>;
  firstName?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  lastName?: InputMaybe<SortOrder>;
  phoneNumber?: InputMaybe<SortOrder>;
  title?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

/** Operators for filtering on a list of Date fields */
export type DateListOperators = {
  inList: Scalars['DateTime'];
};

/** Operators for filtering on a DateTime field */
export type DateOperators = {
  after?: InputMaybe<Scalars['DateTime']>;
  before?: InputMaybe<Scalars['DateTime']>;
  between?: InputMaybe<DateRange>;
  eq?: InputMaybe<Scalars['DateTime']>;
};

export type DateRange = {
  end: Scalars['DateTime'];
  start: Scalars['DateTime'];
};

/**
 * Expects the same validation formats as the `<input type="datetime-local">` HTML element.
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local#Additional_attributes
 */
export type DateTimeCustomFieldConfig = CustomField & {
  __typename?: 'DateTimeCustomFieldConfig';
  description?: Maybe<Array<LocalizedString>>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<Array<LocalizedString>>;
  list: Scalars['Boolean'];
  max?: Maybe<Scalars['String']>;
  min?: Maybe<Scalars['String']>;
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  step?: Maybe<Scalars['Int']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type DeleteAssetInput = {
  assetId: Scalars['ID'];
  deleteFromAllChannels?: InputMaybe<Scalars['Boolean']>;
  force?: InputMaybe<Scalars['Boolean']>;
};

export type DeleteAssetsInput = {
  assetIds: Array<Scalars['ID']>;
  deleteFromAllChannels?: InputMaybe<Scalars['Boolean']>;
  force?: InputMaybe<Scalars['Boolean']>;
};

export type DeletionResponse = {
  __typename?: 'DeletionResponse';
  message?: Maybe<Scalars['String']>;
  result: DeletionResult;
};

export enum DeletionResult {
  /** The entity was successfully deleted */
  Deleted = 'DELETED',
  /** Deletion did not take place, reason given in message */
  NotDeleted = 'NOT_DELETED',
}

export type Discount = {
  __typename?: 'Discount';
  adjustmentSource: Scalars['String'];
  amount: Scalars['Int'];
  amountWithTax: Scalars['Int'];
  description: Scalars['String'];
  type: AdjustmentType;
};

export type EBoekhoudenConfig = {
  __typename?: 'EBoekhoudenConfig';
  account: Scalars['String'];
  contraAccount: Scalars['String'];
  enabled: Scalars['Boolean'];
  secret1: Scalars['String'];
  secret2: Scalars['String'];
  username: Scalars['String'];
};

export type EBoekhoudenConfigInput = {
  account: Scalars['String'];
  contraAccount: Scalars['String'];
  enabled: Scalars['Boolean'];
  secret1: Scalars['String'];
  secret2: Scalars['String'];
  username: Scalars['String'];
};

/** Returned when attempting to create a Customer with an email address already registered to an existing User. */
export type EmailAddressConflictError = ErrorResult & {
  __typename?: 'EmailAddressConflictError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned if no OrderLines have been specified for the operation */
export type EmptyOrderLineSelectionError = ErrorResult & {
  __typename?: 'EmptyOrderLineSelectionError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export enum ErrorCode {
  AlreadyRefundedError = 'ALREADY_REFUNDED_ERROR',
  CancelActiveOrderError = 'CANCEL_ACTIVE_ORDER_ERROR',
  CancelPaymentError = 'CANCEL_PAYMENT_ERROR',
  ChannelDefaultLanguageError = 'CHANNEL_DEFAULT_LANGUAGE_ERROR',
  CouponCodeExpiredError = 'COUPON_CODE_EXPIRED_ERROR',
  CouponCodeInvalidError = 'COUPON_CODE_INVALID_ERROR',
  CouponCodeLimitError = 'COUPON_CODE_LIMIT_ERROR',
  CreateFulfillmentError = 'CREATE_FULFILLMENT_ERROR',
  EmailAddressConflictError = 'EMAIL_ADDRESS_CONFLICT_ERROR',
  EmptyOrderLineSelectionError = 'EMPTY_ORDER_LINE_SELECTION_ERROR',
  FulfillmentStateTransitionError = 'FULFILLMENT_STATE_TRANSITION_ERROR',
  InsufficientStockError = 'INSUFFICIENT_STOCK_ERROR',
  InsufficientStockOnHandError = 'INSUFFICIENT_STOCK_ON_HAND_ERROR',
  InvalidCredentialsError = 'INVALID_CREDENTIALS_ERROR',
  InvalidFulfillmentHandlerError = 'INVALID_FULFILLMENT_HANDLER_ERROR',
  ItemsAlreadyFulfilledError = 'ITEMS_ALREADY_FULFILLED_ERROR',
  LanguageNotAvailableError = 'LANGUAGE_NOT_AVAILABLE_ERROR',
  ManualPaymentStateError = 'MANUAL_PAYMENT_STATE_ERROR',
  MimeTypeError = 'MIME_TYPE_ERROR',
  MissingConditionsError = 'MISSING_CONDITIONS_ERROR',
  MultipleOrderError = 'MULTIPLE_ORDER_ERROR',
  NativeAuthStrategyError = 'NATIVE_AUTH_STRATEGY_ERROR',
  NegativeQuantityError = 'NEGATIVE_QUANTITY_ERROR',
  NothingToRefundError = 'NOTHING_TO_REFUND_ERROR',
  NoChangesSpecifiedError = 'NO_CHANGES_SPECIFIED_ERROR',
  OrderLimitError = 'ORDER_LIMIT_ERROR',
  OrderModificationStateError = 'ORDER_MODIFICATION_STATE_ERROR',
  OrderStateTransitionError = 'ORDER_STATE_TRANSITION_ERROR',
  PaymentMethodMissingError = 'PAYMENT_METHOD_MISSING_ERROR',
  PaymentOrderMismatchError = 'PAYMENT_ORDER_MISMATCH_ERROR',
  PaymentStateTransitionError = 'PAYMENT_STATE_TRANSITION_ERROR',
  ProductOptionInUseError = 'PRODUCT_OPTION_IN_USE_ERROR',
  QuantityTooGreatError = 'QUANTITY_TOO_GREAT_ERROR',
  RefundOrderStateError = 'REFUND_ORDER_STATE_ERROR',
  RefundPaymentIdMissingError = 'REFUND_PAYMENT_ID_MISSING_ERROR',
  RefundStateTransitionError = 'REFUND_STATE_TRANSITION_ERROR',
  SettlePaymentError = 'SETTLE_PAYMENT_ERROR',
  UnknownError = 'UNKNOWN_ERROR',
}

export type ErrorResult = {
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type Facet = Node & {
  __typename?: 'Facet';
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  isPrivate: Scalars['Boolean'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  translations: Array<FacetTranslation>;
  updatedAt: Scalars['DateTime'];
  values: Array<FacetValue>;
};

export type FacetFilterParameter = {
  code?: InputMaybe<StringOperators>;
  createdAt?: InputMaybe<DateOperators>;
  id?: InputMaybe<IdOperators>;
  isPrivate?: InputMaybe<BooleanOperators>;
  languageCode?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type FacetList = PaginatedList & {
  __typename?: 'FacetList';
  items: Array<Facet>;
  totalItems: Scalars['Int'];
};

export type FacetListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<FacetFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<FacetSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type FacetSortParameter = {
  code?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type FacetTranslation = {
  __typename?: 'FacetTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type FacetTranslationInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  id?: InputMaybe<Scalars['ID']>;
  languageCode: LanguageCode;
  name?: InputMaybe<Scalars['String']>;
};

export type FacetValue = Node & {
  __typename?: 'FacetValue';
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  facet: Facet;
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  translations: Array<FacetValueTranslation>;
  updatedAt: Scalars['DateTime'];
};

/**
 * Used to construct boolean expressions for filtering search results
 * by FacetValue ID. Examples:
 *
 * * ID=1 OR ID=2: `{ facetValueFilters: [{ or: [1,2] }] }`
 * * ID=1 AND ID=2: `{ facetValueFilters: [{ and: 1 }, { and: 2 }] }`
 * * ID=1 AND (ID=2 OR ID=3): `{ facetValueFilters: [{ and: 1 }, { or: [2,3] }] }`
 */
export type FacetValueFilterInput = {
  and?: InputMaybe<Scalars['ID']>;
  or?: InputMaybe<Array<Scalars['ID']>>;
};

/**
 * Which FacetValues are present in the products returned
 * by the search, and in what quantity.
 */
export type FacetValueResult = {
  __typename?: 'FacetValueResult';
  count: Scalars['Int'];
  facetValue: FacetValue;
};

export type FacetValueTranslation = {
  __typename?: 'FacetValueTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type FacetValueTranslationInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  id?: InputMaybe<Scalars['ID']>;
  languageCode: LanguageCode;
  name?: InputMaybe<Scalars['String']>;
};

export type FloatCustomFieldConfig = CustomField & {
  __typename?: 'FloatCustomFieldConfig';
  description?: Maybe<Array<LocalizedString>>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<Array<LocalizedString>>;
  list: Scalars['Boolean'];
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  step?: Maybe<Scalars['Float']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type FulfillOrderInput = {
  handler: ConfigurableOperationInput;
  lines: Array<OrderLineInput>;
};

export type Fulfillment = Node & {
  __typename?: 'Fulfillment';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  method: Scalars['String'];
  nextStates: Array<Scalars['String']>;
  orderItems: Array<OrderItem>;
  state: Scalars['String'];
  summary: Array<FulfillmentLineSummary>;
  trackingCode?: Maybe<Scalars['String']>;
  updatedAt: Scalars['DateTime'];
};

export type FulfillmentLineSummary = {
  __typename?: 'FulfillmentLineSummary';
  orderLine: OrderLine;
  quantity: Scalars['Int'];
};

/** Returned when there is an error in transitioning the Fulfillment state */
export type FulfillmentStateTransitionError = ErrorResult & {
  __typename?: 'FulfillmentStateTransitionError';
  errorCode: ErrorCode;
  fromState: Scalars['String'];
  message: Scalars['String'];
  toState: Scalars['String'];
  transitionError: Scalars['String'];
};

export enum GlobalFlag {
  False = 'FALSE',
  Inherit = 'INHERIT',
  True = 'TRUE',
}

export type GlobalSettings = {
  __typename?: 'GlobalSettings';
  availableLanguages: Array<LanguageCode>;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  outOfStockThreshold: Scalars['Int'];
  serverConfig: ServerConfig;
  trackInventory: Scalars['Boolean'];
  updatedAt: Scalars['DateTime'];
};

export type GoedgepicktConfig = {
  __typename?: 'GoedgepicktConfig';
  apiKey?: Maybe<Scalars['String']>;
  autoFulfill?: Maybe<Scalars['Boolean']>;
  enabled?: Maybe<Scalars['Boolean']>;
  orderWebhookKey?: Maybe<Scalars['String']>;
  orderWebhookUrl?: Maybe<Scalars['String']>;
  stockWebhookKey?: Maybe<Scalars['String']>;
  stockWebhookUrl?: Maybe<Scalars['String']>;
  webshopUuid?: Maybe<Scalars['String']>;
};

export type GoedgepicktConfigInput = {
  apiKey?: InputMaybe<Scalars['String']>;
  autoFulfill?: InputMaybe<Scalars['Boolean']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  webshopUuid?: InputMaybe<Scalars['String']>;
};

export type GoedgepicktConfigUpdateResult =
  | GoedgepicktConfig
  | GoedgepicktError;

export type GoedgepicktError = {
  __typename?: 'GoedgepicktError';
  message?: Maybe<Scalars['String']>;
};

export type HistoryEntry = Node & {
  __typename?: 'HistoryEntry';
  administrator?: Maybe<Administrator>;
  createdAt: Scalars['DateTime'];
  data: Scalars['JSON'];
  id: Scalars['ID'];
  isPublic: Scalars['Boolean'];
  type: HistoryEntryType;
  updatedAt: Scalars['DateTime'];
};

export type HistoryEntryFilterParameter = {
  createdAt?: InputMaybe<DateOperators>;
  id?: InputMaybe<IdOperators>;
  isPublic?: InputMaybe<BooleanOperators>;
  type?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type HistoryEntryList = PaginatedList & {
  __typename?: 'HistoryEntryList';
  items: Array<HistoryEntry>;
  totalItems: Scalars['Int'];
};

export type HistoryEntryListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<HistoryEntryFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<HistoryEntrySortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type HistoryEntrySortParameter = {
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export enum HistoryEntryType {
  CustomerAddedToGroup = 'CUSTOMER_ADDED_TO_GROUP',
  CustomerAddressCreated = 'CUSTOMER_ADDRESS_CREATED',
  CustomerAddressDeleted = 'CUSTOMER_ADDRESS_DELETED',
  CustomerAddressUpdated = 'CUSTOMER_ADDRESS_UPDATED',
  CustomerDetailUpdated = 'CUSTOMER_DETAIL_UPDATED',
  CustomerEmailUpdateRequested = 'CUSTOMER_EMAIL_UPDATE_REQUESTED',
  CustomerEmailUpdateVerified = 'CUSTOMER_EMAIL_UPDATE_VERIFIED',
  CustomerNote = 'CUSTOMER_NOTE',
  CustomerPasswordResetRequested = 'CUSTOMER_PASSWORD_RESET_REQUESTED',
  CustomerPasswordResetVerified = 'CUSTOMER_PASSWORD_RESET_VERIFIED',
  CustomerPasswordUpdated = 'CUSTOMER_PASSWORD_UPDATED',
  CustomerRegistered = 'CUSTOMER_REGISTERED',
  CustomerRemovedFromGroup = 'CUSTOMER_REMOVED_FROM_GROUP',
  CustomerVerified = 'CUSTOMER_VERIFIED',
  OrderCancellation = 'ORDER_CANCELLATION',
  OrderCouponApplied = 'ORDER_COUPON_APPLIED',
  OrderCouponRemoved = 'ORDER_COUPON_REMOVED',
  OrderFulfillment = 'ORDER_FULFILLMENT',
  OrderFulfillmentTransition = 'ORDER_FULFILLMENT_TRANSITION',
  OrderModified = 'ORDER_MODIFIED',
  OrderNote = 'ORDER_NOTE',
  OrderPaymentTransition = 'ORDER_PAYMENT_TRANSITION',
  OrderRefundTransition = 'ORDER_REFUND_TRANSITION',
  OrderStateTransition = 'ORDER_STATE_TRANSITION',
}

/** Operators for filtering on a list of ID fields */
export type IdListOperators = {
  inList: Scalars['ID'];
};

/** Operators for filtering on an ID field */
export type IdOperators = {
  eq?: InputMaybe<Scalars['String']>;
  in?: InputMaybe<Array<Scalars['String']>>;
  notEq?: InputMaybe<Scalars['String']>;
  notIn?: InputMaybe<Array<Scalars['String']>>;
};

export type ImportInfo = {
  __typename?: 'ImportInfo';
  errors?: Maybe<Array<Scalars['String']>>;
  imported: Scalars['Int'];
  processed: Scalars['Int'];
};

/** Returned when attempting to add more items to the Order than are available */
export type InsufficientStockError = ErrorResult & {
  __typename?: 'InsufficientStockError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  order: Order;
  quantityAvailable: Scalars['Int'];
};

/**
 * Returned if attempting to create a Fulfillment when there is insufficient
 * stockOnHand of a ProductVariant to satisfy the requested quantity.
 */
export type InsufficientStockOnHandError = ErrorResult & {
  __typename?: 'InsufficientStockOnHandError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  productVariantId: Scalars['ID'];
  productVariantName: Scalars['String'];
  stockOnHand: Scalars['Int'];
};

export type IntCustomFieldConfig = CustomField & {
  __typename?: 'IntCustomFieldConfig';
  description?: Maybe<Array<LocalizedString>>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<Array<LocalizedString>>;
  list: Scalars['Boolean'];
  max?: Maybe<Scalars['Int']>;
  min?: Maybe<Scalars['Int']>;
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  step?: Maybe<Scalars['Int']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

/** Returned if the user authentication credentials are not valid */
export type InvalidCredentialsError = ErrorResult & {
  __typename?: 'InvalidCredentialsError';
  authenticationError: Scalars['String'];
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned if the specified FulfillmentHandler code is not valid */
export type InvalidFulfillmentHandlerError = ErrorResult & {
  __typename?: 'InvalidFulfillmentHandlerError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type Invoice = {
  __typename?: 'Invoice';
  createdAt?: Maybe<Scalars['DateTime']>;
  customerEmail: Scalars['String'];
  downloadUrl: Scalars['String'];
  id: Scalars['ID'];
  invoiceNumber: Scalars['Int'];
  orderCode: Scalars['String'];
  orderId: Scalars['String'];
};

export type InvoiceConfig = {
  __typename?: 'InvoiceConfig';
  enabled: Scalars['Boolean'];
  id: Scalars['ID'];
  templateString?: Maybe<Scalars['String']>;
};

export type InvoiceConfigInput = {
  enabled: Scalars['Boolean'];
  templateString?: InputMaybe<Scalars['String']>;
};

export type InvoiceList = {
  __typename?: 'InvoiceList';
  items: Array<Invoice>;
  totalItems: Scalars['Int'];
};

export type InvoicesListInput = {
  itemsPerPage: Scalars['Int'];
  page: Scalars['Int'];
};

/** Returned if the specified items are already part of a Fulfillment */
export type ItemsAlreadyFulfilledError = ErrorResult & {
  __typename?: 'ItemsAlreadyFulfilledError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type Job = Node & {
  __typename?: 'Job';
  attempts: Scalars['Int'];
  createdAt: Scalars['DateTime'];
  data?: Maybe<Scalars['JSON']>;
  duration: Scalars['Int'];
  error?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  isSettled: Scalars['Boolean'];
  progress: Scalars['Float'];
  queueName: Scalars['String'];
  result?: Maybe<Scalars['JSON']>;
  retries: Scalars['Int'];
  settledAt?: Maybe<Scalars['DateTime']>;
  startedAt?: Maybe<Scalars['DateTime']>;
  state: JobState;
};

export type JobBufferSize = {
  __typename?: 'JobBufferSize';
  bufferId: Scalars['String'];
  size: Scalars['Int'];
};

export type JobFilterParameter = {
  attempts?: InputMaybe<NumberOperators>;
  createdAt?: InputMaybe<DateOperators>;
  duration?: InputMaybe<NumberOperators>;
  id?: InputMaybe<IdOperators>;
  isSettled?: InputMaybe<BooleanOperators>;
  progress?: InputMaybe<NumberOperators>;
  queueName?: InputMaybe<StringOperators>;
  retries?: InputMaybe<NumberOperators>;
  settledAt?: InputMaybe<DateOperators>;
  startedAt?: InputMaybe<DateOperators>;
  state?: InputMaybe<StringOperators>;
};

export type JobList = PaginatedList & {
  __typename?: 'JobList';
  items: Array<Job>;
  totalItems: Scalars['Int'];
};

export type JobListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<JobFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<JobSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type JobQueue = {
  __typename?: 'JobQueue';
  name: Scalars['String'];
  running: Scalars['Boolean'];
};

export type JobSortParameter = {
  attempts?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  duration?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  progress?: InputMaybe<SortOrder>;
  queueName?: InputMaybe<SortOrder>;
  retries?: InputMaybe<SortOrder>;
  settledAt?: InputMaybe<SortOrder>;
  startedAt?: InputMaybe<SortOrder>;
};

/**
 * @description
 * The state of a Job in the JobQueue
 *
 * @docsCategory common
 */
export enum JobState {
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Pending = 'PENDING',
  Retrying = 'RETRYING',
  Running = 'RUNNING',
}

/**
 * @description
 * Languages in the form of a ISO 639-1 language code with optional
 * region or script modifier (e.g. de_AT). The selection available is based
 * on the [Unicode CLDR summary list](https://unicode-org.github.io/cldr-staging/charts/37/summary/root.html)
 * and includes the major spoken languages of the world and any widely-used variants.
 *
 * @docsCategory common
 */
export enum LanguageCode {
  /** Afrikaans */
  Af = 'af',
  /** Akan */
  Ak = 'ak',
  /** Amharic */
  Am = 'am',
  /** Arabic */
  Ar = 'ar',
  /** Assamese */
  As = 'as',
  /** Azerbaijani */
  Az = 'az',
  /** Belarusian */
  Be = 'be',
  /** Bulgarian */
  Bg = 'bg',
  /** Bambara */
  Bm = 'bm',
  /** Bangla */
  Bn = 'bn',
  /** Tibetan */
  Bo = 'bo',
  /** Breton */
  Br = 'br',
  /** Bosnian */
  Bs = 'bs',
  /** Catalan */
  Ca = 'ca',
  /** Chechen */
  Ce = 'ce',
  /** Corsican */
  Co = 'co',
  /** Czech */
  Cs = 'cs',
  /** Church Slavic */
  Cu = 'cu',
  /** Welsh */
  Cy = 'cy',
  /** Danish */
  Da = 'da',
  /** German */
  De = 'de',
  /** Austrian German */
  DeAt = 'de_AT',
  /** Swiss High German */
  DeCh = 'de_CH',
  /** Dzongkha */
  Dz = 'dz',
  /** Ewe */
  Ee = 'ee',
  /** Greek */
  El = 'el',
  /** English */
  En = 'en',
  /** Australian English */
  EnAu = 'en_AU',
  /** Canadian English */
  EnCa = 'en_CA',
  /** British English */
  EnGb = 'en_GB',
  /** American English */
  EnUs = 'en_US',
  /** Esperanto */
  Eo = 'eo',
  /** Spanish */
  Es = 'es',
  /** European Spanish */
  EsEs = 'es_ES',
  /** Mexican Spanish */
  EsMx = 'es_MX',
  /** Estonian */
  Et = 'et',
  /** Basque */
  Eu = 'eu',
  /** Persian */
  Fa = 'fa',
  /** Dari */
  FaAf = 'fa_AF',
  /** Fulah */
  Ff = 'ff',
  /** Finnish */
  Fi = 'fi',
  /** Faroese */
  Fo = 'fo',
  /** French */
  Fr = 'fr',
  /** Canadian French */
  FrCa = 'fr_CA',
  /** Swiss French */
  FrCh = 'fr_CH',
  /** Western Frisian */
  Fy = 'fy',
  /** Irish */
  Ga = 'ga',
  /** Scottish Gaelic */
  Gd = 'gd',
  /** Galician */
  Gl = 'gl',
  /** Gujarati */
  Gu = 'gu',
  /** Manx */
  Gv = 'gv',
  /** Hausa */
  Ha = 'ha',
  /** Hebrew */
  He = 'he',
  /** Hindi */
  Hi = 'hi',
  /** Croatian */
  Hr = 'hr',
  /** Haitian Creole */
  Ht = 'ht',
  /** Hungarian */
  Hu = 'hu',
  /** Armenian */
  Hy = 'hy',
  /** Interlingua */
  Ia = 'ia',
  /** Indonesian */
  Id = 'id',
  /** Igbo */
  Ig = 'ig',
  /** Sichuan Yi */
  Ii = 'ii',
  /** Icelandic */
  Is = 'is',
  /** Italian */
  It = 'it',
  /** Japanese */
  Ja = 'ja',
  /** Javanese */
  Jv = 'jv',
  /** Georgian */
  Ka = 'ka',
  /** Kikuyu */
  Ki = 'ki',
  /** Kazakh */
  Kk = 'kk',
  /** Kalaallisut */
  Kl = 'kl',
  /** Khmer */
  Km = 'km',
  /** Kannada */
  Kn = 'kn',
  /** Korean */
  Ko = 'ko',
  /** Kashmiri */
  Ks = 'ks',
  /** Kurdish */
  Ku = 'ku',
  /** Cornish */
  Kw = 'kw',
  /** Kyrgyz */
  Ky = 'ky',
  /** Latin */
  La = 'la',
  /** Luxembourgish */
  Lb = 'lb',
  /** Ganda */
  Lg = 'lg',
  /** Lingala */
  Ln = 'ln',
  /** Lao */
  Lo = 'lo',
  /** Lithuanian */
  Lt = 'lt',
  /** Luba-Katanga */
  Lu = 'lu',
  /** Latvian */
  Lv = 'lv',
  /** Malagasy */
  Mg = 'mg',
  /** Maori */
  Mi = 'mi',
  /** Macedonian */
  Mk = 'mk',
  /** Malayalam */
  Ml = 'ml',
  /** Mongolian */
  Mn = 'mn',
  /** Marathi */
  Mr = 'mr',
  /** Malay */
  Ms = 'ms',
  /** Maltese */
  Mt = 'mt',
  /** Burmese */
  My = 'my',
  /** Norwegian Bokmål */
  Nb = 'nb',
  /** North Ndebele */
  Nd = 'nd',
  /** Nepali */
  Ne = 'ne',
  /** Dutch */
  Nl = 'nl',
  /** Flemish */
  NlBe = 'nl_BE',
  /** Norwegian Nynorsk */
  Nn = 'nn',
  /** Nyanja */
  Ny = 'ny',
  /** Oromo */
  Om = 'om',
  /** Odia */
  Or = 'or',
  /** Ossetic */
  Os = 'os',
  /** Punjabi */
  Pa = 'pa',
  /** Polish */
  Pl = 'pl',
  /** Pashto */
  Ps = 'ps',
  /** Portuguese */
  Pt = 'pt',
  /** Brazilian Portuguese */
  PtBr = 'pt_BR',
  /** European Portuguese */
  PtPt = 'pt_PT',
  /** Quechua */
  Qu = 'qu',
  /** Romansh */
  Rm = 'rm',
  /** Rundi */
  Rn = 'rn',
  /** Romanian */
  Ro = 'ro',
  /** Moldavian */
  RoMd = 'ro_MD',
  /** Russian */
  Ru = 'ru',
  /** Kinyarwanda */
  Rw = 'rw',
  /** Sanskrit */
  Sa = 'sa',
  /** Sindhi */
  Sd = 'sd',
  /** Northern Sami */
  Se = 'se',
  /** Sango */
  Sg = 'sg',
  /** Sinhala */
  Si = 'si',
  /** Slovak */
  Sk = 'sk',
  /** Slovenian */
  Sl = 'sl',
  /** Samoan */
  Sm = 'sm',
  /** Shona */
  Sn = 'sn',
  /** Somali */
  So = 'so',
  /** Albanian */
  Sq = 'sq',
  /** Serbian */
  Sr = 'sr',
  /** Southern Sotho */
  St = 'st',
  /** Sundanese */
  Su = 'su',
  /** Swedish */
  Sv = 'sv',
  /** Swahili */
  Sw = 'sw',
  /** Congo Swahili */
  SwCd = 'sw_CD',
  /** Tamil */
  Ta = 'ta',
  /** Telugu */
  Te = 'te',
  /** Tajik */
  Tg = 'tg',
  /** Thai */
  Th = 'th',
  /** Tigrinya */
  Ti = 'ti',
  /** Turkmen */
  Tk = 'tk',
  /** Tongan */
  To = 'to',
  /** Turkish */
  Tr = 'tr',
  /** Tatar */
  Tt = 'tt',
  /** Uyghur */
  Ug = 'ug',
  /** Ukrainian */
  Uk = 'uk',
  /** Urdu */
  Ur = 'ur',
  /** Uzbek */
  Uz = 'uz',
  /** Vietnamese */
  Vi = 'vi',
  /** Volapük */
  Vo = 'vo',
  /** Wolof */
  Wo = 'wo',
  /** Xhosa */
  Xh = 'xh',
  /** Yiddish */
  Yi = 'yi',
  /** Yoruba */
  Yo = 'yo',
  /** Chinese */
  Zh = 'zh',
  /** Simplified Chinese */
  ZhHans = 'zh_Hans',
  /** Traditional Chinese */
  ZhHant = 'zh_Hant',
  /** Zulu */
  Zu = 'zu',
}

/** Returned if attempting to set a Channel's defaultLanguageCode to a language which is not enabled in GlobalSettings */
export type LanguageNotAvailableError = ErrorResult & {
  __typename?: 'LanguageNotAvailableError';
  errorCode: ErrorCode;
  languageCode: Scalars['String'];
  message: Scalars['String'];
};

export type LocaleStringCustomFieldConfig = CustomField & {
  __typename?: 'LocaleStringCustomFieldConfig';
  description?: Maybe<Array<LocalizedString>>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<Array<LocalizedString>>;
  length?: Maybe<Scalars['Int']>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  pattern?: Maybe<Scalars['String']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type LocalizedString = {
  __typename?: 'LocalizedString';
  languageCode: LanguageCode;
  value: Scalars['String'];
};

export enum LogicalOperator {
  And = 'AND',
  Or = 'OR',
}

export type ManualPaymentInput = {
  metadata?: InputMaybe<Scalars['JSON']>;
  method: Scalars['String'];
  orderId: Scalars['ID'];
  transactionId?: InputMaybe<Scalars['String']>;
};

/**
 * Returned when a call to addManualPaymentToOrder is made but the Order
 * is not in the required state.
 */
export type ManualPaymentStateError = ErrorResult & {
  __typename?: 'ManualPaymentStateError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type MimeTypeError = ErrorResult & {
  __typename?: 'MimeTypeError';
  errorCode: ErrorCode;
  fileName: Scalars['String'];
  message: Scalars['String'];
  mimeType: Scalars['String'];
};

/** Returned if a PromotionCondition has neither a couponCode nor any conditions set */
export type MissingConditionsError = ErrorResult & {
  __typename?: 'MissingConditionsError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type ModifyOrderInput = {
  addItems?: InputMaybe<Array<AddItemInput>>;
  adjustOrderLines?: InputMaybe<Array<AdjustOrderLineInput>>;
  couponCodes?: InputMaybe<Array<Scalars['String']>>;
  customFields?: InputMaybe<UpdateOrderCustomFieldsInput>;
  dryRun: Scalars['Boolean'];
  note?: InputMaybe<Scalars['String']>;
  options?: InputMaybe<ModifyOrderOptions>;
  orderId: Scalars['ID'];
  refund?: InputMaybe<AdministratorRefundInput>;
  surcharges?: InputMaybe<Array<SurchargeInput>>;
  updateBillingAddress?: InputMaybe<UpdateOrderAddressInput>;
  updateShippingAddress?: InputMaybe<UpdateOrderAddressInput>;
};

export type ModifyOrderOptions = {
  freezePromotions?: InputMaybe<Scalars['Boolean']>;
  recalculateShipping?: InputMaybe<Scalars['Boolean']>;
};

export type ModifyOrderResult =
  | CouponCodeExpiredError
  | CouponCodeInvalidError
  | CouponCodeLimitError
  | InsufficientStockError
  | NegativeQuantityError
  | NoChangesSpecifiedError
  | Order
  | OrderLimitError
  | OrderModificationStateError
  | PaymentMethodMissingError
  | RefundPaymentIdMissingError;

export type MoveCollectionInput = {
  collectionId: Scalars['ID'];
  index: Scalars['Int'];
  parentId: Scalars['ID'];
};

/** Returned if an operation has specified OrderLines from multiple Orders */
export type MultipleOrderError = ErrorResult & {
  __typename?: 'MultipleOrderError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Add Customers to a CustomerGroup */
  addCustomersToGroup: CustomerGroup;
  addFulfillmentToOrder: AddFulfillmentToOrderResult;
  /**
   * Used to manually create a new Payment against an Order.
   * This can be used by an Administrator when an Order is in the ArrangingPayment state.
   *
   * It is also used when a completed Order
   * has been modified (using `modifyOrder`) and the price has increased. The extra payment
   * can then be manually arranged by the administrator, and the details used to create a new
   * Payment.
   */
  addManualPaymentToOrder: AddManualPaymentToOrderResult;
  /** Add members to a Zone */
  addMembersToZone: Zone;
  addNoteToCustomer: Customer;
  addNoteToOrder: Order;
  /** Add an OptionGroup to a Product */
  addOptionGroupToProduct: Product;
  /** Assign assets to channel */
  assignAssetsToChannel: Array<Asset>;
  /** Assigns ProductVariants to the specified Channel */
  assignProductVariantsToChannel: Array<ProductVariant>;
  /** Assigns all ProductVariants of Product to the specified Channel */
  assignProductsToChannel: Array<Product>;
  /** Assigns Promotions to the specified Channel */
  assignPromotionsToChannel: Array<Promotion>;
  /** Assign a Role to an Administrator */
  assignRoleToAdministrator: Administrator;
  /** Authenticates the user using a named authentication strategy */
  authenticate: AuthenticationResult;
  cancelJob: Job;
  cancelOrder: CancelOrderResult;
  cancelPayment: CancelPaymentResult;
  /** Create a new Administrator */
  createAdministrator: Administrator;
  /** Create a new Asset */
  createAssets: Array<CreateAssetResult>;
  /** Create a new Channel */
  createChannel: CreateChannelResult;
  /** Create a new Collection */
  createCollection: Collection;
  /** Create a new Country */
  createCountry: Country;
  /** Create a new Customer. If a password is provided, a new User will also be created an linked to the Customer. */
  createCustomer: CreateCustomerResult;
  /** Create a new Address and associate it with the Customer specified by customerId */
  createCustomerAddress: Address;
  /** Create a new CustomerGroup */
  createCustomerGroup: CustomerGroup;
  /** Create a new Facet */
  createFacet: Facet;
  /** Create one or more FacetValues */
  createFacetValues: Array<FacetValue>;
  /** Create existing PaymentMethod */
  createPaymentMethod: PaymentMethod;
  /** Create a new Product */
  createProduct: Product;
  /** Create a new ProductOption within a ProductOptionGroup */
  createProductOption: ProductOption;
  /** Create a new ProductOptionGroup */
  createProductOptionGroup: ProductOptionGroup;
  /** Create a set of ProductVariants based on the OptionGroups assigned to the given Product */
  createProductVariants: Array<Maybe<ProductVariant>>;
  createPromotion: CreatePromotionResult;
  /** Create a new Role */
  createRole: Role;
  /** Create a new ShippingMethod */
  createShippingMethod: ShippingMethod;
  /** Create a new Tag */
  createTag: Tag;
  /** Create a new TaxCategory */
  createTaxCategory: TaxCategory;
  /** Create a new TaxRate */
  createTaxRate: TaxRate;
  /** Create a new Zone */
  createZone: Zone;
  /** Delete an Administrator */
  deleteAdministrator: DeletionResponse;
  /** Delete an Asset */
  deleteAsset: DeletionResponse;
  /** Delete multiple Assets */
  deleteAssets: DeletionResponse;
  /** Delete a Channel */
  deleteChannel: DeletionResponse;
  /** Delete a Collection and all of its descendants */
  deleteCollection: DeletionResponse;
  /** Delete a Country */
  deleteCountry: DeletionResponse;
  /** Delete a Customer */
  deleteCustomer: DeletionResponse;
  /** Update an existing Address */
  deleteCustomerAddress: Success;
  /** Delete a CustomerGroup */
  deleteCustomerGroup: DeletionResponse;
  deleteCustomerNote: DeletionResponse;
  /** Delete an existing Facet */
  deleteFacet: DeletionResponse;
  /** Delete one or more FacetValues */
  deleteFacetValues: Array<DeletionResponse>;
  deleteOrderNote: DeletionResponse;
  /** Delete a PaymentMethod */
  deletePaymentMethod: DeletionResponse;
  /** Delete a Product */
  deleteProduct: DeletionResponse;
  /** Delete a ProductOption */
  deleteProductOption: DeletionResponse;
  /** Delete a ProductVariant */
  deleteProductVariant: DeletionResponse;
  deletePromotion: DeletionResponse;
  /** Delete an existing Role */
  deleteRole: DeletionResponse;
  /** Delete a ShippingMethod */
  deleteShippingMethod: DeletionResponse;
  /** Delete an existing Tag */
  deleteTag: DeletionResponse;
  /** Deletes a TaxCategory */
  deleteTaxCategory: DeletionResponse;
  /** Delete a TaxRate */
  deleteTaxRate: DeletionResponse;
  /** Delete a Zone */
  deleteZone: DeletionResponse;
  flushBufferedJobs: Success;
  importProducts?: Maybe<ImportInfo>;
  /** Authenticates the user using the native authentication strategy. This mutation is an alias for `authenticate({ native: { ... }})` */
  login: NativeAuthenticationResult;
  logout: Success;
  /**
   * Allows an Order to be modified after it has been completed by the Customer. The Order must first
   * be in the `Modifying` state.
   */
  modifyOrder: ModifyOrderResult;
  /** Move a Collection to a different parent or index */
  moveCollection: Collection;
  refundOrder: RefundOrderResult;
  reindex: Job;
  /** Remove Customers from a CustomerGroup */
  removeCustomersFromGroup: CustomerGroup;
  /** Remove members from a Zone */
  removeMembersFromZone: Zone;
  /** Remove an OptionGroup from a Product */
  removeOptionGroupFromProduct: RemoveOptionGroupFromProductResult;
  /** Removes ProductVariants from the specified Channel */
  removeProductVariantsFromChannel: Array<ProductVariant>;
  /** Removes all ProductVariants of Product from the specified Channel */
  removeProductsFromChannel: Array<Product>;
  /** Removes Promotions from the specified Channel */
  removePromotionsFromChannel: Array<Promotion>;
  /** Remove all settled jobs in the given queues older than the given date. Returns the number of jobs deleted. */
  removeSettledJobs: Scalars['Int'];
  runGoedgepicktFullSync?: Maybe<Scalars['Boolean']>;
  runPendingSearchIndexUpdates: Success;
  setOrderCustomFields?: Maybe<Order>;
  settlePayment: SettlePaymentResult;
  settleRefund: SettleRefundResult;
  transitionFulfillmentToState: TransitionFulfillmentToStateResult;
  transitionOrderToState?: Maybe<TransitionOrderToStateResult>;
  transitionPaymentToState: TransitionPaymentToStateResult;
  /** Update the active (currently logged-in) Administrator */
  updateActiveAdministrator: Administrator;
  /** Update an existing Administrator */
  updateAdministrator: Administrator;
  /** Update an existing Asset */
  updateAsset: Asset;
  /** Update an existing Channel */
  updateChannel: UpdateChannelResult;
  /** Update an existing Collection */
  updateCollection: Collection;
  /** Update an existing Country */
  updateCountry: Country;
  /** Update an existing Customer */
  updateCustomer: UpdateCustomerResult;
  /** Update an existing Address */
  updateCustomerAddress: Address;
  /** Update an existing CustomerGroup */
  updateCustomerGroup: CustomerGroup;
  updateCustomerNote: HistoryEntry;
  updateEBoekhoudenConfig?: Maybe<EBoekhoudenConfig>;
  /** Update an existing Facet */
  updateFacet: Facet;
  /** Update one or more FacetValues */
  updateFacetValues: Array<FacetValue>;
  updateGlobalSettings: UpdateGlobalSettingsResult;
  updateGoedgepicktConfig?: Maybe<GoedgepicktConfigUpdateResult>;
  updateMyparcelConfig?: Maybe<MyparcelConfig>;
  updateOrderNote: HistoryEntry;
  /** Update an existing PaymentMethod */
  updatePaymentMethod: PaymentMethod;
  /** Update an existing Product */
  updateProduct: Product;
  /** Create a new ProductOption within a ProductOptionGroup */
  updateProductOption: ProductOption;
  /** Update an existing ProductOptionGroup */
  updateProductOptionGroup: ProductOptionGroup;
  /** Update existing ProductVariants */
  updateProductVariants: Array<Maybe<ProductVariant>>;
  updatePromotion: UpdatePromotionResult;
  /** Update an existing Role */
  updateRole: Role;
  /** Update an existing ShippingMethod */
  updateShippingMethod: ShippingMethod;
  /** Update an existing Tag */
  updateTag: Tag;
  /** Update an existing TaxCategory */
  updateTaxCategory: TaxCategory;
  /** Update an existing TaxRate */
  updateTaxRate: TaxRate;
  updateWebhook?: Maybe<Scalars['String']>;
  /** Update an existing Zone */
  updateZone: Zone;
  upsertInvoiceConfig: InvoiceConfig;
};

export type MutationAddCustomersToGroupArgs = {
  customerGroupId: Scalars['ID'];
  customerIds: Array<Scalars['ID']>;
};

export type MutationAddFulfillmentToOrderArgs = {
  input: FulfillOrderInput;
};

export type MutationAddManualPaymentToOrderArgs = {
  input: ManualPaymentInput;
};

export type MutationAddMembersToZoneArgs = {
  memberIds: Array<Scalars['ID']>;
  zoneId: Scalars['ID'];
};

export type MutationAddNoteToCustomerArgs = {
  input: AddNoteToCustomerInput;
};

export type MutationAddNoteToOrderArgs = {
  input: AddNoteToOrderInput;
};

export type MutationAddOptionGroupToProductArgs = {
  optionGroupId: Scalars['ID'];
  productId: Scalars['ID'];
};

export type MutationAssignAssetsToChannelArgs = {
  input: AssignAssetsToChannelInput;
};

export type MutationAssignProductVariantsToChannelArgs = {
  input: AssignProductVariantsToChannelInput;
};

export type MutationAssignProductsToChannelArgs = {
  input: AssignProductsToChannelInput;
};

export type MutationAssignPromotionsToChannelArgs = {
  input: AssignPromotionsToChannelInput;
};

export type MutationAssignRoleToAdministratorArgs = {
  administratorId: Scalars['ID'];
  roleId: Scalars['ID'];
};

export type MutationAuthenticateArgs = {
  input: AuthenticationInput;
  rememberMe?: InputMaybe<Scalars['Boolean']>;
};

export type MutationCancelJobArgs = {
  jobId: Scalars['ID'];
};

export type MutationCancelOrderArgs = {
  input: CancelOrderInput;
};

export type MutationCancelPaymentArgs = {
  id: Scalars['ID'];
};

export type MutationCreateAdministratorArgs = {
  input: CreateAdministratorInput;
};

export type MutationCreateAssetsArgs = {
  input: Array<CreateAssetInput>;
};

export type MutationCreateChannelArgs = {
  input: CreateChannelInput;
};

export type MutationCreateCollectionArgs = {
  input: CreateCollectionInput;
};

export type MutationCreateCountryArgs = {
  input: CreateCountryInput;
};

export type MutationCreateCustomerArgs = {
  input: CreateCustomerInput;
  password?: InputMaybe<Scalars['String']>;
};

export type MutationCreateCustomerAddressArgs = {
  customerId: Scalars['ID'];
  input: CreateAddressInput;
};

export type MutationCreateCustomerGroupArgs = {
  input: CreateCustomerGroupInput;
};

export type MutationCreateFacetArgs = {
  input: CreateFacetInput;
};

export type MutationCreateFacetValuesArgs = {
  input: Array<CreateFacetValueInput>;
};

export type MutationCreatePaymentMethodArgs = {
  input: CreatePaymentMethodInput;
};

export type MutationCreateProductArgs = {
  input: CreateProductInput;
};

export type MutationCreateProductOptionArgs = {
  input: CreateProductOptionInput;
};

export type MutationCreateProductOptionGroupArgs = {
  input: CreateProductOptionGroupInput;
};

export type MutationCreateProductVariantsArgs = {
  input: Array<CreateProductVariantInput>;
};

export type MutationCreatePromotionArgs = {
  input: CreatePromotionInput;
};

export type MutationCreateRoleArgs = {
  input: CreateRoleInput;
};

export type MutationCreateShippingMethodArgs = {
  input: CreateShippingMethodInput;
};

export type MutationCreateTagArgs = {
  input: CreateTagInput;
};

export type MutationCreateTaxCategoryArgs = {
  input: CreateTaxCategoryInput;
};

export type MutationCreateTaxRateArgs = {
  input: CreateTaxRateInput;
};

export type MutationCreateZoneArgs = {
  input: CreateZoneInput;
};

export type MutationDeleteAdministratorArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteAssetArgs = {
  input: DeleteAssetInput;
};

export type MutationDeleteAssetsArgs = {
  input: DeleteAssetsInput;
};

export type MutationDeleteChannelArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteCollectionArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteCountryArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteCustomerArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteCustomerAddressArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteCustomerGroupArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteCustomerNoteArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteFacetArgs = {
  force?: InputMaybe<Scalars['Boolean']>;
  id: Scalars['ID'];
};

export type MutationDeleteFacetValuesArgs = {
  force?: InputMaybe<Scalars['Boolean']>;
  ids: Array<Scalars['ID']>;
};

export type MutationDeleteOrderNoteArgs = {
  id: Scalars['ID'];
};

export type MutationDeletePaymentMethodArgs = {
  force?: InputMaybe<Scalars['Boolean']>;
  id: Scalars['ID'];
};

export type MutationDeleteProductArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteProductOptionArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteProductVariantArgs = {
  id: Scalars['ID'];
};

export type MutationDeletePromotionArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteRoleArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteShippingMethodArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteTagArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteTaxCategoryArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteTaxRateArgs = {
  id: Scalars['ID'];
};

export type MutationDeleteZoneArgs = {
  id: Scalars['ID'];
};

export type MutationFlushBufferedJobsArgs = {
  bufferIds?: InputMaybe<Array<Scalars['String']>>;
};

export type MutationImportProductsArgs = {
  csvFile: Scalars['Upload'];
};

export type MutationLoginArgs = {
  password: Scalars['String'];
  rememberMe?: InputMaybe<Scalars['Boolean']>;
  username: Scalars['String'];
};

export type MutationModifyOrderArgs = {
  input: ModifyOrderInput;
};

export type MutationMoveCollectionArgs = {
  input: MoveCollectionInput;
};

export type MutationRefundOrderArgs = {
  input: RefundOrderInput;
};

export type MutationRemoveCustomersFromGroupArgs = {
  customerGroupId: Scalars['ID'];
  customerIds: Array<Scalars['ID']>;
};

export type MutationRemoveMembersFromZoneArgs = {
  memberIds: Array<Scalars['ID']>;
  zoneId: Scalars['ID'];
};

export type MutationRemoveOptionGroupFromProductArgs = {
  optionGroupId: Scalars['ID'];
  productId: Scalars['ID'];
};

export type MutationRemoveProductVariantsFromChannelArgs = {
  input: RemoveProductVariantsFromChannelInput;
};

export type MutationRemoveProductsFromChannelArgs = {
  input: RemoveProductsFromChannelInput;
};

export type MutationRemovePromotionsFromChannelArgs = {
  input: RemovePromotionsFromChannelInput;
};

export type MutationRemoveSettledJobsArgs = {
  olderThan?: InputMaybe<Scalars['DateTime']>;
  queueNames?: InputMaybe<Array<Scalars['String']>>;
};

export type MutationSetOrderCustomFieldsArgs = {
  input: UpdateOrderInput;
};

export type MutationSettlePaymentArgs = {
  id: Scalars['ID'];
};

export type MutationSettleRefundArgs = {
  input: SettleRefundInput;
};

export type MutationTransitionFulfillmentToStateArgs = {
  id: Scalars['ID'];
  state: Scalars['String'];
};

export type MutationTransitionOrderToStateArgs = {
  id: Scalars['ID'];
  state: Scalars['String'];
};

export type MutationTransitionPaymentToStateArgs = {
  id: Scalars['ID'];
  state: Scalars['String'];
};

export type MutationUpdateActiveAdministratorArgs = {
  input: UpdateActiveAdministratorInput;
};

export type MutationUpdateAdministratorArgs = {
  input: UpdateAdministratorInput;
};

export type MutationUpdateAssetArgs = {
  input: UpdateAssetInput;
};

export type MutationUpdateChannelArgs = {
  input: UpdateChannelInput;
};

export type MutationUpdateCollectionArgs = {
  input: UpdateCollectionInput;
};

export type MutationUpdateCountryArgs = {
  input: UpdateCountryInput;
};

export type MutationUpdateCustomerArgs = {
  input: UpdateCustomerInput;
};

export type MutationUpdateCustomerAddressArgs = {
  input: UpdateAddressInput;
};

export type MutationUpdateCustomerGroupArgs = {
  input: UpdateCustomerGroupInput;
};

export type MutationUpdateCustomerNoteArgs = {
  input: UpdateCustomerNoteInput;
};

export type MutationUpdateEBoekhoudenConfigArgs = {
  input: EBoekhoudenConfigInput;
};

export type MutationUpdateFacetArgs = {
  input: UpdateFacetInput;
};

export type MutationUpdateFacetValuesArgs = {
  input: Array<UpdateFacetValueInput>;
};

export type MutationUpdateGlobalSettingsArgs = {
  input: UpdateGlobalSettingsInput;
};

export type MutationUpdateGoedgepicktConfigArgs = {
  input: GoedgepicktConfigInput;
};

export type MutationUpdateMyparcelConfigArgs = {
  input: MyparcelConfigInput;
};

export type MutationUpdateOrderNoteArgs = {
  input: UpdateOrderNoteInput;
};

export type MutationUpdatePaymentMethodArgs = {
  input: UpdatePaymentMethodInput;
};

export type MutationUpdateProductArgs = {
  input: UpdateProductInput;
};

export type MutationUpdateProductOptionArgs = {
  input: UpdateProductOptionInput;
};

export type MutationUpdateProductOptionGroupArgs = {
  input: UpdateProductOptionGroupInput;
};

export type MutationUpdateProductVariantsArgs = {
  input: Array<UpdateProductVariantInput>;
};

export type MutationUpdatePromotionArgs = {
  input: UpdatePromotionInput;
};

export type MutationUpdateRoleArgs = {
  input: UpdateRoleInput;
};

export type MutationUpdateShippingMethodArgs = {
  input: UpdateShippingMethodInput;
};

export type MutationUpdateTagArgs = {
  input: UpdateTagInput;
};

export type MutationUpdateTaxCategoryArgs = {
  input: UpdateTaxCategoryInput;
};

export type MutationUpdateTaxRateArgs = {
  input: UpdateTaxRateInput;
};

export type MutationUpdateWebhookArgs = {
  url: Scalars['String'];
};

export type MutationUpdateZoneArgs = {
  input: UpdateZoneInput;
};

export type MutationUpsertInvoiceConfigArgs = {
  input?: InputMaybe<InvoiceConfigInput>;
};

export type MyparcelConfig = {
  __typename?: 'MyparcelConfig';
  apiKey?: Maybe<Scalars['String']>;
};

export type MyparcelConfigInput = {
  apiKey?: InputMaybe<Scalars['String']>;
};

export type NativeAuthInput = {
  password: Scalars['String'];
  username: Scalars['String'];
};

/** Returned when attempting an operation that relies on the NativeAuthStrategy, if that strategy is not configured. */
export type NativeAuthStrategyError = ErrorResult & {
  __typename?: 'NativeAuthStrategyError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type NativeAuthenticationResult =
  | CurrentUser
  | InvalidCredentialsError
  | NativeAuthStrategyError;

/** Returned when attempting to set a negative OrderLine quantity. */
export type NegativeQuantityError = ErrorResult & {
  __typename?: 'NegativeQuantityError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned when a call to modifyOrder fails to specify any changes */
export type NoChangesSpecifiedError = ErrorResult & {
  __typename?: 'NoChangesSpecifiedError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type Node = {
  id: Scalars['ID'];
};

/** Returned if an attempting to refund an Order but neither items nor shipping refund was specified */
export type NothingToRefundError = ErrorResult & {
  __typename?: 'NothingToRefundError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Operators for filtering on a list of Number fields */
export type NumberListOperators = {
  inList: Scalars['Float'];
};

/** Operators for filtering on a Int or Float field */
export type NumberOperators = {
  between?: InputMaybe<NumberRange>;
  eq?: InputMaybe<Scalars['Float']>;
  gt?: InputMaybe<Scalars['Float']>;
  gte?: InputMaybe<Scalars['Float']>;
  lt?: InputMaybe<Scalars['Float']>;
  lte?: InputMaybe<Scalars['Float']>;
};

export type NumberRange = {
  end: Scalars['Float'];
  start: Scalars['Float'];
};

export type Order = Node & {
  __typename?: 'Order';
  /** An order is active as long as the payment process has not been completed */
  active: Scalars['Boolean'];
  billingAddress?: Maybe<OrderAddress>;
  /** A unique code for the Order */
  code: Scalars['String'];
  /** An array of all coupon codes applied to the Order */
  couponCodes: Array<Scalars['String']>;
  createdAt: Scalars['DateTime'];
  currencyCode: CurrencyCode;
  customFields?: Maybe<OrderCustomFields>;
  customer?: Maybe<Customer>;
  discounts: Array<Discount>;
  fulfillments?: Maybe<Array<Fulfillment>>;
  history: HistoryEntryList;
  id: Scalars['ID'];
  lines: Array<OrderLine>;
  modifications: Array<OrderModification>;
  nextStates: Array<Scalars['String']>;
  /**
   * The date & time that the Order was placed, i.e. the Customer
   * completed the checkout and the Order is no longer "active"
   */
  orderPlacedAt?: Maybe<Scalars['DateTime']>;
  payments?: Maybe<Array<Payment>>;
  /** Promotions applied to the order. Only gets populated after the payment process has completed. */
  promotions: Array<Promotion>;
  shipping: Scalars['Int'];
  shippingAddress?: Maybe<OrderAddress>;
  shippingLines: Array<ShippingLine>;
  shippingWithTax: Scalars['Int'];
  state: Scalars['String'];
  /**
   * The subTotal is the total of all OrderLines in the Order. This figure also includes any Order-level
   * discounts which have been prorated (proportionally distributed) amongst the OrderItems.
   * To get a total of all OrderLines which does not account for prorated discounts, use the
   * sum of `OrderLine.discountedLinePrice` values.
   */
  subTotal: Scalars['Int'];
  /** Same as subTotal, but inclusive of tax */
  subTotalWithTax: Scalars['Int'];
  /**
   * Surcharges are arbitrary modifications to the Order total which are neither
   * ProductVariants nor discounts resulting from applied Promotions. For example,
   * one-off discounts based on customer interaction, or surcharges based on payment
   * methods.
   */
  surcharges: Array<Surcharge>;
  /** A summary of the taxes being applied to this Order */
  taxSummary: Array<OrderTaxSummary>;
  /** Equal to subTotal plus shipping */
  total: Scalars['Int'];
  totalQuantity: Scalars['Int'];
  /** The final payable amount. Equal to subTotalWithTax plus shippingWithTax */
  totalWithTax: Scalars['Int'];
  updatedAt: Scalars['DateTime'];
};

export type OrderHistoryArgs = {
  options?: InputMaybe<HistoryEntryListOptions>;
};

export type OrderAddress = {
  __typename?: 'OrderAddress';
  city?: Maybe<Scalars['String']>;
  company?: Maybe<Scalars['String']>;
  country?: Maybe<Scalars['String']>;
  countryCode?: Maybe<Scalars['String']>;
  customFields?: Maybe<Scalars['JSON']>;
  fullName?: Maybe<Scalars['String']>;
  phoneNumber?: Maybe<Scalars['String']>;
  postalCode?: Maybe<Scalars['String']>;
  province?: Maybe<Scalars['String']>;
  streetLine1?: Maybe<Scalars['String']>;
  streetLine2?: Maybe<Scalars['String']>;
};

export type OrderCustomFields = {
  __typename?: 'OrderCustomFields';
  pickupLocationCarrier?: Maybe<Scalars['String']>;
  pickupLocationCity?: Maybe<Scalars['String']>;
  pickupLocationCountry?: Maybe<Scalars['String']>;
  pickupLocationHouseNumber?: Maybe<Scalars['String']>;
  pickupLocationName?: Maybe<Scalars['String']>;
  pickupLocationNumber?: Maybe<Scalars['String']>;
  pickupLocationStreet?: Maybe<Scalars['String']>;
  pickupLocationZipcode?: Maybe<Scalars['String']>;
};

export type OrderFilterParameter = {
  active?: InputMaybe<BooleanOperators>;
  code?: InputMaybe<StringOperators>;
  createdAt?: InputMaybe<DateOperators>;
  currencyCode?: InputMaybe<StringOperators>;
  customerLastName?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  orderPlacedAt?: InputMaybe<DateOperators>;
  pickupLocationCarrier?: InputMaybe<StringOperators>;
  pickupLocationCity?: InputMaybe<StringOperators>;
  pickupLocationCountry?: InputMaybe<StringOperators>;
  pickupLocationHouseNumber?: InputMaybe<StringOperators>;
  pickupLocationName?: InputMaybe<StringOperators>;
  pickupLocationNumber?: InputMaybe<StringOperators>;
  pickupLocationStreet?: InputMaybe<StringOperators>;
  pickupLocationZipcode?: InputMaybe<StringOperators>;
  shipping?: InputMaybe<NumberOperators>;
  shippingWithTax?: InputMaybe<NumberOperators>;
  state?: InputMaybe<StringOperators>;
  subTotal?: InputMaybe<NumberOperators>;
  subTotalWithTax?: InputMaybe<NumberOperators>;
  total?: InputMaybe<NumberOperators>;
  totalQuantity?: InputMaybe<NumberOperators>;
  totalWithTax?: InputMaybe<NumberOperators>;
  transactionId?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type OrderItem = Node & {
  __typename?: 'OrderItem';
  adjustments: Array<Adjustment>;
  cancelled: Scalars['Boolean'];
  createdAt: Scalars['DateTime'];
  /**
   * The price of a single unit including discounts, excluding tax.
   *
   * If Order-level discounts have been applied, this will not be the
   * actual taxable unit price (see `proratedUnitPrice`), but is generally the
   * correct price to display to customers to avoid confusion
   * about the internal handling of distributed Order-level discounts.
   */
  discountedUnitPrice: Scalars['Int'];
  /** The price of a single unit including discounts and tax */
  discountedUnitPriceWithTax: Scalars['Int'];
  fulfillment?: Maybe<Fulfillment>;
  id: Scalars['ID'];
  /**
   * The actual unit price, taking into account both item discounts _and_ prorated (proportionally-distributed)
   * Order-level discounts. This value is the true economic value of the OrderItem, and is used in tax
   * and refund calculations.
   */
  proratedUnitPrice: Scalars['Int'];
  /** The proratedUnitPrice including tax */
  proratedUnitPriceWithTax: Scalars['Int'];
  refundId?: Maybe<Scalars['ID']>;
  taxLines: Array<TaxLine>;
  taxRate: Scalars['Float'];
  /** The price of a single unit, excluding tax and discounts */
  unitPrice: Scalars['Int'];
  /** The price of a single unit, including tax but excluding discounts */
  unitPriceWithTax: Scalars['Int'];
  unitTax: Scalars['Int'];
  updatedAt: Scalars['DateTime'];
};

/** Returned when the maximum order size limit has been reached. */
export type OrderLimitError = ErrorResult & {
  __typename?: 'OrderLimitError';
  errorCode: ErrorCode;
  maxItems: Scalars['Int'];
  message: Scalars['String'];
};

export type OrderLine = Node & {
  __typename?: 'OrderLine';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  /** The price of the line including discounts, excluding tax */
  discountedLinePrice: Scalars['Int'];
  /** The price of the line including discounts and tax */
  discountedLinePriceWithTax: Scalars['Int'];
  /**
   * The price of a single unit including discounts, excluding tax.
   *
   * If Order-level discounts have been applied, this will not be the
   * actual taxable unit price (see `proratedUnitPrice`), but is generally the
   * correct price to display to customers to avoid confusion
   * about the internal handling of distributed Order-level discounts.
   */
  discountedUnitPrice: Scalars['Int'];
  /** The price of a single unit including discounts and tax */
  discountedUnitPriceWithTax: Scalars['Int'];
  discounts: Array<Discount>;
  featuredAsset?: Maybe<Asset>;
  fulfillments?: Maybe<Array<Fulfillment>>;
  id: Scalars['ID'];
  items: Array<OrderItem>;
  /** The total price of the line excluding tax and discounts. */
  linePrice: Scalars['Int'];
  /** The total price of the line including tax but excluding discounts. */
  linePriceWithTax: Scalars['Int'];
  /** The total tax on this line */
  lineTax: Scalars['Int'];
  order: Order;
  productVariant: ProductVariant;
  /**
   * The actual line price, taking into account both item discounts _and_ prorated (proportionally-distributed)
   * Order-level discounts. This value is the true economic value of the OrderLine, and is used in tax
   * and refund calculations.
   */
  proratedLinePrice: Scalars['Int'];
  /** The proratedLinePrice including tax */
  proratedLinePriceWithTax: Scalars['Int'];
  /**
   * The actual unit price, taking into account both item discounts _and_ prorated (proportionally-distributed)
   * Order-level discounts. This value is the true economic value of the OrderItem, and is used in tax
   * and refund calculations.
   */
  proratedUnitPrice: Scalars['Int'];
  /** The proratedUnitPrice including tax */
  proratedUnitPriceWithTax: Scalars['Int'];
  quantity: Scalars['Int'];
  taxLines: Array<TaxLine>;
  taxRate: Scalars['Float'];
  /** The price of a single unit, excluding tax and discounts */
  unitPrice: Scalars['Int'];
  /** Non-zero if the unitPrice has changed since it was initially added to Order */
  unitPriceChangeSinceAdded: Scalars['Int'];
  /** The price of a single unit, including tax but excluding discounts */
  unitPriceWithTax: Scalars['Int'];
  /** Non-zero if the unitPriceWithTax has changed since it was initially added to Order */
  unitPriceWithTaxChangeSinceAdded: Scalars['Int'];
  updatedAt: Scalars['DateTime'];
};

export type OrderLineInput = {
  orderLineId: Scalars['ID'];
  quantity: Scalars['Int'];
};

export type OrderList = PaginatedList & {
  __typename?: 'OrderList';
  items: Array<Order>;
  totalItems: Scalars['Int'];
};

export type OrderListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<OrderFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<OrderSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type OrderModification = Node & {
  __typename?: 'OrderModification';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  isSettled: Scalars['Boolean'];
  note: Scalars['String'];
  orderItems?: Maybe<Array<OrderItem>>;
  payment?: Maybe<Payment>;
  priceChange: Scalars['Int'];
  refund?: Maybe<Refund>;
  surcharges?: Maybe<Array<Surcharge>>;
  updatedAt: Scalars['DateTime'];
};

/** Returned when attempting to modify the contents of an Order that is not in the `Modifying` state. */
export type OrderModificationStateError = ErrorResult & {
  __typename?: 'OrderModificationStateError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type OrderProcessState = {
  __typename?: 'OrderProcessState';
  name: Scalars['String'];
  to: Array<Scalars['String']>;
};

export type OrderSortParameter = {
  code?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  customerLastName?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  orderPlacedAt?: InputMaybe<SortOrder>;
  pickupLocationCarrier?: InputMaybe<SortOrder>;
  pickupLocationCity?: InputMaybe<SortOrder>;
  pickupLocationCountry?: InputMaybe<SortOrder>;
  pickupLocationHouseNumber?: InputMaybe<SortOrder>;
  pickupLocationName?: InputMaybe<SortOrder>;
  pickupLocationNumber?: InputMaybe<SortOrder>;
  pickupLocationStreet?: InputMaybe<SortOrder>;
  pickupLocationZipcode?: InputMaybe<SortOrder>;
  shipping?: InputMaybe<SortOrder>;
  shippingWithTax?: InputMaybe<SortOrder>;
  state?: InputMaybe<SortOrder>;
  subTotal?: InputMaybe<SortOrder>;
  subTotalWithTax?: InputMaybe<SortOrder>;
  total?: InputMaybe<SortOrder>;
  totalQuantity?: InputMaybe<SortOrder>;
  totalWithTax?: InputMaybe<SortOrder>;
  transactionId?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

/** Returned if there is an error in transitioning the Order state */
export type OrderStateTransitionError = ErrorResult & {
  __typename?: 'OrderStateTransitionError';
  errorCode: ErrorCode;
  fromState: Scalars['String'];
  message: Scalars['String'];
  toState: Scalars['String'];
  transitionError: Scalars['String'];
};

/**
 * A summary of the taxes being applied to this order, grouped
 * by taxRate.
 */
export type OrderTaxSummary = {
  __typename?: 'OrderTaxSummary';
  /** A description of this tax */
  description: Scalars['String'];
  /** The total net price or OrderItems to which this taxRate applies */
  taxBase: Scalars['Int'];
  /** The taxRate as a percentage */
  taxRate: Scalars['Float'];
  /** The total tax being applied to the Order at this taxRate */
  taxTotal: Scalars['Int'];
};

export type PaginatedList = {
  items: Array<Node>;
  totalItems: Scalars['Int'];
};

export type Payment = Node & {
  __typename?: 'Payment';
  amount: Scalars['Int'];
  createdAt: Scalars['DateTime'];
  errorMessage?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  metadata?: Maybe<Scalars['JSON']>;
  method: Scalars['String'];
  nextStates: Array<Scalars['String']>;
  refunds: Array<Refund>;
  state: Scalars['String'];
  transactionId?: Maybe<Scalars['String']>;
  updatedAt: Scalars['DateTime'];
};

export type PaymentMethod = Node & {
  __typename?: 'PaymentMethod';
  checker?: Maybe<ConfigurableOperation>;
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  enabled: Scalars['Boolean'];
  handler: ConfigurableOperation;
  id: Scalars['ID'];
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type PaymentMethodFilterParameter = {
  code?: InputMaybe<StringOperators>;
  createdAt?: InputMaybe<DateOperators>;
  description?: InputMaybe<StringOperators>;
  enabled?: InputMaybe<BooleanOperators>;
  id?: InputMaybe<IdOperators>;
  name?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type PaymentMethodList = PaginatedList & {
  __typename?: 'PaymentMethodList';
  items: Array<PaymentMethod>;
  totalItems: Scalars['Int'];
};

export type PaymentMethodListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<PaymentMethodFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<PaymentMethodSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

/**
 * Returned when a call to modifyOrder fails to include a paymentMethod even
 * though the price has increased as a result of the changes.
 */
export type PaymentMethodMissingError = ErrorResult & {
  __typename?: 'PaymentMethodMissingError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type PaymentMethodQuote = {
  __typename?: 'PaymentMethodQuote';
  code: Scalars['String'];
  customFields?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  eligibilityMessage?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  isEligible: Scalars['Boolean'];
  name: Scalars['String'];
};

export type PaymentMethodSortParameter = {
  code?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  description?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

/** Returned if an attempting to refund a Payment against OrderLines from a different Order */
export type PaymentOrderMismatchError = ErrorResult & {
  __typename?: 'PaymentOrderMismatchError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned when there is an error in transitioning the Payment state */
export type PaymentStateTransitionError = ErrorResult & {
  __typename?: 'PaymentStateTransitionError';
  errorCode: ErrorCode;
  fromState: Scalars['String'];
  message: Scalars['String'];
  toState: Scalars['String'];
  transitionError: Scalars['String'];
};

/**
 * @description
 * Permissions for administrators and customers. Used to control access to
 * GraphQL resolvers via the {@link Allow} decorator.
 *
 * ## Understanding Permission.Owner
 *
 * `Permission.Owner` is a special permission which is used in some of the Vendure resolvers to indicate that that resolver should only
 * be accessible to the "owner" of that resource.
 *
 * For example, the Shop API `activeCustomer` query resolver should only return the Customer object for the "owner" of that Customer, i.e.
 * based on the activeUserId of the current session. As a result, the resolver code looks like this:
 *
 * @example
 * ```TypeScript
 * \@Query()
 * \@Allow(Permission.Owner)
 * async activeCustomer(\@Ctx() ctx: RequestContext): Promise<Customer | undefined> {
 *   const userId = ctx.activeUserId;
 *   if (userId) {
 *     return this.customerService.findOneByUserId(ctx, userId);
 *   }
 * }
 * ```
 *
 * Here we can see that the "ownership" must be enforced by custom logic inside the resolver. Since "ownership" cannot be defined generally
 * nor statically encoded at build-time, any resolvers using `Permission.Owner` **must** include logic to enforce that only the owner
 * of the resource has access. If not, then it is the equivalent of using `Permission.Public`.
 *
 *
 * @docsCategory common
 */
export enum Permission {
  /** Allow this user to enable invoice generation */
  AllowInvoicesPermission = 'AllowInvoicesPermission',
  /** Authenticated means simply that the user is logged in */
  Authenticated = 'Authenticated',
  /** Grants permission to create Administrator */
  CreateAdministrator = 'CreateAdministrator',
  /** Grants permission to create Asset */
  CreateAsset = 'CreateAsset',
  /** Grants permission to create Products, Facets, Assets, Collections */
  CreateCatalog = 'CreateCatalog',
  /** Grants permission to create Channel */
  CreateChannel = 'CreateChannel',
  /** Grants permission to create Collection */
  CreateCollection = 'CreateCollection',
  /** Grants permission to create Country */
  CreateCountry = 'CreateCountry',
  /** Grants permission to create Customer */
  CreateCustomer = 'CreateCustomer',
  /** Grants permission to create CustomerGroup */
  CreateCustomerGroup = 'CreateCustomerGroup',
  /** Grants permission to create Facet */
  CreateFacet = 'CreateFacet',
  /** Grants permission to create Order */
  CreateOrder = 'CreateOrder',
  /** Grants permission to create PaymentMethod */
  CreatePaymentMethod = 'CreatePaymentMethod',
  /** Grants permission to create Product */
  CreateProduct = 'CreateProduct',
  /** Grants permission to create Promotion */
  CreatePromotion = 'CreatePromotion',
  /** Grants permission to create PaymentMethods, ShippingMethods, TaxCategories, TaxRates, Zones, Countries, System & GlobalSettings */
  CreateSettings = 'CreateSettings',
  /** Grants permission to create ShippingMethod */
  CreateShippingMethod = 'CreateShippingMethod',
  /** Grants permission to create System */
  CreateSystem = 'CreateSystem',
  /** Grants permission to create Tag */
  CreateTag = 'CreateTag',
  /** Grants permission to create TaxCategory */
  CreateTaxCategory = 'CreateTaxCategory',
  /** Grants permission to create TaxRate */
  CreateTaxRate = 'CreateTaxRate',
  /** Grants permission to create Zone */
  CreateZone = 'CreateZone',
  /** Grants permission to delete Administrator */
  DeleteAdministrator = 'DeleteAdministrator',
  /** Grants permission to delete Asset */
  DeleteAsset = 'DeleteAsset',
  /** Grants permission to delete Products, Facets, Assets, Collections */
  DeleteCatalog = 'DeleteCatalog',
  /** Grants permission to delete Channel */
  DeleteChannel = 'DeleteChannel',
  /** Grants permission to delete Collection */
  DeleteCollection = 'DeleteCollection',
  /** Grants permission to delete Country */
  DeleteCountry = 'DeleteCountry',
  /** Grants permission to delete Customer */
  DeleteCustomer = 'DeleteCustomer',
  /** Grants permission to delete CustomerGroup */
  DeleteCustomerGroup = 'DeleteCustomerGroup',
  /** Grants permission to delete Facet */
  DeleteFacet = 'DeleteFacet',
  /** Grants permission to delete Order */
  DeleteOrder = 'DeleteOrder',
  /** Grants permission to delete PaymentMethod */
  DeletePaymentMethod = 'DeletePaymentMethod',
  /** Grants permission to delete Product */
  DeleteProduct = 'DeleteProduct',
  /** Grants permission to delete Promotion */
  DeletePromotion = 'DeletePromotion',
  /** Grants permission to delete PaymentMethods, ShippingMethods, TaxCategories, TaxRates, Zones, Countries, System & GlobalSettings */
  DeleteSettings = 'DeleteSettings',
  /** Grants permission to delete ShippingMethod */
  DeleteShippingMethod = 'DeleteShippingMethod',
  /** Grants permission to delete System */
  DeleteSystem = 'DeleteSystem',
  /** Grants permission to delete Tag */
  DeleteTag = 'DeleteTag',
  /** Grants permission to delete TaxCategory */
  DeleteTaxCategory = 'DeleteTaxCategory',
  /** Grants permission to delete TaxRate */
  DeleteTaxRate = 'DeleteTaxRate',
  /** Grants permission to delete Zone */
  DeleteZone = 'DeleteZone',
  /** Allows administrator to export orders */
  ExportOrders = 'ExportOrders',
  /** Owner means the user owns this entity, e.g. a Customer's own Order */
  Owner = 'Owner',
  /** Public means any unauthenticated user may perform the operation */
  Public = 'Public',
  /** Grants permission to read Administrator */
  ReadAdministrator = 'ReadAdministrator',
  /** Grants permission to read Asset */
  ReadAsset = 'ReadAsset',
  /** Grants permission to read Products, Facets, Assets, Collections */
  ReadCatalog = 'ReadCatalog',
  /** Grants permission to read Channel */
  ReadChannel = 'ReadChannel',
  /** Grants permission to read Collection */
  ReadCollection = 'ReadCollection',
  /** Grants permission to read Country */
  ReadCountry = 'ReadCountry',
  /** Grants permission to read Customer */
  ReadCustomer = 'ReadCustomer',
  /** Grants permission to read CustomerGroup */
  ReadCustomerGroup = 'ReadCustomerGroup',
  /** Grants permission to read Facet */
  ReadFacet = 'ReadFacet',
  /** Grants permission to read Order */
  ReadOrder = 'ReadOrder',
  /** Grants permission to read PaymentMethod */
  ReadPaymentMethod = 'ReadPaymentMethod',
  /** Grants permission to read Product */
  ReadProduct = 'ReadProduct',
  /** Grants permission to read Promotion */
  ReadPromotion = 'ReadPromotion',
  /** Grants permission to read PaymentMethods, ShippingMethods, TaxCategories, TaxRates, Zones, Countries, System & GlobalSettings */
  ReadSettings = 'ReadSettings',
  /** Grants permission to read ShippingMethod */
  ReadShippingMethod = 'ReadShippingMethod',
  /** Grants permission to read System */
  ReadSystem = 'ReadSystem',
  /** Grants permission to read Tag */
  ReadTag = 'ReadTag',
  /** Grants permission to read TaxCategory */
  ReadTaxCategory = 'ReadTaxCategory',
  /** Grants permission to read TaxRate */
  ReadTaxRate = 'ReadTaxRate',
  /** Grants permission to read Zone */
  ReadZone = 'ReadZone',
  /** Allows setting Goedgepickt configurations */
  SetGoedgepicktConfig = 'SetGoedgepicktConfig',
  /** Allows setting MyParcel configurations */
  SetMyparcelConfig = 'SetMyparcelConfig',
  /** Allows setting a webhook URL */
  SetWebhook = 'SetWebhook',
  /** SuperAdmin has unrestricted access to all operations */
  SuperAdmin = 'SuperAdmin',
  /** Grants permission to update Administrator */
  UpdateAdministrator = 'UpdateAdministrator',
  /** Grants permission to update Asset */
  UpdateAsset = 'UpdateAsset',
  /** Grants permission to update Products, Facets, Assets, Collections */
  UpdateCatalog = 'UpdateCatalog',
  /** Grants permission to update Channel */
  UpdateChannel = 'UpdateChannel',
  /** Grants permission to update Collection */
  UpdateCollection = 'UpdateCollection',
  /** Grants permission to update Country */
  UpdateCountry = 'UpdateCountry',
  /** Grants permission to update Customer */
  UpdateCustomer = 'UpdateCustomer',
  /** Grants permission to update CustomerGroup */
  UpdateCustomerGroup = 'UpdateCustomerGroup',
  /** Grants permission to update Facet */
  UpdateFacet = 'UpdateFacet',
  /** Grants permission to update GlobalSettings */
  UpdateGlobalSettings = 'UpdateGlobalSettings',
  /** Grants permission to update Order */
  UpdateOrder = 'UpdateOrder',
  /** Grants permission to update PaymentMethod */
  UpdatePaymentMethod = 'UpdatePaymentMethod',
  /** Grants permission to update Product */
  UpdateProduct = 'UpdateProduct',
  /** Grants permission to update Promotion */
  UpdatePromotion = 'UpdatePromotion',
  /** Grants permission to update PaymentMethods, ShippingMethods, TaxCategories, TaxRates, Zones, Countries, System & GlobalSettings */
  UpdateSettings = 'UpdateSettings',
  /** Grants permission to update ShippingMethod */
  UpdateShippingMethod = 'UpdateShippingMethod',
  /** Grants permission to update System */
  UpdateSystem = 'UpdateSystem',
  /** Grants permission to update Tag */
  UpdateTag = 'UpdateTag',
  /** Grants permission to update TaxCategory */
  UpdateTaxCategory = 'UpdateTaxCategory',
  /** Grants permission to update TaxRate */
  UpdateTaxRate = 'UpdateTaxRate',
  /** Grants permission to update Zone */
  UpdateZone = 'UpdateZone',
  /** Allows enabling e-Boekhouden plugin */
  EBoekhouden = 'eBoekhouden',
}

export type PermissionDefinition = {
  __typename?: 'PermissionDefinition';
  assignable: Scalars['Boolean'];
  description: Scalars['String'];
  name: Scalars['String'];
};

export type PreviewCollectionVariantsInput = {
  filters: Array<ConfigurableOperationInput>;
  parentId?: InputMaybe<Scalars['ID']>;
};

/** The price range where the result has more than one price */
export type PriceRange = {
  __typename?: 'PriceRange';
  max: Scalars['Int'];
  min: Scalars['Int'];
};

export type Product = Node & {
  __typename?: 'Product';
  assets: Array<Asset>;
  channels: Array<Channel>;
  collections: Array<Collection>;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<ProductCustomFields>;
  description: Scalars['String'];
  enabled: Scalars['Boolean'];
  facetValues: Array<FacetValue>;
  featuredAsset?: Maybe<Asset>;
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  optionGroups: Array<ProductOptionGroup>;
  slug: Scalars['String'];
  translations: Array<ProductTranslation>;
  updatedAt: Scalars['DateTime'];
  /** Returns a paginated, sortable, filterable list of ProductVariants */
  variantList: ProductVariantList;
  /** Returns all ProductVariants */
  variants: Array<ProductVariant>;
};

export type ProductVariantListArgs = {
  options?: InputMaybe<ProductVariantListOptions>;
};

export type ProductCustomFields = {
  __typename?: 'ProductCustomFields';
  keywords?: Maybe<Scalars['String']>;
  metaDescription?: Maybe<Scalars['String']>;
  metaTitle?: Maybe<Scalars['String']>;
};

export type ProductFilterParameter = {
  createdAt?: InputMaybe<DateOperators>;
  description?: InputMaybe<StringOperators>;
  enabled?: InputMaybe<BooleanOperators>;
  id?: InputMaybe<IdOperators>;
  keywords?: InputMaybe<StringOperators>;
  languageCode?: InputMaybe<StringOperators>;
  metaDescription?: InputMaybe<StringOperators>;
  metaTitle?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  slug?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type ProductList = PaginatedList & {
  __typename?: 'ProductList';
  items: Array<Product>;
  totalItems: Scalars['Int'];
};

export type ProductListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<ProductFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<ProductSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type ProductOption = Node & {
  __typename?: 'ProductOption';
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  group: ProductOptionGroup;
  groupId: Scalars['ID'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  translations: Array<ProductOptionTranslation>;
  updatedAt: Scalars['DateTime'];
};

export type ProductOptionGroup = Node & {
  __typename?: 'ProductOptionGroup';
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  options: Array<ProductOption>;
  translations: Array<ProductOptionGroupTranslation>;
  updatedAt: Scalars['DateTime'];
};

export type ProductOptionGroupTranslation = {
  __typename?: 'ProductOptionGroupTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type ProductOptionGroupTranslationInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  id?: InputMaybe<Scalars['ID']>;
  languageCode: LanguageCode;
  name?: InputMaybe<Scalars['String']>;
};

export type ProductOptionInUseError = ErrorResult & {
  __typename?: 'ProductOptionInUseError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  optionGroupCode: Scalars['String'];
  productVariantCount: Scalars['Int'];
};

export type ProductOptionTranslation = {
  __typename?: 'ProductOptionTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type ProductOptionTranslationInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  id?: InputMaybe<Scalars['ID']>;
  languageCode: LanguageCode;
  name?: InputMaybe<Scalars['String']>;
};

export type ProductSortParameter = {
  createdAt?: InputMaybe<SortOrder>;
  description?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  keywords?: InputMaybe<SortOrder>;
  metaDescription?: InputMaybe<SortOrder>;
  metaTitle?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  slug?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type ProductTranslation = {
  __typename?: 'ProductTranslation';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<ProductTranslationCustomFields>;
  description: Scalars['String'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  slug: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type ProductTranslationCustomFields = {
  __typename?: 'ProductTranslationCustomFields';
  keywords?: Maybe<Scalars['String']>;
  metaDescription?: Maybe<Scalars['String']>;
  metaTitle?: Maybe<Scalars['String']>;
};

export type ProductTranslationInput = {
  customFields?: InputMaybe<ProductTranslationInputCustomFields>;
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['ID']>;
  languageCode: LanguageCode;
  name?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
};

export type ProductTranslationInputCustomFields = {
  keywords?: InputMaybe<Scalars['String']>;
  metaDescription?: InputMaybe<Scalars['String']>;
  metaTitle?: InputMaybe<Scalars['String']>;
};

export type ProductVariant = Node & {
  __typename?: 'ProductVariant';
  assets: Array<Asset>;
  channels: Array<Channel>;
  createdAt: Scalars['DateTime'];
  currencyCode: CurrencyCode;
  customFields?: Maybe<Scalars['JSON']>;
  enabled: Scalars['Boolean'];
  facetValues: Array<FacetValue>;
  featuredAsset?: Maybe<Asset>;
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  options: Array<ProductOption>;
  outOfStockThreshold: Scalars['Int'];
  price: Scalars['Int'];
  priceWithTax: Scalars['Int'];
  product: Product;
  productId: Scalars['ID'];
  sku: Scalars['String'];
  stockAllocated: Scalars['Int'];
  stockLevel: Scalars['String'];
  stockMovements: StockMovementList;
  stockOnHand: Scalars['Int'];
  taxCategory: TaxCategory;
  taxRateApplied: TaxRate;
  trackInventory: GlobalFlag;
  translations: Array<ProductVariantTranslation>;
  updatedAt: Scalars['DateTime'];
  useGlobalOutOfStockThreshold: Scalars['Boolean'];
};

export type ProductVariantStockMovementsArgs = {
  options?: InputMaybe<StockMovementListOptions>;
};

export type ProductVariantFilterParameter = {
  createdAt?: InputMaybe<DateOperators>;
  currencyCode?: InputMaybe<StringOperators>;
  enabled?: InputMaybe<BooleanOperators>;
  id?: InputMaybe<IdOperators>;
  languageCode?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  outOfStockThreshold?: InputMaybe<NumberOperators>;
  price?: InputMaybe<NumberOperators>;
  priceWithTax?: InputMaybe<NumberOperators>;
  productId?: InputMaybe<IdOperators>;
  sku?: InputMaybe<StringOperators>;
  stockAllocated?: InputMaybe<NumberOperators>;
  stockLevel?: InputMaybe<StringOperators>;
  stockOnHand?: InputMaybe<NumberOperators>;
  trackInventory?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
  useGlobalOutOfStockThreshold?: InputMaybe<BooleanOperators>;
};

export type ProductVariantList = PaginatedList & {
  __typename?: 'ProductVariantList';
  items: Array<ProductVariant>;
  totalItems: Scalars['Int'];
};

export type ProductVariantListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<ProductVariantFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<ProductVariantSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type ProductVariantSortParameter = {
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  outOfStockThreshold?: InputMaybe<SortOrder>;
  price?: InputMaybe<SortOrder>;
  priceWithTax?: InputMaybe<SortOrder>;
  productId?: InputMaybe<SortOrder>;
  sku?: InputMaybe<SortOrder>;
  stockAllocated?: InputMaybe<SortOrder>;
  stockLevel?: InputMaybe<SortOrder>;
  stockOnHand?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type ProductVariantTranslation = {
  __typename?: 'ProductVariantTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type ProductVariantTranslationInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  id?: InputMaybe<Scalars['ID']>;
  languageCode: LanguageCode;
  name?: InputMaybe<Scalars['String']>;
};

export type Promotion = Node & {
  __typename?: 'Promotion';
  actions: Array<ConfigurableOperation>;
  conditions: Array<ConfigurableOperation>;
  couponCode?: Maybe<Scalars['String']>;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  enabled: Scalars['Boolean'];
  endsAt?: Maybe<Scalars['DateTime']>;
  id: Scalars['ID'];
  name: Scalars['String'];
  perCustomerUsageLimit?: Maybe<Scalars['Int']>;
  startsAt?: Maybe<Scalars['DateTime']>;
  updatedAt: Scalars['DateTime'];
};

export type PromotionFilterParameter = {
  couponCode?: InputMaybe<StringOperators>;
  createdAt?: InputMaybe<DateOperators>;
  enabled?: InputMaybe<BooleanOperators>;
  endsAt?: InputMaybe<DateOperators>;
  id?: InputMaybe<IdOperators>;
  name?: InputMaybe<StringOperators>;
  perCustomerUsageLimit?: InputMaybe<NumberOperators>;
  startsAt?: InputMaybe<DateOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type PromotionList = PaginatedList & {
  __typename?: 'PromotionList';
  items: Array<Promotion>;
  totalItems: Scalars['Int'];
};

export type PromotionListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<PromotionFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<PromotionSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type PromotionSortParameter = {
  couponCode?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  endsAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  perCustomerUsageLimit?: InputMaybe<SortOrder>;
  startsAt?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

/** Returned if the specified quantity of an OrderLine is greater than the number of items in that line */
export type QuantityTooGreatError = ErrorResult & {
  __typename?: 'QuantityTooGreatError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type Query = {
  __typename?: 'Query';
  activeAdministrator?: Maybe<Administrator>;
  activeChannel: Channel;
  administrator?: Maybe<Administrator>;
  administrators: AdministratorList;
  /** Get a single Asset by id */
  asset?: Maybe<Asset>;
  /** Get a list of Assets */
  assets: AssetList;
  availableOrderExportStrategies: Array<Scalars['String']>;
  channel?: Maybe<Channel>;
  channels: Array<Channel>;
  /** Get a Collection either by id or slug. If neither id nor slug is specified, an error will result. */
  collection?: Maybe<Collection>;
  collectionFilters: Array<ConfigurableOperationDefinition>;
  collections: CollectionList;
  countries: CountryList;
  country?: Maybe<Country>;
  customer?: Maybe<Customer>;
  customerGroup?: Maybe<CustomerGroup>;
  customerGroups: CustomerGroupList;
  customers: CustomerList;
  eBoekhoudenConfig?: Maybe<EBoekhoudenConfig>;
  facet?: Maybe<Facet>;
  facets: FacetList;
  fulfillmentHandlers: Array<ConfigurableOperationDefinition>;
  globalSettings: GlobalSettings;
  goedgepicktConfig?: Maybe<GoedgepicktConfig>;
  invoiceConfig?: Maybe<InvoiceConfig>;
  /** Get paginated invoices */
  invoices: InvoiceList;
  job?: Maybe<Job>;
  jobBufferSize: Array<JobBufferSize>;
  jobQueues: Array<JobQueue>;
  jobs: JobList;
  jobsById: Array<Job>;
  me?: Maybe<CurrentUser>;
  myparcelConfig?: Maybe<MyparcelConfig>;
  order?: Maybe<Order>;
  orders: OrderList;
  paymentMethod?: Maybe<PaymentMethod>;
  paymentMethodEligibilityCheckers: Array<ConfigurableOperationDefinition>;
  paymentMethodHandlers: Array<ConfigurableOperationDefinition>;
  paymentMethods: PaymentMethodList;
  pendingSearchIndexUpdates: Scalars['Int'];
  /** Used for real-time previews of the contents of a Collection */
  previewCollectionVariants: ProductVariantList;
  /** Get a Product either by id or slug. If neither id nor slug is specified, an error will result. */
  product?: Maybe<Product>;
  productOptionGroup?: Maybe<ProductOptionGroup>;
  productOptionGroups: Array<ProductOptionGroup>;
  /** Get a ProductVariant by id */
  productVariant?: Maybe<ProductVariant>;
  /** List ProductVariants either all or for the specific product. */
  productVariants: ProductVariantList;
  /** List Products */
  products: ProductList;
  promotion?: Maybe<Promotion>;
  promotionActions: Array<ConfigurableOperationDefinition>;
  promotionConditions: Array<ConfigurableOperationDefinition>;
  promotions: PromotionList;
  role?: Maybe<Role>;
  roles: RoleList;
  search: SearchResponse;
  shippingCalculators: Array<ConfigurableOperationDefinition>;
  shippingEligibilityCheckers: Array<ConfigurableOperationDefinition>;
  shippingMethod?: Maybe<ShippingMethod>;
  shippingMethods: ShippingMethodList;
  tag: Tag;
  tags: TagList;
  taxCategories: Array<TaxCategory>;
  taxCategory?: Maybe<TaxCategory>;
  taxRate?: Maybe<TaxRate>;
  taxRates: TaxRateList;
  testEligibleShippingMethods: Array<ShippingMethodQuote>;
  testShippingMethod: TestShippingMethodResult;
  webhook?: Maybe<Scalars['String']>;
  zone?: Maybe<Zone>;
  zones: Array<Zone>;
};

export type QueryAdministratorArgs = {
  id: Scalars['ID'];
};

export type QueryAdministratorsArgs = {
  options?: InputMaybe<AdministratorListOptions>;
};

export type QueryAssetArgs = {
  id: Scalars['ID'];
};

export type QueryAssetsArgs = {
  options?: InputMaybe<AssetListOptions>;
};

export type QueryChannelArgs = {
  id: Scalars['ID'];
};

export type QueryCollectionArgs = {
  id?: InputMaybe<Scalars['ID']>;
  slug?: InputMaybe<Scalars['String']>;
};

export type QueryCollectionsArgs = {
  options?: InputMaybe<CollectionListOptions>;
};

export type QueryCountriesArgs = {
  options?: InputMaybe<CountryListOptions>;
};

export type QueryCountryArgs = {
  id: Scalars['ID'];
};

export type QueryCustomerArgs = {
  id: Scalars['ID'];
};

export type QueryCustomerGroupArgs = {
  id: Scalars['ID'];
};

export type QueryCustomerGroupsArgs = {
  options?: InputMaybe<CustomerGroupListOptions>;
};

export type QueryCustomersArgs = {
  options?: InputMaybe<CustomerListOptions>;
};

export type QueryFacetArgs = {
  id: Scalars['ID'];
};

export type QueryFacetsArgs = {
  options?: InputMaybe<FacetListOptions>;
};

export type QueryInvoicesArgs = {
  input?: InputMaybe<InvoicesListInput>;
};

export type QueryJobArgs = {
  jobId: Scalars['ID'];
};

export type QueryJobBufferSizeArgs = {
  bufferIds?: InputMaybe<Array<Scalars['String']>>;
};

export type QueryJobsArgs = {
  options?: InputMaybe<JobListOptions>;
};

export type QueryJobsByIdArgs = {
  jobIds: Array<Scalars['ID']>;
};

export type QueryOrderArgs = {
  id: Scalars['ID'];
};

export type QueryOrdersArgs = {
  options?: InputMaybe<OrderListOptions>;
};

export type QueryPaymentMethodArgs = {
  id: Scalars['ID'];
};

export type QueryPaymentMethodsArgs = {
  options?: InputMaybe<PaymentMethodListOptions>;
};

export type QueryPreviewCollectionVariantsArgs = {
  input: PreviewCollectionVariantsInput;
  options?: InputMaybe<ProductVariantListOptions>;
};

export type QueryProductArgs = {
  id?: InputMaybe<Scalars['ID']>;
  slug?: InputMaybe<Scalars['String']>;
};

export type QueryProductOptionGroupArgs = {
  id: Scalars['ID'];
};

export type QueryProductOptionGroupsArgs = {
  filterTerm?: InputMaybe<Scalars['String']>;
};

export type QueryProductVariantArgs = {
  id: Scalars['ID'];
};

export type QueryProductVariantsArgs = {
  options?: InputMaybe<ProductVariantListOptions>;
  productId?: InputMaybe<Scalars['ID']>;
};

export type QueryProductsArgs = {
  options?: InputMaybe<ProductListOptions>;
};

export type QueryPromotionArgs = {
  id: Scalars['ID'];
};

export type QueryPromotionsArgs = {
  options?: InputMaybe<PromotionListOptions>;
};

export type QueryRoleArgs = {
  id: Scalars['ID'];
};

export type QueryRolesArgs = {
  options?: InputMaybe<RoleListOptions>;
};

export type QuerySearchArgs = {
  input: SearchInput;
};

export type QueryShippingMethodArgs = {
  id: Scalars['ID'];
};

export type QueryShippingMethodsArgs = {
  options?: InputMaybe<ShippingMethodListOptions>;
};

export type QueryTagArgs = {
  id: Scalars['ID'];
};

export type QueryTagsArgs = {
  options?: InputMaybe<TagListOptions>;
};

export type QueryTaxCategoryArgs = {
  id: Scalars['ID'];
};

export type QueryTaxRateArgs = {
  id: Scalars['ID'];
};

export type QueryTaxRatesArgs = {
  options?: InputMaybe<TaxRateListOptions>;
};

export type QueryTestEligibleShippingMethodsArgs = {
  input: TestEligibleShippingMethodsInput;
};

export type QueryTestShippingMethodArgs = {
  input: TestShippingMethodInput;
};

export type QueryZoneArgs = {
  id: Scalars['ID'];
};

export type Refund = Node & {
  __typename?: 'Refund';
  adjustment: Scalars['Int'];
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  items: Scalars['Int'];
  metadata?: Maybe<Scalars['JSON']>;
  method?: Maybe<Scalars['String']>;
  orderItems: Array<OrderItem>;
  paymentId: Scalars['ID'];
  reason?: Maybe<Scalars['String']>;
  shipping: Scalars['Int'];
  state: Scalars['String'];
  total: Scalars['Int'];
  transactionId?: Maybe<Scalars['String']>;
  updatedAt: Scalars['DateTime'];
};

export type RefundOrderInput = {
  adjustment: Scalars['Int'];
  lines: Array<OrderLineInput>;
  paymentId: Scalars['ID'];
  reason?: InputMaybe<Scalars['String']>;
  shipping: Scalars['Int'];
};

export type RefundOrderResult =
  | AlreadyRefundedError
  | MultipleOrderError
  | NothingToRefundError
  | OrderStateTransitionError
  | PaymentOrderMismatchError
  | QuantityTooGreatError
  | Refund
  | RefundOrderStateError
  | RefundStateTransitionError;

/** Returned if an attempting to refund an Order which is not in the expected state */
export type RefundOrderStateError = ErrorResult & {
  __typename?: 'RefundOrderStateError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  orderState: Scalars['String'];
};

/**
 * Returned when a call to modifyOrder fails to include a refundPaymentId even
 * though the price has decreased as a result of the changes.
 */
export type RefundPaymentIdMissingError = ErrorResult & {
  __typename?: 'RefundPaymentIdMissingError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned when there is an error in transitioning the Refund state */
export type RefundStateTransitionError = ErrorResult & {
  __typename?: 'RefundStateTransitionError';
  errorCode: ErrorCode;
  fromState: Scalars['String'];
  message: Scalars['String'];
  toState: Scalars['String'];
  transitionError: Scalars['String'];
};

export type RelationCustomFieldConfig = CustomField & {
  __typename?: 'RelationCustomFieldConfig';
  description?: Maybe<Array<LocalizedString>>;
  entity: Scalars['String'];
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<Array<LocalizedString>>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  scalarFields: Array<Scalars['String']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type Release = Node &
  StockMovement & {
    __typename?: 'Release';
    createdAt: Scalars['DateTime'];
    id: Scalars['ID'];
    orderItem: OrderItem;
    productVariant: ProductVariant;
    quantity: Scalars['Int'];
    type: StockMovementType;
    updatedAt: Scalars['DateTime'];
  };

export type RemoveOptionGroupFromProductResult =
  | Product
  | ProductOptionInUseError;

export type RemoveProductVariantsFromChannelInput = {
  channelId: Scalars['ID'];
  productVariantIds: Array<Scalars['ID']>;
};

export type RemoveProductsFromChannelInput = {
  channelId: Scalars['ID'];
  productIds: Array<Scalars['ID']>;
};

export type RemovePromotionsFromChannelInput = {
  channelId: Scalars['ID'];
  promotionIds: Array<Scalars['ID']>;
};

export type Return = Node &
  StockMovement & {
    __typename?: 'Return';
    createdAt: Scalars['DateTime'];
    id: Scalars['ID'];
    orderItem: OrderItem;
    productVariant: ProductVariant;
    quantity: Scalars['Int'];
    type: StockMovementType;
    updatedAt: Scalars['DateTime'];
  };

export type Role = Node & {
  __typename?: 'Role';
  channels: Array<Channel>;
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  permissions: Array<Permission>;
  updatedAt: Scalars['DateTime'];
};

export type RoleFilterParameter = {
  code?: InputMaybe<StringOperators>;
  createdAt?: InputMaybe<DateOperators>;
  description?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type RoleList = PaginatedList & {
  __typename?: 'RoleList';
  items: Array<Role>;
  totalItems: Scalars['Int'];
};

export type RoleListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<RoleFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<RoleSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type RoleSortParameter = {
  code?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  description?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type Sale = Node &
  StockMovement & {
    __typename?: 'Sale';
    createdAt: Scalars['DateTime'];
    id: Scalars['ID'];
    orderItem: OrderItem;
    productVariant: ProductVariant;
    quantity: Scalars['Int'];
    type: StockMovementType;
    updatedAt: Scalars['DateTime'];
  };

export type SearchInput = {
  collectionId?: InputMaybe<Scalars['ID']>;
  collectionSlug?: InputMaybe<Scalars['String']>;
  facetValueFilters?: InputMaybe<Array<FacetValueFilterInput>>;
  facetValueIds?: InputMaybe<Array<Scalars['ID']>>;
  facetValueOperator?: InputMaybe<LogicalOperator>;
  groupByProduct?: InputMaybe<Scalars['Boolean']>;
  skip?: InputMaybe<Scalars['Int']>;
  sort?: InputMaybe<SearchResultSortParameter>;
  take?: InputMaybe<Scalars['Int']>;
  term?: InputMaybe<Scalars['String']>;
};

export type SearchReindexResponse = {
  __typename?: 'SearchReindexResponse';
  success: Scalars['Boolean'];
};

export type SearchResponse = {
  __typename?: 'SearchResponse';
  collections: Array<CollectionResult>;
  facetValues: Array<FacetValueResult>;
  items: Array<SearchResult>;
  totalItems: Scalars['Int'];
};

export type SearchResult = {
  __typename?: 'SearchResult';
  /** An array of ids of the Channels in which this result appears */
  channelIds: Array<Scalars['ID']>;
  /** An array of ids of the Collections in which this result appears */
  collectionIds: Array<Scalars['ID']>;
  currencyCode: CurrencyCode;
  description: Scalars['String'];
  enabled: Scalars['Boolean'];
  facetIds: Array<Scalars['ID']>;
  facetValueIds: Array<Scalars['ID']>;
  price: SearchResultPrice;
  priceWithTax: SearchResultPrice;
  productAsset?: Maybe<SearchResultAsset>;
  productId: Scalars['ID'];
  productName: Scalars['String'];
  productVariantAsset?: Maybe<SearchResultAsset>;
  productVariantId: Scalars['ID'];
  productVariantName: Scalars['String'];
  /** A relevance score for the result. Differs between database implementations */
  score: Scalars['Float'];
  sku: Scalars['String'];
  slug: Scalars['String'];
};

export type SearchResultAsset = {
  __typename?: 'SearchResultAsset';
  focalPoint?: Maybe<Coordinate>;
  id: Scalars['ID'];
  preview: Scalars['String'];
};

/** The price of a search result product, either as a range or as a single price */
export type SearchResultPrice = PriceRange | SinglePrice;

export type SearchResultSortParameter = {
  name?: InputMaybe<SortOrder>;
  price?: InputMaybe<SortOrder>;
};

export type ServerConfig = {
  __typename?: 'ServerConfig';
  customFieldConfig: CustomFields;
  orderProcess: Array<OrderProcessState>;
  permissions: Array<PermissionDefinition>;
  permittedAssetTypes: Array<Scalars['String']>;
};

/** Returned if the Payment settlement fails */
export type SettlePaymentError = ErrorResult & {
  __typename?: 'SettlePaymentError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  paymentErrorMessage: Scalars['String'];
};

export type SettlePaymentResult =
  | OrderStateTransitionError
  | Payment
  | PaymentStateTransitionError
  | SettlePaymentError;

export type SettleRefundInput = {
  id: Scalars['ID'];
  transactionId: Scalars['String'];
};

export type SettleRefundResult = Refund | RefundStateTransitionError;

export type ShippingLine = {
  __typename?: 'ShippingLine';
  discountedPrice: Scalars['Int'];
  discountedPriceWithTax: Scalars['Int'];
  discounts: Array<Discount>;
  price: Scalars['Int'];
  priceWithTax: Scalars['Int'];
  shippingMethod: ShippingMethod;
};

export type ShippingMethod = Node & {
  __typename?: 'ShippingMethod';
  calculator: ConfigurableOperation;
  checker: ConfigurableOperation;
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  fulfillmentHandlerCode: Scalars['String'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  translations: Array<ShippingMethodTranslation>;
  updatedAt: Scalars['DateTime'];
};

export type ShippingMethodFilterParameter = {
  code?: InputMaybe<StringOperators>;
  createdAt?: InputMaybe<DateOperators>;
  description?: InputMaybe<StringOperators>;
  fulfillmentHandlerCode?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  languageCode?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
};

export type ShippingMethodList = PaginatedList & {
  __typename?: 'ShippingMethodList';
  items: Array<ShippingMethod>;
  totalItems: Scalars['Int'];
};

export type ShippingMethodListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<ShippingMethodFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<ShippingMethodSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type ShippingMethodQuote = {
  __typename?: 'ShippingMethodQuote';
  code: Scalars['String'];
  customFields?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  id: Scalars['ID'];
  /** Any optional metadata returned by the ShippingCalculator in the ShippingCalculationResult */
  metadata?: Maybe<Scalars['JSON']>;
  name: Scalars['String'];
  price: Scalars['Int'];
  priceWithTax: Scalars['Int'];
};

export type ShippingMethodSortParameter = {
  code?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  description?: InputMaybe<SortOrder>;
  fulfillmentHandlerCode?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type ShippingMethodTranslation = {
  __typename?: 'ShippingMethodTranslation';
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type ShippingMethodTranslationInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['ID']>;
  languageCode: LanguageCode;
  name?: InputMaybe<Scalars['String']>;
};

/** The price value where the result has a single price */
export type SinglePrice = {
  __typename?: 'SinglePrice';
  value: Scalars['Int'];
};

export enum SortOrder {
  Asc = 'ASC',
  Desc = 'DESC',
}

export type StockAdjustment = Node &
  StockMovement & {
    __typename?: 'StockAdjustment';
    createdAt: Scalars['DateTime'];
    id: Scalars['ID'];
    productVariant: ProductVariant;
    quantity: Scalars['Int'];
    type: StockMovementType;
    updatedAt: Scalars['DateTime'];
  };

export type StockMovement = {
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  productVariant: ProductVariant;
  quantity: Scalars['Int'];
  type: StockMovementType;
  updatedAt: Scalars['DateTime'];
};

export type StockMovementItem =
  | Allocation
  | Cancellation
  | Release
  | Return
  | Sale
  | StockAdjustment;

export type StockMovementList = {
  __typename?: 'StockMovementList';
  items: Array<StockMovementItem>;
  totalItems: Scalars['Int'];
};

export type StockMovementListOptions = {
  skip?: InputMaybe<Scalars['Int']>;
  take?: InputMaybe<Scalars['Int']>;
  type?: InputMaybe<StockMovementType>;
};

export enum StockMovementType {
  Adjustment = 'ADJUSTMENT',
  Allocation = 'ALLOCATION',
  Cancellation = 'CANCELLATION',
  Release = 'RELEASE',
  Return = 'RETURN',
  Sale = 'SALE',
}

export type StringCustomFieldConfig = CustomField & {
  __typename?: 'StringCustomFieldConfig';
  description?: Maybe<Array<LocalizedString>>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<Array<LocalizedString>>;
  length?: Maybe<Scalars['Int']>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  options?: Maybe<Array<StringFieldOption>>;
  pattern?: Maybe<Scalars['String']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type StringFieldOption = {
  __typename?: 'StringFieldOption';
  label?: Maybe<Array<LocalizedString>>;
  value: Scalars['String'];
};

/** Operators for filtering on a list of String fields */
export type StringListOperators = {
  inList: Scalars['String'];
};

/** Operators for filtering on a String field */
export type StringOperators = {
  contains?: InputMaybe<Scalars['String']>;
  eq?: InputMaybe<Scalars['String']>;
  in?: InputMaybe<Array<Scalars['String']>>;
  notContains?: InputMaybe<Scalars['String']>;
  notEq?: InputMaybe<Scalars['String']>;
  notIn?: InputMaybe<Array<Scalars['String']>>;
  regex?: InputMaybe<Scalars['String']>;
};

/** Indicates that an operation succeeded, where we do not want to return any more specific information. */
export type Success = {
  __typename?: 'Success';
  success: Scalars['Boolean'];
};

export type Surcharge = Node & {
  __typename?: 'Surcharge';
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  price: Scalars['Int'];
  priceWithTax: Scalars['Int'];
  sku?: Maybe<Scalars['String']>;
  taxLines: Array<TaxLine>;
  taxRate: Scalars['Float'];
  updatedAt: Scalars['DateTime'];
};

export type SurchargeInput = {
  description: Scalars['String'];
  price: Scalars['Int'];
  priceIncludesTax: Scalars['Boolean'];
  sku?: InputMaybe<Scalars['String']>;
  taxDescription?: InputMaybe<Scalars['String']>;
  taxRate?: InputMaybe<Scalars['Float']>;
};

export type Tag = Node & {
  __typename?: 'Tag';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  updatedAt: Scalars['DateTime'];
  value: Scalars['String'];
};

export type TagFilterParameter = {
  createdAt?: InputMaybe<DateOperators>;
  id?: InputMaybe<IdOperators>;
  updatedAt?: InputMaybe<DateOperators>;
  value?: InputMaybe<StringOperators>;
};

export type TagList = PaginatedList & {
  __typename?: 'TagList';
  items: Array<Tag>;
  totalItems: Scalars['Int'];
};

export type TagListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<TagFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<TagSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type TagSortParameter = {
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
  value?: InputMaybe<SortOrder>;
};

export type TaxCategory = Node & {
  __typename?: 'TaxCategory';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  isDefault: Scalars['Boolean'];
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type TaxLine = {
  __typename?: 'TaxLine';
  description: Scalars['String'];
  taxRate: Scalars['Float'];
};

export type TaxRate = Node & {
  __typename?: 'TaxRate';
  category: TaxCategory;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  customerGroup?: Maybe<CustomerGroup>;
  enabled: Scalars['Boolean'];
  id: Scalars['ID'];
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
  value: Scalars['Float'];
  zone: Zone;
};

export type TaxRateFilterParameter = {
  createdAt?: InputMaybe<DateOperators>;
  enabled?: InputMaybe<BooleanOperators>;
  id?: InputMaybe<IdOperators>;
  name?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
  value?: InputMaybe<NumberOperators>;
};

export type TaxRateList = PaginatedList & {
  __typename?: 'TaxRateList';
  items: Array<TaxRate>;
  totalItems: Scalars['Int'];
};

export type TaxRateListOptions = {
  /** Allows the results to be filtered */
  filter?: InputMaybe<TaxRateFilterParameter>;
  /** Specifies whether multiple "filter" arguments should be combines with a logical AND or OR operation. Defaults to AND. */
  filterOperator?: InputMaybe<LogicalOperator>;
  /** Skips the first n results, for use in pagination */
  skip?: InputMaybe<Scalars['Int']>;
  /** Specifies which properties to sort the results by */
  sort?: InputMaybe<TaxRateSortParameter>;
  /** Takes n results, for use in pagination */
  take?: InputMaybe<Scalars['Int']>;
};

export type TaxRateSortParameter = {
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
  value?: InputMaybe<SortOrder>;
};

export type TestEligibleShippingMethodsInput = {
  lines: Array<TestShippingMethodOrderLineInput>;
  shippingAddress: CreateAddressInput;
};

export type TestShippingMethodInput = {
  calculator: ConfigurableOperationInput;
  checker: ConfigurableOperationInput;
  lines: Array<TestShippingMethodOrderLineInput>;
  shippingAddress: CreateAddressInput;
};

export type TestShippingMethodOrderLineInput = {
  productVariantId: Scalars['ID'];
  quantity: Scalars['Int'];
};

export type TestShippingMethodQuote = {
  __typename?: 'TestShippingMethodQuote';
  metadata?: Maybe<Scalars['JSON']>;
  price: Scalars['Int'];
  priceWithTax: Scalars['Int'];
};

export type TestShippingMethodResult = {
  __typename?: 'TestShippingMethodResult';
  eligible: Scalars['Boolean'];
  quote?: Maybe<TestShippingMethodQuote>;
};

export type TextCustomFieldConfig = CustomField & {
  __typename?: 'TextCustomFieldConfig';
  description?: Maybe<Array<LocalizedString>>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<Array<LocalizedString>>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type TransitionFulfillmentToStateResult =
  | Fulfillment
  | FulfillmentStateTransitionError;

export type TransitionOrderToStateResult = Order | OrderStateTransitionError;

export type TransitionPaymentToStateResult =
  | Payment
  | PaymentStateTransitionError;

export type UpdateActiveAdministratorInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  emailAddress?: InputMaybe<Scalars['String']>;
  firstName?: InputMaybe<Scalars['String']>;
  lastName?: InputMaybe<Scalars['String']>;
  password?: InputMaybe<Scalars['String']>;
};

export type UpdateAddressInput = {
  city?: InputMaybe<Scalars['String']>;
  company?: InputMaybe<Scalars['String']>;
  countryCode?: InputMaybe<Scalars['String']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  defaultBillingAddress?: InputMaybe<Scalars['Boolean']>;
  defaultShippingAddress?: InputMaybe<Scalars['Boolean']>;
  fullName?: InputMaybe<Scalars['String']>;
  id: Scalars['ID'];
  phoneNumber?: InputMaybe<Scalars['String']>;
  postalCode?: InputMaybe<Scalars['String']>;
  province?: InputMaybe<Scalars['String']>;
  streetLine1?: InputMaybe<Scalars['String']>;
  streetLine2?: InputMaybe<Scalars['String']>;
};

export type UpdateAdministratorInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  emailAddress?: InputMaybe<Scalars['String']>;
  firstName?: InputMaybe<Scalars['String']>;
  id: Scalars['ID'];
  lastName?: InputMaybe<Scalars['String']>;
  password?: InputMaybe<Scalars['String']>;
  roleIds?: InputMaybe<Array<Scalars['ID']>>;
};

export type UpdateAssetInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  focalPoint?: InputMaybe<CoordinateInput>;
  id: Scalars['ID'];
  name?: InputMaybe<Scalars['String']>;
  tags?: InputMaybe<Array<Scalars['String']>>;
};

export type UpdateChannelInput = {
  code?: InputMaybe<Scalars['String']>;
  currencyCode?: InputMaybe<CurrencyCode>;
  customFields?: InputMaybe<Scalars['JSON']>;
  defaultLanguageCode?: InputMaybe<LanguageCode>;
  defaultShippingZoneId?: InputMaybe<Scalars['ID']>;
  defaultTaxZoneId?: InputMaybe<Scalars['ID']>;
  id: Scalars['ID'];
  pricesIncludeTax?: InputMaybe<Scalars['Boolean']>;
  token?: InputMaybe<Scalars['String']>;
};

export type UpdateChannelResult = Channel | LanguageNotAvailableError;

export type UpdateCollectionInput = {
  assetIds?: InputMaybe<Array<Scalars['ID']>>;
  customFields?: InputMaybe<Scalars['JSON']>;
  featuredAssetId?: InputMaybe<Scalars['ID']>;
  filters?: InputMaybe<Array<ConfigurableOperationInput>>;
  id: Scalars['ID'];
  isPrivate?: InputMaybe<Scalars['Boolean']>;
  parentId?: InputMaybe<Scalars['ID']>;
  translations?: InputMaybe<Array<UpdateCollectionTranslationInput>>;
};

export type UpdateCollectionTranslationInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['ID']>;
  languageCode: LanguageCode;
  name?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
};

export type UpdateCountryInput = {
  code?: InputMaybe<Scalars['String']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  id: Scalars['ID'];
  translations?: InputMaybe<Array<CountryTranslationInput>>;
};

export type UpdateCustomerGroupInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  id: Scalars['ID'];
  name?: InputMaybe<Scalars['String']>;
};

export type UpdateCustomerInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  emailAddress?: InputMaybe<Scalars['String']>;
  firstName?: InputMaybe<Scalars['String']>;
  id: Scalars['ID'];
  lastName?: InputMaybe<Scalars['String']>;
  phoneNumber?: InputMaybe<Scalars['String']>;
  title?: InputMaybe<Scalars['String']>;
};

export type UpdateCustomerNoteInput = {
  note: Scalars['String'];
  noteId: Scalars['ID'];
};

export type UpdateCustomerResult = Customer | EmailAddressConflictError;

export type UpdateFacetInput = {
  code?: InputMaybe<Scalars['String']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  id: Scalars['ID'];
  isPrivate?: InputMaybe<Scalars['Boolean']>;
  translations?: InputMaybe<Array<FacetTranslationInput>>;
};

export type UpdateFacetValueInput = {
  code?: InputMaybe<Scalars['String']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  id: Scalars['ID'];
  translations?: InputMaybe<Array<FacetValueTranslationInput>>;
};

export type UpdateGlobalSettingsInput = {
  availableLanguages?: InputMaybe<Array<LanguageCode>>;
  customFields?: InputMaybe<Scalars['JSON']>;
  outOfStockThreshold?: InputMaybe<Scalars['Int']>;
  trackInventory?: InputMaybe<Scalars['Boolean']>;
};

export type UpdateGlobalSettingsResult =
  | ChannelDefaultLanguageError
  | GlobalSettings;

export type UpdateOrderAddressInput = {
  city?: InputMaybe<Scalars['String']>;
  company?: InputMaybe<Scalars['String']>;
  countryCode?: InputMaybe<Scalars['String']>;
  fullName?: InputMaybe<Scalars['String']>;
  phoneNumber?: InputMaybe<Scalars['String']>;
  postalCode?: InputMaybe<Scalars['String']>;
  province?: InputMaybe<Scalars['String']>;
  streetLine1?: InputMaybe<Scalars['String']>;
  streetLine2?: InputMaybe<Scalars['String']>;
};

export type UpdateOrderCustomFieldsInput = {
  pickupLocationCarrier?: InputMaybe<Scalars['String']>;
  pickupLocationCity?: InputMaybe<Scalars['String']>;
  pickupLocationCountry?: InputMaybe<Scalars['String']>;
  pickupLocationHouseNumber?: InputMaybe<Scalars['String']>;
  pickupLocationName?: InputMaybe<Scalars['String']>;
  pickupLocationNumber?: InputMaybe<Scalars['String']>;
  pickupLocationStreet?: InputMaybe<Scalars['String']>;
  pickupLocationZipcode?: InputMaybe<Scalars['String']>;
};

export type UpdateOrderInput = {
  customFields?: InputMaybe<UpdateOrderCustomFieldsInput>;
  id: Scalars['ID'];
};

export type UpdateOrderNoteInput = {
  isPublic?: InputMaybe<Scalars['Boolean']>;
  note?: InputMaybe<Scalars['String']>;
  noteId: Scalars['ID'];
};

export type UpdatePaymentMethodInput = {
  checker?: InputMaybe<ConfigurableOperationInput>;
  code?: InputMaybe<Scalars['String']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  description?: InputMaybe<Scalars['String']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  handler?: InputMaybe<ConfigurableOperationInput>;
  id: Scalars['ID'];
  name?: InputMaybe<Scalars['String']>;
};

export type UpdateProductInput = {
  assetIds?: InputMaybe<Array<Scalars['ID']>>;
  customFields?: InputMaybe<Scalars['JSON']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  facetValueIds?: InputMaybe<Array<Scalars['ID']>>;
  featuredAssetId?: InputMaybe<Scalars['ID']>;
  id: Scalars['ID'];
  translations?: InputMaybe<Array<ProductTranslationInput>>;
};

export type UpdateProductOptionGroupInput = {
  code?: InputMaybe<Scalars['String']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  id: Scalars['ID'];
  translations?: InputMaybe<Array<ProductOptionGroupTranslationInput>>;
};

export type UpdateProductOptionInput = {
  code?: InputMaybe<Scalars['String']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  id: Scalars['ID'];
  translations?: InputMaybe<Array<ProductOptionGroupTranslationInput>>;
};

export type UpdateProductVariantInput = {
  assetIds?: InputMaybe<Array<Scalars['ID']>>;
  customFields?: InputMaybe<Scalars['JSON']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  facetValueIds?: InputMaybe<Array<Scalars['ID']>>;
  featuredAssetId?: InputMaybe<Scalars['ID']>;
  id: Scalars['ID'];
  outOfStockThreshold?: InputMaybe<Scalars['Int']>;
  price?: InputMaybe<Scalars['Int']>;
  sku?: InputMaybe<Scalars['String']>;
  stockOnHand?: InputMaybe<Scalars['Int']>;
  taxCategoryId?: InputMaybe<Scalars['ID']>;
  trackInventory?: InputMaybe<GlobalFlag>;
  translations?: InputMaybe<Array<ProductVariantTranslationInput>>;
  useGlobalOutOfStockThreshold?: InputMaybe<Scalars['Boolean']>;
};

export type UpdatePromotionInput = {
  actions?: InputMaybe<Array<ConfigurableOperationInput>>;
  conditions?: InputMaybe<Array<ConfigurableOperationInput>>;
  couponCode?: InputMaybe<Scalars['String']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  endsAt?: InputMaybe<Scalars['DateTime']>;
  id: Scalars['ID'];
  name?: InputMaybe<Scalars['String']>;
  perCustomerUsageLimit?: InputMaybe<Scalars['Int']>;
  startsAt?: InputMaybe<Scalars['DateTime']>;
};

export type UpdatePromotionResult = MissingConditionsError | Promotion;

export type UpdateRoleInput = {
  channelIds?: InputMaybe<Array<Scalars['ID']>>;
  code?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  id: Scalars['ID'];
  permissions?: InputMaybe<Array<Permission>>;
};

export type UpdateShippingMethodInput = {
  calculator?: InputMaybe<ConfigurableOperationInput>;
  checker?: InputMaybe<ConfigurableOperationInput>;
  code?: InputMaybe<Scalars['String']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  fulfillmentHandler?: InputMaybe<Scalars['String']>;
  id: Scalars['ID'];
  translations: Array<ShippingMethodTranslationInput>;
};

export type UpdateTagInput = {
  id: Scalars['ID'];
  value?: InputMaybe<Scalars['String']>;
};

export type UpdateTaxCategoryInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  id: Scalars['ID'];
  isDefault?: InputMaybe<Scalars['Boolean']>;
  name?: InputMaybe<Scalars['String']>;
};

export type UpdateTaxRateInput = {
  categoryId?: InputMaybe<Scalars['ID']>;
  customFields?: InputMaybe<Scalars['JSON']>;
  customerGroupId?: InputMaybe<Scalars['ID']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  id: Scalars['ID'];
  name?: InputMaybe<Scalars['String']>;
  value?: InputMaybe<Scalars['Float']>;
  zoneId?: InputMaybe<Scalars['ID']>;
};

export type UpdateZoneInput = {
  customFields?: InputMaybe<Scalars['JSON']>;
  id: Scalars['ID'];
  name?: InputMaybe<Scalars['String']>;
};

export type User = Node & {
  __typename?: 'User';
  authenticationMethods: Array<AuthenticationMethod>;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  identifier: Scalars['String'];
  lastLogin?: Maybe<Scalars['DateTime']>;
  roles: Array<Role>;
  updatedAt: Scalars['DateTime'];
  verified: Scalars['Boolean'];
};

export type Zone = Node & {
  __typename?: 'Zone';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  members: Array<Country>;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type CreateShippingMethodMutationVariables = Exact<{
  input: CreateShippingMethodInput;
}>;

export type CreateShippingMethodMutation = {
  __typename?: 'Mutation';
  createShippingMethod: { __typename?: 'ShippingMethod'; id: string };
};

export type CreateFulfillmentMutationVariables = Exact<{
  input: FulfillOrderInput;
}>;

export type CreateFulfillmentMutation = {
  __typename?: 'Mutation';
  addFulfillmentToOrder:
    | { __typename?: 'CreateFulfillmentError' }
    | { __typename?: 'EmptyOrderLineSelectionError' }
    | { __typename?: 'Fulfillment'; id: string; state: string; method: string }
    | { __typename?: 'FulfillmentStateTransitionError' }
    | { __typename?: 'InsufficientStockOnHandError' }
    | { __typename?: 'InvalidFulfillmentHandlerError' }
    | { __typename?: 'ItemsAlreadyFulfilledError' };
};

export type OrderQueryVariables = Exact<{
  id: Scalars['ID'];
}>;

export type OrderQuery = {
  __typename?: 'Query';
  order?: {
    __typename?: 'Order';
    id: string;
    code: string;
    state: string;
    totalWithTax: number;
    shippingWithTax: number;
    fulfillments?: Array<{
      __typename?: 'Fulfillment';
      id: string;
      state: string;
      method: string;
    }> | null;
  } | null;
};

export type CreatePaymentMethodMutationVariables = Exact<{
  input: CreatePaymentMethodInput;
}>;

export type CreatePaymentMethodMutation = {
  __typename?: 'Mutation';
  createPaymentMethod: {
    __typename?: 'PaymentMethod';
    id: string;
    code: string;
    name: string;
    description: string;
    enabled: boolean;
  };
};

export const CreateShippingMethod = gql`
  mutation CreateShippingMethod($input: CreateShippingMethodInput!) {
    createShippingMethod(input: $input) {
      id
    }
  }
`;
export const CreateFulfillment = gql`
  mutation CreateFulfillment($input: FulfillOrderInput!) {
    addFulfillmentToOrder(input: $input) {
      ... on Fulfillment {
        id
        state
        method
      }
    }
  }
`;
export const Order = gql`
  query order($id: ID!) {
    order(id: $id) {
      id
      code
      state
      totalWithTax
      shippingWithTax
      fulfillments {
        id
        state
        method
      }
    }
  }
`;
export const CreatePaymentMethod = gql`
  mutation createPaymentMethod($input: CreatePaymentMethodInput!) {
    createPaymentMethod(input: $input) {
      id
      code
      name
      description
      enabled
    }
  }
`;
