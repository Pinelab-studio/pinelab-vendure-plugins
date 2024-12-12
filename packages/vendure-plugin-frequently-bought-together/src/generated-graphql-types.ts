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
};

/**
 * An item set with a support value.
 * An item set is a combination of products which are frequently bought together, e.g. ['product-1', 'product-2', 'product-3']
 * Support is the number of orders this combination was in
 */
export type FrequentlyBoughtTogetherItemSet = {
  __typename?: 'FrequentlyBoughtTogetherItemSet';
  items: Array<Scalars['String']>;
  support: Scalars['Int'];
};

export type FrequentlyBoughtTogetherPreview = {
  __typename?: 'FrequentlyBoughtTogetherPreview';
  /** The item sets with the most support */
  bestItemSets: Array<FrequentlyBoughtTogetherItemSet>;
  /**
   * The max memory used during the calculation.
   * Make sure this doesn't exceed your worker's memory limit.
   * process.memoryUsage().rss is used to calculate this.
   */
  maxMemoryUsedInMB: Scalars['Int'];
  /** The total number of sets found. */
  totalItemSets: Scalars['Int'];
  /** The number of unique products for which a related product was found */
  uniqueProducts: Scalars['Int'];
  /** The item sets with the worst support. If these make sense, the others probably do too. */
  worstItemSets: Array<FrequentlyBoughtTogetherItemSet>;
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Trigger the job to calculate and set frequently bought together products. */
  triggerFrequentlyBoughtTogetherCalculation: Scalars['Boolean'];
};

export type Product = {
  __typename?: 'Product';
  frequentlyBoughtWith: Array<Product>;
};

export type Query = {
  __typename?: 'Query';
  /**
   * Preview the frequently bought together item sets,
   * to check what level of support is reasonable for your data set
   */
  previewFrequentlyBoughtTogether: FrequentlyBoughtTogetherPreview;
};

export type QueryPreviewFrequentlyBoughtTogetherArgs = {
  support: Scalars['Float'];
};
