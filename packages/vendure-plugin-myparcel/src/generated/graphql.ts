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

export type Mutation = {
  __typename?: 'Mutation';
  updateMyparcelConfig?: Maybe<MyparcelConfig>;
};

export type MutationUpdateMyparcelConfigArgs = {
  input: MyparcelConfigInput;
};

export type MyparcelConfig = {
  __typename?: 'MyparcelConfig';
  apiKey?: Maybe<Scalars['String']>;
};

export type MyparcelConfigInput = {
  apiKey?: InputMaybe<Scalars['String']>;
};

export type MyparcelDropOffPoint = {
  __typename?: 'MyparcelDropOffPoint';
  available_days: Array<Scalars['Int']>;
  carrier_id?: Maybe<Scalars['Int']>;
  city: Scalars['String'];
  cut_off_time?: Maybe<Scalars['String']>;
  distance?: Maybe<Scalars['Int']>;
  latitude?: Maybe<Scalars['String']>;
  location_code: Scalars['String'];
  location_name: Scalars['String'];
  longitude?: Maybe<Scalars['String']>;
  number: Scalars['String'];
  number_suffix?: Maybe<Scalars['String']>;
  phone?: Maybe<Scalars['String']>;
  postal_code: Scalars['String'];
  reference?: Maybe<Scalars['String']>;
  street: Scalars['String'];
};

export type MyparcelDropOffPointInput = {
  carrierId?: InputMaybe<Scalars['String']>;
  countryCode?: InputMaybe<Scalars['String']>;
  postalCode: Scalars['String'];
};

export type Query = {
  __typename?: 'Query';
  myparcelConfig?: Maybe<MyparcelConfig>;
  myparcelDropOffPoints: Array<MyparcelDropOffPoint>;
};

export type QueryMyparcelDropOffPointsArgs = {
  input: MyparcelDropOffPointInput;
};
