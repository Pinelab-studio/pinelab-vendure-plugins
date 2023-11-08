export type Maybe<T> = T | undefined;
export type InputMaybe<T> = T | undefined;
export type Exact<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: number | string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  DateTime: any;
  JSON: any;
  Money: any;
  Upload: any;
}

export type ActiveOrderResult = NoActiveOrderError | Order;

export type AddPaymentToOrderResult =
  | IneligiblePaymentMethodError
  | NoActiveOrderError
  | Order
  | OrderPaymentStateError
  | OrderStateTransitionError
  | PaymentDeclinedError
  | PaymentFailedError;

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

export interface Adjustment {
  __typename?: 'Adjustment';
  adjustmentSource: Scalars['String'];
  amount: Scalars['Money'];
  data?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  type: AdjustmentType;
}

export enum AdjustmentType {
  DistributedOrderPromotion = 'DISTRIBUTED_ORDER_PROMOTION',
  Other = 'OTHER',
  Promotion = 'PROMOTION',
}

/** Returned when attempting to set the Customer for an Order when already logged in. */
export type AlreadyLoggedInError = ErrorResult & {
  __typename?: 'AlreadyLoggedInError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type ApplyCouponCodeResult =
  | CouponCodeExpiredError
  | CouponCodeInvalidError
  | CouponCodeLimitError
  | Order;

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
  tags: Tag[];
  type: AssetType;
  updatedAt: Scalars['DateTime'];
  width: Scalars['Int'];
};

export type AssetList = PaginatedList & {
  __typename?: 'AssetList';
  items: Asset[];
  totalItems: Scalars['Int'];
};

export enum AssetType {
  Binary = 'BINARY',
  Image = 'IMAGE',
  Video = 'VIDEO',
}

export interface AuthenticationInput {
  native?: InputMaybe<NativeAuthInput>;
}

export type AuthenticationMethod = Node & {
  __typename?: 'AuthenticationMethod';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  strategy: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type AuthenticationResult =
  | CurrentUser
  | InvalidCredentialsError
  | NotVerifiedError;

export type BooleanCustomFieldConfig = CustomField & {
  __typename?: 'BooleanCustomFieldConfig';
  description?: Maybe<LocalizedString[]>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<LocalizedString[]>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

/** Operators for filtering on a list of Boolean fields */
export interface BooleanListOperators {
  inList: Scalars['Boolean'];
}

/** Operators for filtering on a Boolean field */
export interface BooleanOperators {
  eq?: InputMaybe<Scalars['Boolean']>;
  isNull?: InputMaybe<Scalars['Boolean']>;
}

export interface MutationCreateMolliePaymentIntentArgs {
  input: MolliePaymentIntentInput;
}

export interface MolliePaymentIntentInput {
  molliePaymentMethodCode?: InputMaybe<Scalars['String']>;
  paymentMethodCode: Scalars['String'];
  redirectUrl?: InputMaybe<Scalars['String']>;
}

export type Channel = Node & {
  __typename?: 'Channel';
  availableCurrencyCodes: CurrencyCode[];
  availableLanguageCodes?: Maybe<LanguageCode[]>;
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  /** @deprecated Use defaultCurrencyCode instead */
  currencyCode: CurrencyCode;
  customFields?: Maybe<Scalars['JSON']>;
  defaultCurrencyCode: CurrencyCode;
  defaultLanguageCode: LanguageCode;
  defaultShippingZone?: Maybe<Zone>;
  defaultTaxZone?: Maybe<Zone>;
  id: Scalars['ID'];
  /** Not yet used - will be implemented in a future release. */
  outOfStockThreshold?: Maybe<Scalars['Int']>;
  pricesIncludeTax: Scalars['Boolean'];
  seller?: Maybe<Seller>;
  token: Scalars['String'];
  /** Not yet used - will be implemented in a future release. */
  trackInventory?: Maybe<Scalars['Boolean']>;
  updatedAt: Scalars['DateTime'];
};

export type Collection = Node & {
  __typename?: 'Collection';
  assets: Asset[];
  breadcrumbs: CollectionBreadcrumb[];
  children?: Maybe<Collection[]>;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  featuredAsset?: Maybe<Asset>;
  filters: ConfigurableOperation[];
  id: Scalars['ID'];
  languageCode?: Maybe<LanguageCode>;
  name: Scalars['String'];
  parent?: Maybe<Collection>;
  parentId: Scalars['ID'];
  position: Scalars['Int'];
  productVariants: ProductVariantList;
  slug: Scalars['String'];
  translations: CollectionTranslation[];
  updatedAt: Scalars['DateTime'];
};

export interface CollectionProductVariantsArgs {
  options?: InputMaybe<ProductVariantListOptions>;
}

export interface CollectionBreadcrumb {
  __typename?: 'CollectionBreadcrumb';
  id: Scalars['ID'];
  name: Scalars['String'];
  slug: Scalars['String'];
}

export interface CollectionFilterParameter {
  createdAt?: InputMaybe<DateOperators>;
  description?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  languageCode?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  parentId?: InputMaybe<IdOperators>;
  position?: InputMaybe<NumberOperators>;
  slug?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
}

export type CollectionList = PaginatedList & {
  __typename?: 'CollectionList';
  items: Collection[];
  totalItems: Scalars['Int'];
};

export interface CollectionListOptions {
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
  topLevelOnly?: InputMaybe<Scalars['Boolean']>;
}

/**
 * Which Collections are present in the products returned
 * by the search, and in what quantity.
 */
export interface CollectionResult {
  __typename?: 'CollectionResult';
  collection: Collection;
  count: Scalars['Int'];
}

export interface CollectionSortParameter {
  createdAt?: InputMaybe<SortOrder>;
  description?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  parentId?: InputMaybe<SortOrder>;
  position?: InputMaybe<SortOrder>;
  slug?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
}

export interface CollectionTranslation {
  __typename?: 'CollectionTranslation';
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  slug: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

export interface ConfigArg {
  __typename?: 'ConfigArg';
  name: Scalars['String'];
  value: Scalars['String'];
}

export interface ConfigArgDefinition {
  __typename?: 'ConfigArgDefinition';
  defaultValue?: Maybe<Scalars['JSON']>;
  description?: Maybe<Scalars['String']>;
  label?: Maybe<Scalars['String']>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  required: Scalars['Boolean'];
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
}

export interface ConfigArgInput {
  name: Scalars['String'];
  /** A JSON stringified representation of the actual value */
  value: Scalars['String'];
}

export interface ConfigurableOperation {
  __typename?: 'ConfigurableOperation';
  args: ConfigArg[];
  code: Scalars['String'];
}

export interface ConfigurableOperationDefinition {
  __typename?: 'ConfigurableOperationDefinition';
  args: ConfigArgDefinition[];
  code: Scalars['String'];
  description: Scalars['String'];
}

export interface ConfigurableOperationInput {
  arguments: ConfigArgInput[];
  code: Scalars['String'];
}

export interface Coordinate {
  __typename?: 'Coordinate';
  x: Scalars['Float'];
  y: Scalars['Float'];
}

export type Country = Node &
  Region & {
    __typename?: 'Country';
    code: Scalars['String'];
    createdAt: Scalars['DateTime'];
    customFields?: Maybe<Scalars['JSON']>;
    enabled: Scalars['Boolean'];
    id: Scalars['ID'];
    languageCode: LanguageCode;
    name: Scalars['String'];
    parent?: Maybe<Region>;
    parentId?: Maybe<Scalars['ID']>;
    translations: RegionTranslation[];
    type: Scalars['String'];
    updatedAt: Scalars['DateTime'];
  };

export type CountryList = PaginatedList & {
  __typename?: 'CountryList';
  items: Country[];
  totalItems: Scalars['Int'];
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

export interface CreateAddressInput {
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
}

export interface CreateCustomerInput {
  customFields?: InputMaybe<Scalars['JSON']>;
  emailAddress: Scalars['String'];
  firstName: Scalars['String'];
  lastName: Scalars['String'];
  phoneNumber?: InputMaybe<Scalars['String']>;
  title?: InputMaybe<Scalars['String']>;
}

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

export interface CurrentUser {
  __typename?: 'CurrentUser';
  channels: CurrentUserChannel[];
  id: Scalars['ID'];
  identifier: Scalars['String'];
}

export interface CurrentUserChannel {
  __typename?: 'CurrentUserChannel';
  code: Scalars['String'];
  id: Scalars['ID'];
  permissions: Permission[];
  token: Scalars['String'];
}

export interface CustomField {
  description?: Maybe<LocalizedString[]>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<LocalizedString[]>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
}

export type CustomFieldConfig =
  | BooleanCustomFieldConfig
  | DateTimeCustomFieldConfig
  | FloatCustomFieldConfig
  | IntCustomFieldConfig
  | LocaleStringCustomFieldConfig
  | LocaleTextCustomFieldConfig
  | RelationCustomFieldConfig
  | StringCustomFieldConfig
  | TextCustomFieldConfig;

export type Customer = Node & {
  __typename?: 'Customer';
  addresses?: Maybe<Address[]>;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  emailAddress: Scalars['String'];
  firstName: Scalars['String'];
  id: Scalars['ID'];
  lastName: Scalars['String'];
  orders: OrderList;
  phoneNumber?: Maybe<Scalars['String']>;
  title?: Maybe<Scalars['String']>;
  updatedAt: Scalars['DateTime'];
  user?: Maybe<User>;
};

export interface CustomerOrdersArgs {
  options?: InputMaybe<OrderListOptions>;
}

export interface CustomerFilterParameter {
  createdAt?: InputMaybe<DateOperators>;
  emailAddress?: InputMaybe<StringOperators>;
  firstName?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  lastName?: InputMaybe<StringOperators>;
  phoneNumber?: InputMaybe<StringOperators>;
  title?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
}

export type CustomerGroup = Node & {
  __typename?: 'CustomerGroup';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  customers: CustomerList;
  id: Scalars['ID'];
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export interface CustomerGroupCustomersArgs {
  options?: InputMaybe<CustomerListOptions>;
}

export type CustomerList = PaginatedList & {
  __typename?: 'CustomerList';
  items: Customer[];
  totalItems: Scalars['Int'];
};

export interface CustomerListOptions {
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
}

export interface CustomerSortParameter {
  createdAt?: InputMaybe<SortOrder>;
  emailAddress?: InputMaybe<SortOrder>;
  firstName?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  lastName?: InputMaybe<SortOrder>;
  phoneNumber?: InputMaybe<SortOrder>;
  title?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
}

/** Operators for filtering on a list of Date fields */
export interface DateListOperators {
  inList: Scalars['DateTime'];
}

/** Operators for filtering on a DateTime field */
export interface DateOperators {
  after?: InputMaybe<Scalars['DateTime']>;
  before?: InputMaybe<Scalars['DateTime']>;
  between?: InputMaybe<DateRange>;
  eq?: InputMaybe<Scalars['DateTime']>;
  isNull?: InputMaybe<Scalars['Boolean']>;
}

export interface DateRange {
  end: Scalars['DateTime'];
  start: Scalars['DateTime'];
}

/**
 * Expects the same validation formats as the `<input type="datetime-local">` HTML element.
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local#Additional_attributes
 */
export type DateTimeCustomFieldConfig = CustomField & {
  __typename?: 'DateTimeCustomFieldConfig';
  description?: Maybe<LocalizedString[]>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<LocalizedString[]>;
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

export interface DeletionResponse {
  __typename?: 'DeletionResponse';
  message?: Maybe<Scalars['String']>;
  result: DeletionResult;
}

export enum DeletionResult {
  /** The entity was successfully deleted */
  Deleted = 'DELETED',
  /** Deletion did not take place, reason given in message */
  NotDeleted = 'NOT_DELETED',
}

export interface Discount {
  __typename?: 'Discount';
  adjustmentSource: Scalars['String'];
  amount: Scalars['Money'];
  amountWithTax: Scalars['Money'];
  description: Scalars['String'];
  type: AdjustmentType;
}

/** Returned when attempting to create a Customer with an email address already registered to an existing User. */
export type EmailAddressConflictError = ErrorResult & {
  __typename?: 'EmailAddressConflictError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export enum ErrorCode {
  AlreadyLoggedInError = 'ALREADY_LOGGED_IN_ERROR',
  CouponCodeExpiredError = 'COUPON_CODE_EXPIRED_ERROR',
  CouponCodeInvalidError = 'COUPON_CODE_INVALID_ERROR',
  CouponCodeLimitError = 'COUPON_CODE_LIMIT_ERROR',
  EmailAddressConflictError = 'EMAIL_ADDRESS_CONFLICT_ERROR',
  GuestCheckoutError = 'GUEST_CHECKOUT_ERROR',
  IdentifierChangeTokenExpiredError = 'IDENTIFIER_CHANGE_TOKEN_EXPIRED_ERROR',
  IdentifierChangeTokenInvalidError = 'IDENTIFIER_CHANGE_TOKEN_INVALID_ERROR',
  IneligiblePaymentMethodError = 'INELIGIBLE_PAYMENT_METHOD_ERROR',
  IneligibleShippingMethodError = 'INELIGIBLE_SHIPPING_METHOD_ERROR',
  InsufficientStockError = 'INSUFFICIENT_STOCK_ERROR',
  InvalidCredentialsError = 'INVALID_CREDENTIALS_ERROR',
  MissingPasswordError = 'MISSING_PASSWORD_ERROR',
  NativeAuthStrategyError = 'NATIVE_AUTH_STRATEGY_ERROR',
  NegativeQuantityError = 'NEGATIVE_QUANTITY_ERROR',
  NotVerifiedError = 'NOT_VERIFIED_ERROR',
  NoActiveOrderError = 'NO_ACTIVE_ORDER_ERROR',
  OrderLimitError = 'ORDER_LIMIT_ERROR',
  OrderModificationError = 'ORDER_MODIFICATION_ERROR',
  OrderPaymentStateError = 'ORDER_PAYMENT_STATE_ERROR',
  OrderStateTransitionError = 'ORDER_STATE_TRANSITION_ERROR',
  PasswordAlreadySetError = 'PASSWORD_ALREADY_SET_ERROR',
  PasswordResetTokenExpiredError = 'PASSWORD_RESET_TOKEN_EXPIRED_ERROR',
  PasswordResetTokenInvalidError = 'PASSWORD_RESET_TOKEN_INVALID_ERROR',
  PasswordValidationError = 'PASSWORD_VALIDATION_ERROR',
  PaymentDeclinedError = 'PAYMENT_DECLINED_ERROR',
  PaymentFailedError = 'PAYMENT_FAILED_ERROR',
  UnknownError = 'UNKNOWN_ERROR',
  VerificationTokenExpiredError = 'VERIFICATION_TOKEN_EXPIRED_ERROR',
  VerificationTokenInvalidError = 'VERIFICATION_TOKEN_INVALID_ERROR',
}

export interface ErrorResult {
  errorCode: ErrorCode;
  message: Scalars['String'];
}

export type Facet = Node & {
  __typename?: 'Facet';
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  translations: FacetTranslation[];
  updatedAt: Scalars['DateTime'];
  values: FacetValue[];
};

export interface FacetFilterParameter {
  code?: InputMaybe<StringOperators>;
  createdAt?: InputMaybe<DateOperators>;
  id?: InputMaybe<IdOperators>;
  languageCode?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
}

export type FacetList = PaginatedList & {
  __typename?: 'FacetList';
  items: Facet[];
  totalItems: Scalars['Int'];
};

export interface FacetListOptions {
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
}

export interface FacetSortParameter {
  code?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
}

export interface FacetTranslation {
  __typename?: 'FacetTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

export type FacetValue = Node & {
  __typename?: 'FacetValue';
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  facet: Facet;
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  translations: FacetValueTranslation[];
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
export interface FacetValueFilterInput {
  and?: InputMaybe<Scalars['ID']>;
  or?: InputMaybe<Array<Scalars['ID']>>;
}

/**
 * Which FacetValues are present in the products returned
 * by the search, and in what quantity.
 */
export interface FacetValueResult {
  __typename?: 'FacetValueResult';
  count: Scalars['Int'];
  facetValue: FacetValue;
}

export interface FacetValueTranslation {
  __typename?: 'FacetValueTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

export type FloatCustomFieldConfig = CustomField & {
  __typename?: 'FloatCustomFieldConfig';
  description?: Maybe<LocalizedString[]>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<LocalizedString[]>;
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

export type Fulfillment = Node & {
  __typename?: 'Fulfillment';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  lines: FulfillmentLine[];
  method: Scalars['String'];
  state: Scalars['String'];
  /** @deprecated Use the `lines` field instead */
  summary: FulfillmentLine[];
  trackingCode?: Maybe<Scalars['String']>;
  updatedAt: Scalars['DateTime'];
};

export interface FulfillmentLine {
  __typename?: 'FulfillmentLine';
  fulfillment: Fulfillment;
  fulfillmentId: Scalars['ID'];
  orderLine: OrderLine;
  orderLineId: Scalars['ID'];
  quantity: Scalars['Int'];
}

export enum GlobalFlag {
  False = 'FALSE',
  Inherit = 'INHERIT',
  True = 'TRUE',
}

/** Returned when attempting to set the Customer on a guest checkout when the configured GuestCheckoutStrategy does not allow it. */
export type GuestCheckoutError = ErrorResult & {
  __typename?: 'GuestCheckoutError';
  errorCode: ErrorCode;
  errorDetail: Scalars['String'];
  message: Scalars['String'];
};

export type HistoryEntry = Node & {
  __typename?: 'HistoryEntry';
  createdAt: Scalars['DateTime'];
  data: Scalars['JSON'];
  id: Scalars['ID'];
  type: HistoryEntryType;
  updatedAt: Scalars['DateTime'];
};

export interface HistoryEntryFilterParameter {
  createdAt?: InputMaybe<DateOperators>;
  id?: InputMaybe<IdOperators>;
  type?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
}

export type HistoryEntryList = PaginatedList & {
  __typename?: 'HistoryEntryList';
  items: HistoryEntry[];
  totalItems: Scalars['Int'];
};

export interface HistoryEntryListOptions {
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
}

export interface HistoryEntrySortParameter {
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
}

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
export interface IdListOperators {
  inList: Scalars['ID'];
}

/** Operators for filtering on an ID field */
export interface IdOperators {
  eq?: InputMaybe<Scalars['String']>;
  in?: InputMaybe<Array<Scalars['String']>>;
  isNull?: InputMaybe<Scalars['Boolean']>;
  notEq?: InputMaybe<Scalars['String']>;
  notIn?: InputMaybe<Array<Scalars['String']>>;
}

/**
 * Returned if the token used to change a Customer's email address is valid, but has
 * expired according to the `verificationTokenDuration` setting in the AuthOptions.
 */
export type IdentifierChangeTokenExpiredError = ErrorResult & {
  __typename?: 'IdentifierChangeTokenExpiredError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/**
 * Returned if the token used to change a Customer's email address is either
 * invalid or does not match any expected tokens.
 */
export type IdentifierChangeTokenInvalidError = ErrorResult & {
  __typename?: 'IdentifierChangeTokenInvalidError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned when attempting to add a Payment using a PaymentMethod for which the Order is not eligible. */
export type IneligiblePaymentMethodError = ErrorResult & {
  __typename?: 'IneligiblePaymentMethodError';
  eligibilityCheckerMessage?: Maybe<Scalars['String']>;
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned when attempting to set a ShippingMethod for which the Order is not eligible */
export type IneligibleShippingMethodError = ErrorResult & {
  __typename?: 'IneligibleShippingMethodError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned when attempting to add more items to the Order than are available */
export type InsufficientStockError = ErrorResult & {
  __typename?: 'InsufficientStockError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  order: Order;
  quantityAvailable: Scalars['Int'];
};

export type IntCustomFieldConfig = CustomField & {
  __typename?: 'IntCustomFieldConfig';
  description?: Maybe<LocalizedString[]>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<LocalizedString[]>;
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

export type LocaleStringCustomFieldConfig = CustomField & {
  __typename?: 'LocaleStringCustomFieldConfig';
  description?: Maybe<LocalizedString[]>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<LocalizedString[]>;
  length?: Maybe<Scalars['Int']>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  pattern?: Maybe<Scalars['String']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type LocaleTextCustomFieldConfig = CustomField & {
  __typename?: 'LocaleTextCustomFieldConfig';
  description?: Maybe<LocalizedString[]>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<LocalizedString[]>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export interface LocalizedString {
  __typename?: 'LocalizedString';
  languageCode: LanguageCode;
  value: Scalars['String'];
}

export enum LogicalOperator {
  And = 'AND',
  Or = 'OR',
}

/** Returned when attempting to register or verify a customer account without a password, when one is required. */
export type MissingPasswordError = ErrorResult & {
  __typename?: 'MissingPasswordError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export interface Mutation {
  __typename?: 'Mutation';
  /** Adds an item to the order. If custom fields are defined on the OrderLine entity, a third argument 'customFields' will be available. */
  addItemToOrder: UpdateOrderItemsResult;
  /** Add a Payment to the Order */
  addPaymentToOrder: AddPaymentToOrderResult;
  /** Adjusts an OrderLine. If custom fields are defined on the OrderLine entity, a third argument 'customFields' of type `OrderLineCustomFieldsInput` will be available. */
  adjustOrderLine: UpdateOrderItemsResult;
  /** Applies the given coupon code to the active Order */
  applyCouponCode: ApplyCouponCodeResult;
  /** Authenticates the user using a named authentication strategy */
  authenticate: AuthenticationResult;
  /** Create a new Customer Address */
  createCustomerAddress: Address;
  /** Delete an existing Address */
  deleteCustomerAddress: Success;
  /** Authenticates the user using the native authentication strategy. This mutation is an alias for `authenticate({ native: { ... }})` */
  login: NativeAuthenticationResult;
  /** End the current authenticated session */
  logout: Success;
  /** Regenerate and send a verification token for a new Customer registration. Only applicable if `authOptions.requireVerification` is set to true. */
  refreshCustomerVerification: RefreshCustomerVerificationResult;
  /**
   * Register a Customer account with the given credentials. There are three possible registration flows:
   *
   * _If `authOptions.requireVerification` is set to `true`:_
   *
   * 1. **The Customer is registered _with_ a password**. A verificationToken will be created (and typically emailed to the Customer). That
   *    verificationToken would then be passed to the `verifyCustomerAccount` mutation _without_ a password. The Customer is then
   *    verified and authenticated in one step.
   * 2. **The Customer is registered _without_ a password**. A verificationToken will be created (and typically emailed to the Customer). That
   *    verificationToken would then be passed to the `verifyCustomerAccount` mutation _with_ the chosen password of the Customer. The Customer is then
   *    verified and authenticated in one step.
   *
   * _If `authOptions.requireVerification` is set to `false`:_
   *
   * 3. The Customer _must_ be registered _with_ a password. No further action is needed - the Customer is able to authenticate immediately.
   */
  registerCustomerAccount: RegisterCustomerAccountResult;
  /** Remove all OrderLine from the Order */
  removeAllOrderLines: RemoveOrderItemsResult;
  /** Removes the given coupon code from the active Order */
  removeCouponCode?: Maybe<Order>;
  /** Remove an OrderLine from the Order */
  removeOrderLine: RemoveOrderItemsResult;
  /** Requests a password reset email to be sent */
  requestPasswordReset?: Maybe<RequestPasswordResetResult>;
  /**
   * Request to update the emailAddress of the active Customer. If `authOptions.requireVerification` is enabled
   * (as is the default), then the `identifierChangeToken` will be assigned to the current User and
   * a IdentifierChangeRequestEvent will be raised. This can then be used e.g. by the EmailPlugin to email
   * that verification token to the Customer, which is then used to verify the change of email address.
   */
  requestUpdateCustomerEmailAddress: RequestUpdateCustomerEmailAddressResult;
  /** Resets a Customer's password based on the provided token */
  resetPassword: ResetPasswordResult;
  /** Set the Customer for the Order. Required only if the Customer is not currently logged in */
  setCustomerForOrder: SetCustomerForOrderResult;
  /** Sets the billing address for this order */
  setOrderBillingAddress: ActiveOrderResult;
  /** Allows any custom fields to be set for the active order */
  setOrderCustomFields: ActiveOrderResult;
  /** Sets the shipping address for this order */
  setOrderShippingAddress: ActiveOrderResult;
  /**
   * Sets the shipping method by id, which can be obtained with the `eligibleShippingMethods` query.
   * An Order can have multiple shipping methods, in which case you can pass an array of ids. In this case,
   * you should configure a custom ShippingLineAssignmentStrategy in order to know which OrderLines each
   * shipping method will apply to.
   */
  setOrderShippingMethod: SetOrderShippingMethodResult;
  /** Transitions an Order to a new state. Valid next states can be found by querying `nextOrderStates` */
  transitionOrderToState?: Maybe<TransitionOrderToStateResult>;
  /** Update an existing Customer */
  updateCustomer: Customer;
  /** Update an existing Address */
  updateCustomerAddress: Address;
  /**
   * Confirm the update of the emailAddress with the provided token, which has been generated by the
   * `requestUpdateCustomerEmailAddress` mutation.
   */
  updateCustomerEmailAddress: UpdateCustomerEmailAddressResult;
  /** Update the password of the active Customer */
  updateCustomerPassword: UpdateCustomerPasswordResult;
  /**
   * Verify a Customer email address with the token sent to that address. Only applicable if `authOptions.requireVerification` is set to true.
   *
   * If the Customer was not registered with a password in the `registerCustomerAccount` mutation, the password _must_ be
   * provided here.
   */
  verifyCustomerAccount: VerifyCustomerAccountResult;
}

export interface MutationAddItemToOrderArgs {
  productVariantId: Scalars['ID'];
  quantity: Scalars['Int'];
}

export interface MutationAddPaymentToOrderArgs {
  input: PaymentInput;
}

export interface MutationAdjustOrderLineArgs {
  orderLineId: Scalars['ID'];
  quantity: Scalars['Int'];
}

export interface MutationApplyCouponCodeArgs {
  couponCode: Scalars['String'];
}

export interface MutationAuthenticateArgs {
  input: AuthenticationInput;
  rememberMe?: InputMaybe<Scalars['Boolean']>;
}

export interface MutationCreateCustomerAddressArgs {
  input: CreateAddressInput;
}

export interface MutationDeleteCustomerAddressArgs {
  id: Scalars['ID'];
}

export interface MutationLoginArgs {
  password: Scalars['String'];
  rememberMe?: InputMaybe<Scalars['Boolean']>;
  username: Scalars['String'];
}

export interface MutationRefreshCustomerVerificationArgs {
  emailAddress: Scalars['String'];
}

export interface MutationRegisterCustomerAccountArgs {
  input: RegisterCustomerInput;
}

export interface MutationRemoveCouponCodeArgs {
  couponCode: Scalars['String'];
}

export interface MutationRemoveOrderLineArgs {
  orderLineId: Scalars['ID'];
}

export interface MutationRequestPasswordResetArgs {
  emailAddress: Scalars['String'];
}

export interface MutationRequestUpdateCustomerEmailAddressArgs {
  newEmailAddress: Scalars['String'];
  password: Scalars['String'];
}

export interface MutationResetPasswordArgs {
  password: Scalars['String'];
  token: Scalars['String'];
}

export interface MutationSetCustomerForOrderArgs {
  input: CreateCustomerInput;
}

export interface MutationSetOrderBillingAddressArgs {
  input: CreateAddressInput;
}

export interface MutationSetOrderCustomFieldsArgs {
  input: UpdateOrderInput;
}

export interface MutationSetOrderShippingAddressArgs {
  input: CreateAddressInput;
}

export interface MutationSetOrderShippingMethodArgs {
  shippingMethodId: Array<Scalars['ID']>;
}

export interface MutationTransitionOrderToStateArgs {
  state: Scalars['String'];
}

export interface MutationUpdateCustomerArgs {
  input: UpdateCustomerInput;
}

export interface MutationUpdateCustomerAddressArgs {
  input: UpdateAddressInput;
}

export interface MutationUpdateCustomerEmailAddressArgs {
  token: Scalars['String'];
}

export interface MutationUpdateCustomerPasswordArgs {
  currentPassword: Scalars['String'];
  newPassword: Scalars['String'];
}

export interface MutationVerifyCustomerAccountArgs {
  password?: InputMaybe<Scalars['String']>;
  token: Scalars['String'];
}

export interface NativeAuthInput {
  password: Scalars['String'];
  username: Scalars['String'];
}

/** Returned when attempting an operation that relies on the NativeAuthStrategy, if that strategy is not configured. */
export type NativeAuthStrategyError = ErrorResult & {
  __typename?: 'NativeAuthStrategyError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type NativeAuthenticationResult =
  | CurrentUser
  | InvalidCredentialsError
  | NativeAuthStrategyError
  | NotVerifiedError;

/** Returned when attempting to set a negative OrderLine quantity. */
export type NegativeQuantityError = ErrorResult & {
  __typename?: 'NegativeQuantityError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/**
 * Returned when invoking a mutation which depends on there being an active Order on the
 * current session.
 */
export type NoActiveOrderError = ErrorResult & {
  __typename?: 'NoActiveOrderError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export interface Node {
  id: Scalars['ID'];
}

/**
 * Returned if `authOptions.requireVerification` is set to `true` (which is the default)
 * and an unverified user attempts to authenticate.
 */
export type NotVerifiedError = ErrorResult & {
  __typename?: 'NotVerifiedError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Operators for filtering on a list of Number fields */
export interface NumberListOperators {
  inList: Scalars['Float'];
}

/** Operators for filtering on a Int or Float field */
export interface NumberOperators {
  between?: InputMaybe<NumberRange>;
  eq?: InputMaybe<Scalars['Float']>;
  gt?: InputMaybe<Scalars['Float']>;
  gte?: InputMaybe<Scalars['Float']>;
  isNull?: InputMaybe<Scalars['Boolean']>;
  lt?: InputMaybe<Scalars['Float']>;
  lte?: InputMaybe<Scalars['Float']>;
}

export interface NumberRange {
  end: Scalars['Float'];
  start: Scalars['Float'];
}

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
  customFields?: Maybe<Scalars['JSON']>;
  customer?: Maybe<Customer>;
  discounts: Discount[];
  fulfillments?: Maybe<Fulfillment[]>;
  history: HistoryEntryList;
  id: Scalars['ID'];
  lines: OrderLine[];
  /**
   * The date & time that the Order was placed, i.e. the Customer
   * completed the checkout and the Order is no longer "active"
   */
  orderPlacedAt?: Maybe<Scalars['DateTime']>;
  payments?: Maybe<Payment[]>;
  /** Promotions applied to the order. Only gets populated after the payment process has completed. */
  promotions: Promotion[];
  shipping: Scalars['Money'];
  shippingAddress?: Maybe<OrderAddress>;
  shippingLines: ShippingLine[];
  shippingWithTax: Scalars['Money'];
  state: Scalars['String'];
  /**
   * The subTotal is the total of all OrderLines in the Order. This figure also includes any Order-level
   * discounts which have been prorated (proportionally distributed) amongst the items of each OrderLine.
   * To get a total of all OrderLines which does not account for prorated discounts, use the
   * sum of `OrderLine.discountedLinePrice` values.
   */
  subTotal: Scalars['Money'];
  /** Same as subTotal, but inclusive of tax */
  subTotalWithTax: Scalars['Money'];
  /**
   * Surcharges are arbitrary modifications to the Order total which are neither
   * ProductVariants nor discounts resulting from applied Promotions. For example,
   * one-off discounts based on customer interaction, or surcharges based on payment
   * methods.
   */
  surcharges: Surcharge[];
  /** A summary of the taxes being applied to this Order */
  taxSummary: OrderTaxSummary[];
  /** Equal to subTotal plus shipping */
  total: Scalars['Money'];
  totalQuantity: Scalars['Int'];
  /** The final payable amount. Equal to subTotalWithTax plus shippingWithTax */
  totalWithTax: Scalars['Money'];
  type: OrderType;
  updatedAt: Scalars['DateTime'];
};

export interface OrderHistoryArgs {
  options?: InputMaybe<HistoryEntryListOptions>;
}

export interface OrderAddress {
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
}

export interface OrderFilterParameter {
  active?: InputMaybe<BooleanOperators>;
  code?: InputMaybe<StringOperators>;
  createdAt?: InputMaybe<DateOperators>;
  currencyCode?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  orderPlacedAt?: InputMaybe<DateOperators>;
  shipping?: InputMaybe<NumberOperators>;
  shippingWithTax?: InputMaybe<NumberOperators>;
  state?: InputMaybe<StringOperators>;
  subTotal?: InputMaybe<NumberOperators>;
  subTotalWithTax?: InputMaybe<NumberOperators>;
  total?: InputMaybe<NumberOperators>;
  totalQuantity?: InputMaybe<NumberOperators>;
  totalWithTax?: InputMaybe<NumberOperators>;
  type?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
}

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
  discountedLinePrice: Scalars['Money'];
  /** The price of the line including discounts and tax */
  discountedLinePriceWithTax: Scalars['Money'];
  /**
   * The price of a single unit including discounts, excluding tax.
   *
   * If Order-level discounts have been applied, this will not be the
   * actual taxable unit price (see `proratedUnitPrice`), but is generally the
   * correct price to display to customers to avoid confusion
   * about the internal handling of distributed Order-level discounts.
   */
  discountedUnitPrice: Scalars['Money'];
  /** The price of a single unit including discounts and tax */
  discountedUnitPriceWithTax: Scalars['Money'];
  discounts: Discount[];
  featuredAsset?: Maybe<Asset>;
  fulfillmentLines?: Maybe<FulfillmentLine[]>;
  id: Scalars['ID'];
  /** The total price of the line excluding tax and discounts. */
  linePrice: Scalars['Money'];
  /** The total price of the line including tax but excluding discounts. */
  linePriceWithTax: Scalars['Money'];
  /** The total tax on this line */
  lineTax: Scalars['Money'];
  order: Order;
  /** The quantity at the time the Order was placed */
  orderPlacedQuantity: Scalars['Int'];
  productVariant: ProductVariant;
  /**
   * The actual line price, taking into account both item discounts _and_ prorated (proportionally-distributed)
   * Order-level discounts. This value is the true economic value of the OrderLine, and is used in tax
   * and refund calculations.
   */
  proratedLinePrice: Scalars['Money'];
  /** The proratedLinePrice including tax */
  proratedLinePriceWithTax: Scalars['Money'];
  /**
   * The actual unit price, taking into account both item discounts _and_ prorated (proportionally-distributed)
   * Order-level discounts. This value is the true economic value of the OrderItem, and is used in tax
   * and refund calculations.
   */
  proratedUnitPrice: Scalars['Money'];
  /** The proratedUnitPrice including tax */
  proratedUnitPriceWithTax: Scalars['Money'];
  quantity: Scalars['Int'];
  taxLines: TaxLine[];
  taxRate: Scalars['Float'];
  /** The price of a single unit, excluding tax and discounts */
  unitPrice: Scalars['Money'];
  /** Non-zero if the unitPrice has changed since it was initially added to Order */
  unitPriceChangeSinceAdded: Scalars['Money'];
  /** The price of a single unit, including tax but excluding discounts */
  unitPriceWithTax: Scalars['Money'];
  /** Non-zero if the unitPriceWithTax has changed since it was initially added to Order */
  unitPriceWithTaxChangeSinceAdded: Scalars['Money'];
  updatedAt: Scalars['DateTime'];
};

export type OrderList = PaginatedList & {
  __typename?: 'OrderList';
  items: Order[];
  totalItems: Scalars['Int'];
};

export interface OrderListOptions {
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
}

/** Returned when attempting to modify the contents of an Order that is not in the `AddingItems` state. */
export type OrderModificationError = ErrorResult & {
  __typename?: 'OrderModificationError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned when attempting to add a Payment to an Order that is not in the `ArrangingPayment` state. */
export type OrderPaymentStateError = ErrorResult & {
  __typename?: 'OrderPaymentStateError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export interface OrderSortParameter {
  code?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  orderPlacedAt?: InputMaybe<SortOrder>;
  shipping?: InputMaybe<SortOrder>;
  shippingWithTax?: InputMaybe<SortOrder>;
  state?: InputMaybe<SortOrder>;
  subTotal?: InputMaybe<SortOrder>;
  subTotalWithTax?: InputMaybe<SortOrder>;
  total?: InputMaybe<SortOrder>;
  totalQuantity?: InputMaybe<SortOrder>;
  totalWithTax?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
}

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
export interface OrderTaxSummary {
  __typename?: 'OrderTaxSummary';
  /** A description of this tax */
  description: Scalars['String'];
  /** The total net price of OrderLines to which this taxRate applies */
  taxBase: Scalars['Money'];
  /** The taxRate as a percentage */
  taxRate: Scalars['Float'];
  /** The total tax being applied to the Order at this taxRate */
  taxTotal: Scalars['Money'];
}

export enum OrderType {
  Aggregate = 'Aggregate',
  Regular = 'Regular',
  Seller = 'Seller',
}

export interface PaginatedList {
  items: Node[];
  totalItems: Scalars['Int'];
}

/** Returned when attempting to verify a customer account with a password, when a password has already been set. */
export type PasswordAlreadySetError = ErrorResult & {
  __typename?: 'PasswordAlreadySetError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/**
 * Returned if the token used to reset a Customer's password is valid, but has
 * expired according to the `verificationTokenDuration` setting in the AuthOptions.
 */
export type PasswordResetTokenExpiredError = ErrorResult & {
  __typename?: 'PasswordResetTokenExpiredError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/**
 * Returned if the token used to reset a Customer's password is either
 * invalid or does not match any expected tokens.
 */
export type PasswordResetTokenInvalidError = ErrorResult & {
  __typename?: 'PasswordResetTokenInvalidError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/** Returned when attempting to register or verify a customer account where the given password fails password validation. */
export type PasswordValidationError = ErrorResult & {
  __typename?: 'PasswordValidationError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  validationErrorMessage: Scalars['String'];
};

export type Payment = Node & {
  __typename?: 'Payment';
  amount: Scalars['Money'];
  createdAt: Scalars['DateTime'];
  errorMessage?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  metadata?: Maybe<Scalars['JSON']>;
  method: Scalars['String'];
  refunds: Refund[];
  state: Scalars['String'];
  transactionId?: Maybe<Scalars['String']>;
  updatedAt: Scalars['DateTime'];
};

/** Returned when a Payment is declined by the payment provider. */
export type PaymentDeclinedError = ErrorResult & {
  __typename?: 'PaymentDeclinedError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  paymentErrorMessage: Scalars['String'];
};

/** Returned when a Payment fails due to an error. */
export type PaymentFailedError = ErrorResult & {
  __typename?: 'PaymentFailedError';
  errorCode: ErrorCode;
  message: Scalars['String'];
  paymentErrorMessage: Scalars['String'];
};

/** Passed as input to the `addPaymentToOrder` mutation. */
export interface PaymentInput {
  /**
   * This field should contain arbitrary data passed to the specified PaymentMethodHandler's `createPayment()` method
   * as the "metadata" argument. For example, it could contain an ID for the payment and other
   * data generated by the payment provider.
   */
  metadata: Scalars['JSON'];
  /** This field should correspond to the `code` property of a PaymentMethod. */
  method: Scalars['String'];
}

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
  translations: PaymentMethodTranslation[];
  updatedAt: Scalars['DateTime'];
};

export interface PaymentMethodQuote {
  __typename?: 'PaymentMethodQuote';
  code: Scalars['String'];
  customFields?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  eligibilityMessage?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  isEligible: Scalars['Boolean'];
  name: Scalars['String'];
}

export interface PaymentMethodTranslation {
  __typename?: 'PaymentMethodTranslation';
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

/**
 * @description
 * Permissions for administrators and customers. Used to control access to
 * GraphQL resolvers via the {@link Allow} decorator.
 *
 * ## Understanding Permission.Owner
 *
 * `Permission.Owner` is a special permission which is used in some Vendure resolvers to indicate that that resolver should only
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
  /** Grants permission to create Seller */
  CreateSeller = 'CreateSeller',
  /** Grants permission to create PaymentMethods, ShippingMethods, TaxCategories, TaxRates, Zones, Countries, System & GlobalSettings */
  CreateSettings = 'CreateSettings',
  /** Grants permission to create ShippingMethod */
  CreateShippingMethod = 'CreateShippingMethod',
  /** Grants permission to create StockLocation */
  CreateStockLocation = 'CreateStockLocation',
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
  /** Grants permission to delete Seller */
  DeleteSeller = 'DeleteSeller',
  /** Grants permission to delete PaymentMethods, ShippingMethods, TaxCategories, TaxRates, Zones, Countries, System & GlobalSettings */
  DeleteSettings = 'DeleteSettings',
  /** Grants permission to delete ShippingMethod */
  DeleteShippingMethod = 'DeleteShippingMethod',
  /** Grants permission to delete StockLocation */
  DeleteStockLocation = 'DeleteStockLocation',
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
  /** Grants permission to read Seller */
  ReadSeller = 'ReadSeller',
  /** Grants permission to read PaymentMethods, ShippingMethods, TaxCategories, TaxRates, Zones, Countries, System & GlobalSettings */
  ReadSettings = 'ReadSettings',
  /** Grants permission to read ShippingMethod */
  ReadShippingMethod = 'ReadShippingMethod',
  /** Grants permission to read StockLocation */
  ReadStockLocation = 'ReadStockLocation',
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
  /** Grants permission to update Seller */
  UpdateSeller = 'UpdateSeller',
  /** Grants permission to update PaymentMethods, ShippingMethods, TaxCategories, TaxRates, Zones, Countries, System & GlobalSettings */
  UpdateSettings = 'UpdateSettings',
  /** Grants permission to update ShippingMethod */
  UpdateShippingMethod = 'UpdateShippingMethod',
  /** Grants permission to update StockLocation */
  UpdateStockLocation = 'UpdateStockLocation',
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
}

/** The price range where the result has more than one price */
export interface PriceRange {
  __typename?: 'PriceRange';
  max: Scalars['Money'];
  min: Scalars['Money'];
}

export type Product = Node & {
  __typename?: 'Product';
  assets: Asset[];
  collections: Collection[];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  facetValues: FacetValue[];
  featuredAsset?: Maybe<Asset>;
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  optionGroups: ProductOptionGroup[];
  slug: Scalars['String'];
  translations: ProductTranslation[];
  updatedAt: Scalars['DateTime'];
  /** Returns a paginated, sortable, filterable list of ProductVariants */
  variantList: ProductVariantList;
  /** Returns all ProductVariants */
  variants: ProductVariant[];
};

export interface ProductVariantListArgs {
  options?: InputMaybe<ProductVariantListOptions>;
}

export interface ProductFilterParameter {
  createdAt?: InputMaybe<DateOperators>;
  description?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  languageCode?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  slug?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
}

export type ProductList = PaginatedList & {
  __typename?: 'ProductList';
  items: Product[];
  totalItems: Scalars['Int'];
};

export interface ProductListOptions {
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
}

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
  translations: ProductOptionTranslation[];
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
  options: ProductOption[];
  translations: ProductOptionGroupTranslation[];
  updatedAt: Scalars['DateTime'];
};

export interface ProductOptionGroupTranslation {
  __typename?: 'ProductOptionGroupTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

export interface ProductOptionTranslation {
  __typename?: 'ProductOptionTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

export interface ProductSortParameter {
  createdAt?: InputMaybe<SortOrder>;
  description?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  slug?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
}

export interface ProductTranslation {
  __typename?: 'ProductTranslation';
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  slug: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

export type ProductVariant = Node & {
  __typename?: 'ProductVariant';
  assets: Asset[];
  createdAt: Scalars['DateTime'];
  currencyCode: CurrencyCode;
  customFields?: Maybe<Scalars['JSON']>;
  facetValues: FacetValue[];
  featuredAsset?: Maybe<Asset>;
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  options: ProductOption[];
  price: Scalars['Money'];
  priceWithTax: Scalars['Money'];
  product: Product;
  productId: Scalars['ID'];
  sku: Scalars['String'];
  stockLevel: Scalars['String'];
  taxCategory: TaxCategory;
  taxRateApplied: TaxRate;
  translations: ProductVariantTranslation[];
  updatedAt: Scalars['DateTime'];
};

export interface ProductVariantFilterParameter {
  createdAt?: InputMaybe<DateOperators>;
  currencyCode?: InputMaybe<StringOperators>;
  id?: InputMaybe<IdOperators>;
  languageCode?: InputMaybe<StringOperators>;
  name?: InputMaybe<StringOperators>;
  price?: InputMaybe<NumberOperators>;
  priceWithTax?: InputMaybe<NumberOperators>;
  productId?: InputMaybe<IdOperators>;
  sku?: InputMaybe<StringOperators>;
  stockLevel?: InputMaybe<StringOperators>;
  updatedAt?: InputMaybe<DateOperators>;
}

export type ProductVariantList = PaginatedList & {
  __typename?: 'ProductVariantList';
  items: ProductVariant[];
  totalItems: Scalars['Int'];
};

export interface ProductVariantListOptions {
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
}

export interface ProductVariantSortParameter {
  createdAt?: InputMaybe<SortOrder>;
  id?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  price?: InputMaybe<SortOrder>;
  priceWithTax?: InputMaybe<SortOrder>;
  productId?: InputMaybe<SortOrder>;
  sku?: InputMaybe<SortOrder>;
  stockLevel?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
}

export interface ProductVariantTranslation {
  __typename?: 'ProductVariantTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

export type Promotion = Node & {
  __typename?: 'Promotion';
  actions: ConfigurableOperation[];
  conditions: ConfigurableOperation[];
  couponCode?: Maybe<Scalars['String']>;
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  enabled: Scalars['Boolean'];
  endsAt?: Maybe<Scalars['DateTime']>;
  id: Scalars['ID'];
  name: Scalars['String'];
  perCustomerUsageLimit?: Maybe<Scalars['Int']>;
  startsAt?: Maybe<Scalars['DateTime']>;
  translations: PromotionTranslation[];
  updatedAt: Scalars['DateTime'];
};

export type PromotionList = PaginatedList & {
  __typename?: 'PromotionList';
  items: Promotion[];
  totalItems: Scalars['Int'];
};

export interface PromotionTranslation {
  __typename?: 'PromotionTranslation';
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

export type Province = Node &
  Region & {
    __typename?: 'Province';
    code: Scalars['String'];
    createdAt: Scalars['DateTime'];
    customFields?: Maybe<Scalars['JSON']>;
    enabled: Scalars['Boolean'];
    id: Scalars['ID'];
    languageCode: LanguageCode;
    name: Scalars['String'];
    parent?: Maybe<Region>;
    parentId?: Maybe<Scalars['ID']>;
    translations: RegionTranslation[];
    type: Scalars['String'];
    updatedAt: Scalars['DateTime'];
  };

export type ProvinceList = PaginatedList & {
  __typename?: 'ProvinceList';
  items: Province[];
  totalItems: Scalars['Int'];
};

export interface Query {
  __typename?: 'Query';
  /** The active Channel */
  activeChannel: Channel;
  /** The active Customer */
  activeCustomer?: Maybe<Customer>;
  /**
   * The active Order. Will be `null` until an Order is created via `addItemToOrder`. Once an Order reaches the
   * state of `PaymentAuthorized` or `PaymentSettled`, then that Order is no longer considered "active" and this
   * query will once again return `null`.
   */
  activeOrder?: Maybe<Order>;
  /** An array of supported Countries */
  availableCountries: Country[];
  /** Returns a Collection either by its id or slug. If neither 'id' nor 'slug' is specified, an error will result. */
  collection?: Maybe<Collection>;
  /** A list of Collections available to the shop */
  collections: CollectionList;
  /** Returns a list of payment methods and their eligibility based on the current active Order */
  eligiblePaymentMethods: PaymentMethodQuote[];
  /** Returns a list of eligible shipping methods based on the current active Order */
  eligibleShippingMethods: ShippingMethodQuote[];
  /** Returns a Facet by its id */
  facet?: Maybe<Facet>;
  /** A list of Facets available to the shop */
  facets: FacetList;
  /** Returns information about the current authenticated User */
  me?: Maybe<CurrentUser>;
  /** Returns the possible next states that the activeOrder can transition to */
  nextOrderStates: Array<Scalars['String']>;
  /**
   * Returns an Order based on the id. Note that in the Shop API, only orders belonging to the
   * currently-authenticated User may be queried.
   */
  order?: Maybe<Order>;
  /**
   * Returns an Order based on the order `code`. For guest Orders (i.e. Orders placed by non-authenticated Customers)
   * this query will only return the Order within 2 hours of the Order being placed. This allows an Order confirmation
   * screen to be shown immediately after completion of a guest checkout, yet prevents security risks of allowing
   * general anonymous access to Order data.
   */
  orderByCode?: Maybe<Order>;
  /** Get a Product either by id or slug. If neither 'id' nor 'slug' is specified, an error will result. */
  product?: Maybe<Product>;
  /** Get a list of Products */
  products: ProductList;
  /** Search Products based on the criteria set by the `SearchInput` */
  search: SearchResponse;
}

export interface QueryCollectionArgs {
  id?: InputMaybe<Scalars['ID']>;
  slug?: InputMaybe<Scalars['String']>;
}

export interface QueryCollectionsArgs {
  options?: InputMaybe<CollectionListOptions>;
}

export interface QueryFacetArgs {
  id: Scalars['ID'];
}

export interface QueryFacetsArgs {
  options?: InputMaybe<FacetListOptions>;
}

export interface QueryOrderArgs {
  id: Scalars['ID'];
}

export interface QueryOrderByCodeArgs {
  code: Scalars['String'];
}

export interface QueryProductArgs {
  id?: InputMaybe<Scalars['ID']>;
  slug?: InputMaybe<Scalars['String']>;
}

export interface QueryProductsArgs {
  options?: InputMaybe<ProductListOptions>;
}

export interface QuerySearchArgs {
  input: SearchInput;
}

export type RefreshCustomerVerificationResult =
  | NativeAuthStrategyError
  | Success;

export type Refund = Node & {
  __typename?: 'Refund';
  adjustment: Scalars['Money'];
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  items: Scalars['Money'];
  lines: RefundLine[];
  metadata?: Maybe<Scalars['JSON']>;
  method?: Maybe<Scalars['String']>;
  paymentId: Scalars['ID'];
  reason?: Maybe<Scalars['String']>;
  shipping: Scalars['Money'];
  state: Scalars['String'];
  total: Scalars['Money'];
  transactionId?: Maybe<Scalars['String']>;
  updatedAt: Scalars['DateTime'];
};

export interface RefundLine {
  __typename?: 'RefundLine';
  orderLine: OrderLine;
  orderLineId: Scalars['ID'];
  quantity: Scalars['Int'];
  refund: Refund;
  refundId: Scalars['ID'];
}

export interface Region {
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  enabled: Scalars['Boolean'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  parent?: Maybe<Region>;
  parentId?: Maybe<Scalars['ID']>;
  translations: RegionTranslation[];
  type: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

export interface RegionTranslation {
  __typename?: 'RegionTranslation';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

export type RegisterCustomerAccountResult =
  | MissingPasswordError
  | NativeAuthStrategyError
  | PasswordValidationError
  | Success;

export interface RegisterCustomerInput {
  emailAddress: Scalars['String'];
  firstName?: InputMaybe<Scalars['String']>;
  lastName?: InputMaybe<Scalars['String']>;
  password?: InputMaybe<Scalars['String']>;
  phoneNumber?: InputMaybe<Scalars['String']>;
  title?: InputMaybe<Scalars['String']>;
}

export type RelationCustomFieldConfig = CustomField & {
  __typename?: 'RelationCustomFieldConfig';
  description?: Maybe<LocalizedString[]>;
  entity: Scalars['String'];
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<LocalizedString[]>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  scalarFields: Array<Scalars['String']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type RemoveOrderItemsResult = Order | OrderModificationError;

export type RequestPasswordResetResult = NativeAuthStrategyError | Success;

export type RequestUpdateCustomerEmailAddressResult =
  | EmailAddressConflictError
  | InvalidCredentialsError
  | NativeAuthStrategyError
  | Success;

export type ResetPasswordResult =
  | CurrentUser
  | NativeAuthStrategyError
  | NotVerifiedError
  | PasswordResetTokenExpiredError
  | PasswordResetTokenInvalidError
  | PasswordValidationError;

export type Role = Node & {
  __typename?: 'Role';
  channels: Channel[];
  code: Scalars['String'];
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  permissions: Permission[];
  updatedAt: Scalars['DateTime'];
};

export type RoleList = PaginatedList & {
  __typename?: 'RoleList';
  items: Role[];
  totalItems: Scalars['Int'];
};

export interface SearchInput {
  collectionId?: InputMaybe<Scalars['ID']>;
  collectionSlug?: InputMaybe<Scalars['String']>;
  facetValueFilters?: InputMaybe<FacetValueFilterInput[]>;
  groupByProduct?: InputMaybe<Scalars['Boolean']>;
  skip?: InputMaybe<Scalars['Int']>;
  sort?: InputMaybe<SearchResultSortParameter>;
  take?: InputMaybe<Scalars['Int']>;
  term?: InputMaybe<Scalars['String']>;
}

export interface SearchReindexResponse {
  __typename?: 'SearchReindexResponse';
  success: Scalars['Boolean'];
}

export interface SearchResponse {
  __typename?: 'SearchResponse';
  collections: CollectionResult[];
  facetValues: FacetValueResult[];
  items: SearchResult[];
  totalItems: Scalars['Int'];
}

export interface SearchResult {
  __typename?: 'SearchResult';
  /** An array of ids of the Collections in which this result appears */
  collectionIds: Array<Scalars['ID']>;
  currencyCode: CurrencyCode;
  description: Scalars['String'];
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
}

export interface SearchResultAsset {
  __typename?: 'SearchResultAsset';
  focalPoint?: Maybe<Coordinate>;
  id: Scalars['ID'];
  preview: Scalars['String'];
}

/** The price of a search result product, either as a range or as a single price */
export type SearchResultPrice = PriceRange | SinglePrice;

export interface SearchResultSortParameter {
  name?: InputMaybe<SortOrder>;
  price?: InputMaybe<SortOrder>;
}

export type Seller = Node & {
  __typename?: 'Seller';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export type SetCustomerForOrderResult =
  | AlreadyLoggedInError
  | EmailAddressConflictError
  | GuestCheckoutError
  | NoActiveOrderError
  | Order;

export type SetOrderShippingMethodResult =
  | IneligibleShippingMethodError
  | NoActiveOrderError
  | Order
  | OrderModificationError;

export interface ShippingLine {
  __typename?: 'ShippingLine';
  discountedPrice: Scalars['Money'];
  discountedPriceWithTax: Scalars['Money'];
  discounts: Discount[];
  id: Scalars['ID'];
  price: Scalars['Money'];
  priceWithTax: Scalars['Money'];
  shippingMethod: ShippingMethod;
}

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
  translations: ShippingMethodTranslation[];
  updatedAt: Scalars['DateTime'];
};

export type ShippingMethodList = PaginatedList & {
  __typename?: 'ShippingMethodList';
  items: ShippingMethod[];
  totalItems: Scalars['Int'];
};

export interface ShippingMethodQuote {
  __typename?: 'ShippingMethodQuote';
  code: Scalars['String'];
  customFields?: Maybe<Scalars['JSON']>;
  description: Scalars['String'];
  id: Scalars['ID'];
  /** Any optional metadata returned by the ShippingCalculator in the ShippingCalculationResult */
  metadata?: Maybe<Scalars['JSON']>;
  name: Scalars['String'];
  price: Scalars['Money'];
  priceWithTax: Scalars['Money'];
}

export interface ShippingMethodTranslation {
  __typename?: 'ShippingMethodTranslation';
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  languageCode: LanguageCode;
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
}

/** The price value where the result has a single price */
export interface SinglePrice {
  __typename?: 'SinglePrice';
  value: Scalars['Money'];
}

export enum SortOrder {
  Asc = 'ASC',
  Desc = 'DESC',
}

export type StringCustomFieldConfig = CustomField & {
  __typename?: 'StringCustomFieldConfig';
  description?: Maybe<LocalizedString[]>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<LocalizedString[]>;
  length?: Maybe<Scalars['Int']>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  options?: Maybe<StringFieldOption[]>;
  pattern?: Maybe<Scalars['String']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export interface StringFieldOption {
  __typename?: 'StringFieldOption';
  label?: Maybe<LocalizedString[]>;
  value: Scalars['String'];
}

/** Operators for filtering on a list of String fields */
export interface StringListOperators {
  inList: Scalars['String'];
}

/** Operators for filtering on a String field */
export interface StringOperators {
  contains?: InputMaybe<Scalars['String']>;
  eq?: InputMaybe<Scalars['String']>;
  in?: InputMaybe<Array<Scalars['String']>>;
  isNull?: InputMaybe<Scalars['Boolean']>;
  notContains?: InputMaybe<Scalars['String']>;
  notEq?: InputMaybe<Scalars['String']>;
  notIn?: InputMaybe<Array<Scalars['String']>>;
  regex?: InputMaybe<Scalars['String']>;
}

/** Indicates that an operation succeeded, where we do not want to return any more specific information. */
export interface Success {
  __typename?: 'Success';
  success: Scalars['Boolean'];
}

export type Surcharge = Node & {
  __typename?: 'Surcharge';
  createdAt: Scalars['DateTime'];
  description: Scalars['String'];
  id: Scalars['ID'];
  price: Scalars['Money'];
  priceWithTax: Scalars['Money'];
  sku?: Maybe<Scalars['String']>;
  taxLines: TaxLine[];
  taxRate: Scalars['Float'];
  updatedAt: Scalars['DateTime'];
};

export type Tag = Node & {
  __typename?: 'Tag';
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  updatedAt: Scalars['DateTime'];
  value: Scalars['String'];
};

export type TagList = PaginatedList & {
  __typename?: 'TagList';
  items: Tag[];
  totalItems: Scalars['Int'];
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

export interface TaxLine {
  __typename?: 'TaxLine';
  description: Scalars['String'];
  taxRate: Scalars['Float'];
}

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

export type TaxRateList = PaginatedList & {
  __typename?: 'TaxRateList';
  items: TaxRate[];
  totalItems: Scalars['Int'];
};

export type TextCustomFieldConfig = CustomField & {
  __typename?: 'TextCustomFieldConfig';
  description?: Maybe<LocalizedString[]>;
  internal?: Maybe<Scalars['Boolean']>;
  label?: Maybe<LocalizedString[]>;
  list: Scalars['Boolean'];
  name: Scalars['String'];
  nullable?: Maybe<Scalars['Boolean']>;
  readonly?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
  ui?: Maybe<Scalars['JSON']>;
};

export type TransitionOrderToStateResult = Order | OrderStateTransitionError;

export interface UpdateAddressInput {
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
}

export type UpdateCustomerEmailAddressResult =
  | IdentifierChangeTokenExpiredError
  | IdentifierChangeTokenInvalidError
  | NativeAuthStrategyError
  | Success;

export interface UpdateCustomerInput {
  customFields?: InputMaybe<Scalars['JSON']>;
  firstName?: InputMaybe<Scalars['String']>;
  lastName?: InputMaybe<Scalars['String']>;
  phoneNumber?: InputMaybe<Scalars['String']>;
  title?: InputMaybe<Scalars['String']>;
}

export type UpdateCustomerPasswordResult =
  | InvalidCredentialsError
  | NativeAuthStrategyError
  | PasswordValidationError
  | Success;

export interface UpdateOrderInput {
  customFields?: InputMaybe<Scalars['JSON']>;
}

export type UpdateOrderItemsResult =
  | InsufficientStockError
  | NegativeQuantityError
  | Order
  | OrderLimitError
  | OrderModificationError;

export type User = Node & {
  __typename?: 'User';
  authenticationMethods: AuthenticationMethod[];
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  identifier: Scalars['String'];
  lastLogin?: Maybe<Scalars['DateTime']>;
  roles: Role[];
  updatedAt: Scalars['DateTime'];
  verified: Scalars['Boolean'];
};

/**
 * Returned if the verification token (used to verify a Customer's email address) is valid, but has
 * expired according to the `verificationTokenDuration` setting in the AuthOptions.
 */
export type VerificationTokenExpiredError = ErrorResult & {
  __typename?: 'VerificationTokenExpiredError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

/**
 * Returned if the verification token (used to verify a Customer's email address) is either
 * invalid or does not match any expected tokens.
 */
export type VerificationTokenInvalidError = ErrorResult & {
  __typename?: 'VerificationTokenInvalidError';
  errorCode: ErrorCode;
  message: Scalars['String'];
};

export type VerifyCustomerAccountResult =
  | CurrentUser
  | MissingPasswordError
  | NativeAuthStrategyError
  | PasswordAlreadySetError
  | PasswordValidationError
  | VerificationTokenExpiredError
  | VerificationTokenInvalidError;

export type Zone = Node & {
  __typename?: 'Zone';
  createdAt: Scalars['DateTime'];
  customFields?: Maybe<Scalars['JSON']>;
  id: Scalars['ID'];
  members: Region[];
  name: Scalars['String'];
  updatedAt: Scalars['DateTime'];
};

export interface AdditionalOrderFieldsFragment {
  __typename?: 'Order';
  id: number | string;
}

export interface ActiveOrderFieldsFragment {
  __typename?: 'Order';
  id: number | string;
  code: string;
  state: string;
  active: boolean;
  total: any;
  totalWithTax: any;
  subTotal: any;
  subTotalWithTax: any;
  shippingWithTax: any;
  totalQuantity: number;
  shipping: any;
  couponCodes: string[];
  customer?:
    | {
        __typename?: 'Customer';
        id: number | string;
        firstName: string;
        lastName: string;
        phoneNumber?: string | undefined;
        emailAddress: string;
      }
    | undefined;
  shippingAddress?:
    | {
        __typename?: 'OrderAddress';
        fullName?: string | undefined;
        company?: string | undefined;
        streetLine1?: string | undefined;
        streetLine2?: string | undefined;
        city?: string | undefined;
        postalCode?: string | undefined;
        country?: string | undefined;
        countryCode?: string | undefined;
      }
    | undefined;
  billingAddress?:
    | {
        __typename?: 'OrderAddress';
        fullName?: string | undefined;
        company?: string | undefined;
        streetLine1?: string | undefined;
        streetLine2?: string | undefined;
        city?: string | undefined;
        postalCode?: string | undefined;
        country?: string | undefined;
        countryCode?: string | undefined;
      }
    | undefined;
  shippingLines: Array<{
    __typename?: 'ShippingLine';
    priceWithTax: any;
    shippingMethod: {
      __typename?: 'ShippingMethod';
      id: number | string;
      code: string;
      name: string;
    };
  }>;
  lines: Array<{
    __typename?: 'OrderLine';
    id: number | string;
    quantity: number;
    linePriceWithTax: any;
    featuredAsset?:
      | { __typename?: 'Asset'; id: number | string; preview: string }
      | undefined;
    productVariant: {
      __typename?: 'ProductVariant';
      id: number | string;
      sku: string;
      name: string;
      priceWithTax: any;
      product: {
        __typename?: 'Product';
        id: number | string;
        name: string;
        slug: string;
      };
    };
  }>;
  taxSummary: Array<{
    __typename?: 'OrderTaxSummary';
    taxRate: number;
    taxTotal: any;
    taxBase: any;
  }>;
  payments?:
    | Array<{
        __typename?: 'Payment';
        id: number | string;
        state: string;
        errorMessage?: string | undefined;
        metadata?: any | undefined;
        method: string;
      }>
    | undefined;
  discounts: Array<{
    __typename?: 'Discount';
    description: string;
    amountWithTax: any;
  }>;
}

export interface CurrentUserFieldsFragment {
  __typename?: 'CurrentUser';
  id: number | string;
  identifier: string;
  channels: Array<{
    __typename?: 'CurrentUserChannel';
    code: string;
    token: string;
    permissions: Permission[];
  }>;
}

export type AdditemToOrderMutationVariables = Exact<{
  productVariantId: Scalars['ID'];
  quantity: Scalars['Int'];
}>;

export interface AdditemToOrderMutation {
  __typename?: 'Mutation';
  addItemToOrder:
    | {
        __typename?: 'InsufficientStockError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'NegativeQuantityError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      }
    | { __typename?: 'OrderLimitError'; errorCode: ErrorCode; message: string }
    | {
        __typename?: 'OrderModificationError';
        errorCode: ErrorCode;
        message: string;
      };
}

export type AdjustOrderLineMutationVariables = Exact<{
  orderLineId: Scalars['ID'];
  quantity: Scalars['Int'];
}>;

export interface AdjustOrderLineMutation {
  __typename?: 'Mutation';
  adjustOrderLine:
    | {
        __typename?: 'InsufficientStockError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'NegativeQuantityError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      }
    | { __typename?: 'OrderLimitError'; errorCode: ErrorCode; message: string }
    | {
        __typename?: 'OrderModificationError';
        errorCode: ErrorCode;
        message: string;
      };
}

export type RemoveAllOrderLinesMutationVariables = Exact<Record<string, never>>;

export interface RemoveAllOrderLinesMutation {
  __typename?: 'Mutation';
  removeAllOrderLines:
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      }
    | {
        __typename?: 'OrderModificationError';
        errorCode: ErrorCode;
        message: string;
      };
}

export type ActiveOrderQueryVariables = Exact<Record<string, never>>;

export interface ActiveOrderQuery {
  __typename?: 'Query';
  activeOrder?:
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      }
    | undefined;
}

export type ApplyCouponCodeMutationVariables = Exact<{
  couponCode: Scalars['String'];
}>;

export interface ApplyCouponCodeMutation {
  __typename?: 'Mutation';
  applyCouponCode:
    | {
        __typename?: 'CouponCodeExpiredError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'CouponCodeInvalidError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'CouponCodeLimitError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      };
}

export type RemoveCouponCodeMutationVariables = Exact<{
  couponCode: Scalars['String'];
}>;

export interface RemoveCouponCodeMutation {
  __typename?: 'Mutation';
  removeCouponCode?:
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      }
    | undefined;
}

export type SetCustomerForOrderMutationVariables = Exact<{
  input: CreateCustomerInput;
}>;

export interface SetCustomerForOrderMutation {
  __typename?: 'Mutation';
  setCustomerForOrder:
    | {
        __typename?: 'AlreadyLoggedInError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'EmailAddressConflictError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'GuestCheckoutError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'NoActiveOrderError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      };
}

export type SetOrderShippingAddressMutationVariables = Exact<{
  input: CreateAddressInput;
}>;

export interface SetOrderShippingAddressMutation {
  __typename?: 'Mutation';
  setOrderShippingAddress:
    | {
        __typename?: 'NoActiveOrderError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      };
}

export type SetOrderBillingAddressMutationVariables = Exact<{
  input: CreateAddressInput;
}>;

export interface SetOrderBillingAddressMutation {
  __typename?: 'Mutation';
  setOrderBillingAddress:
    | {
        __typename?: 'NoActiveOrderError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      };
}

export type SetOrderShippingMethodMutationVariables = Exact<{
  shippingMethodId: Array<Scalars['ID']> | Scalars['ID'];
}>;

export interface SetOrderShippingMethodMutation {
  __typename?: 'Mutation';
  setOrderShippingMethod:
    | {
        __typename?: 'IneligibleShippingMethodError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'NoActiveOrderError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      }
    | {
        __typename?: 'OrderModificationError';
        errorCode: ErrorCode;
        message: string;
      };
}

export type AddPaymentToOrderMutationVariables = Exact<{
  input: PaymentInput;
}>;

export interface AddPaymentToOrderMutation {
  __typename?: 'Mutation';
  addPaymentToOrder:
    | {
        __typename?: 'IneligiblePaymentMethodError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'NoActiveOrderError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      }
    | {
        __typename?: 'OrderPaymentStateError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'OrderStateTransitionError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'PaymentDeclinedError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'PaymentFailedError';
        errorCode: ErrorCode;
        message: string;
      };
}

export type TransitionOrderToStateMutationVariables = Exact<{
  state: Scalars['String'];
}>;

export interface TransitionOrderToStateMutation {
  __typename?: 'Mutation';
  transitionOrderToState?:
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      }
    | {
        __typename?: 'OrderStateTransitionError';
        errorCode: ErrorCode;
        message: string;
      }
    | undefined;
}

export type GetOrderByCodeQueryVariables = Exact<{
  code: Scalars['String'];
}>;

export interface GetOrderByCodeQuery {
  __typename?: 'Query';
  orderByCode?:
    | {
        __typename?: 'Order';
        id: number | string;
        code: string;
        state: string;
        active: boolean;
        total: any;
        totalWithTax: any;
        subTotal: any;
        subTotalWithTax: any;
        shippingWithTax: any;
        totalQuantity: number;
        shipping: any;
        couponCodes: string[];
        customer?:
          | {
              __typename?: 'Customer';
              id: number | string;
              firstName: string;
              lastName: string;
              phoneNumber?: string | undefined;
              emailAddress: string;
            }
          | undefined;
        shippingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        billingAddress?:
          | {
              __typename?: 'OrderAddress';
              fullName?: string | undefined;
              company?: string | undefined;
              streetLine1?: string | undefined;
              streetLine2?: string | undefined;
              city?: string | undefined;
              postalCode?: string | undefined;
              country?: string | undefined;
              countryCode?: string | undefined;
            }
          | undefined;
        shippingLines: Array<{
          __typename?: 'ShippingLine';
          priceWithTax: any;
          shippingMethod: {
            __typename?: 'ShippingMethod';
            id: number | string;
            code: string;
            name: string;
          };
        }>;
        lines: Array<{
          __typename?: 'OrderLine';
          id: number | string;
          quantity: number;
          linePriceWithTax: any;
          featuredAsset?:
            | { __typename?: 'Asset'; id: number | string; preview: string }
            | undefined;
          productVariant: {
            __typename?: 'ProductVariant';
            id: number | string;
            sku: string;
            name: string;
            priceWithTax: any;
            product: {
              __typename?: 'Product';
              id: number | string;
              name: string;
              slug: string;
            };
          };
        }>;
        taxSummary: Array<{
          __typename?: 'OrderTaxSummary';
          taxRate: number;
          taxTotal: any;
          taxBase: any;
        }>;
        payments?:
          | Array<{
              __typename?: 'Payment';
              id: number | string;
              state: string;
              errorMessage?: string | undefined;
              metadata?: any | undefined;
              method: string;
            }>
          | undefined;
        discounts: Array<{
          __typename?: 'Discount';
          description: string;
          amountWithTax: any;
        }>;
      }
    | undefined;
}

export type RegisterCustomerAccountMutationVariables = Exact<{
  input: RegisterCustomerInput;
}>;

export interface RegisterCustomerAccountMutation {
  __typename?: 'Mutation';
  registerCustomerAccount:
    | {
        __typename?: 'MissingPasswordError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'NativeAuthStrategyError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'PasswordValidationError';
        errorCode: ErrorCode;
        message: string;
        validationErrorMessage: string;
      }
    | { __typename?: 'Success'; success: boolean };
}

export type RequestPasswordResetMutationVariables = Exact<{
  emailAddress: Scalars['String'];
}>;

export interface RequestPasswordResetMutation {
  __typename?: 'Mutation';
  requestPasswordReset?:
    | {
        __typename?: 'NativeAuthStrategyError';
        errorCode: ErrorCode;
        message: string;
      }
    | { __typename?: 'Success'; success: boolean }
    | undefined;
}

export type ResetPasswordMutationVariables = Exact<{
  token: Scalars['String'];
  password: Scalars['String'];
}>;

export interface ResetPasswordMutation {
  __typename?: 'Mutation';
  resetPassword:
    | {
        __typename?: 'CurrentUser';
        id: number | string;
        identifier: string;
        channels: Array<{
          __typename?: 'CurrentUserChannel';
          code: string;
          token: string;
          permissions: Permission[];
        }>;
      }
    | {
        __typename?: 'NativeAuthStrategyError';
        errorCode: ErrorCode;
        message: string;
      }
    | { __typename?: 'NotVerifiedError'; errorCode: ErrorCode; message: string }
    | {
        __typename?: 'PasswordResetTokenExpiredError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'PasswordResetTokenInvalidError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'PasswordValidationError';
        errorCode: ErrorCode;
        message: string;
        validationErrorMessage: string;
      };
}

export type LoginMutationVariables = Exact<{
  username: Scalars['String'];
  password: Scalars['String'];
  rememberMe?: InputMaybe<Scalars['Boolean']>;
}>;

export interface LoginMutation {
  __typename?: 'Mutation';
  login:
    | {
        __typename?: 'CurrentUser';
        id: number | string;
        identifier: string;
        channels: Array<{
          __typename?: 'CurrentUserChannel';
          code: string;
          token: string;
          permissions: Permission[];
        }>;
      }
    | {
        __typename?: 'InvalidCredentialsError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'NativeAuthStrategyError';
        errorCode: ErrorCode;
        message: string;
      }
    | {
        __typename?: 'NotVerifiedError';
        errorCode: ErrorCode;
        message: string;
      };
}
