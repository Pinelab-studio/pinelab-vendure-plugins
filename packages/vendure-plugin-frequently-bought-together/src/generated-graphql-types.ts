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

export type FrequentlyBoughtTogetherItemSet = {
  __typename?: 'FrequentlyBoughtTogetherItemSet';
  items?: Maybe<Array<Scalars['String']>>;
  support: Scalars['Float'];
};

export type FrequentlyBoughtTogetherPreview = {
  __typename?: 'FrequentlyBoughtTogetherPreview';
  bestItemSets: Array<FrequentlyBoughtTogetherItemSet>;
  memoryUsed: Scalars['String'];
  totalItemSets: Scalars['Int'];
  worstItemSets: Array<FrequentlyBoughtTogetherItemSet>;
};

export type Query = {
  __typename?: 'Query';
  previewFrequentlyBoughtTogether: FrequentlyBoughtTogetherPreview;
};

export type QueryPreviewFrequentlyBoughtTogetherArgs = {
  support: Scalars['Float'];
};
