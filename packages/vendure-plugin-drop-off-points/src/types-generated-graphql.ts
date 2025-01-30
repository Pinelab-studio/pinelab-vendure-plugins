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
  ID: number | string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  Order: any;
};

export type ParcelDropOffPoint = {
  __typename?: 'ParcelDropOffPoint';
  city: Scalars['String'];
  country: Scalars['String'];
  cutOffTime?: Maybe<Scalars['String']>;
  distanceInKm?: Maybe<Scalars['Float']>;
  houseNumber: Scalars['String'];
  id: Scalars['ID'];
  latitude?: Maybe<Scalars['Float']>;
  longitude?: Maybe<Scalars['Float']>;
  name: Scalars['String'];
  postalCode: Scalars['String'];
  streetLine1: Scalars['String'];
  streetLine2?: Maybe<Scalars['String']>;
};

export type ParcelDropOffPointSearchInput = {
  /** Specify the carrier to search for. E.g. PostNL, DHL etc */
  carrier: Scalars['String'];
  houseNumber?: InputMaybe<Scalars['String']>;
  postalCode: Scalars['String'];
};

export type Query = {
  __typename?: 'Query';
  parcelDropOffPoints: Array<Maybe<ParcelDropOffPoint>>;
  setDropOffPoints: Scalars['Order'];
  unsetDropOffPoints: Scalars['Order'];
};

export type QueryParcelDropOffPointsArgs = {
  input?: InputMaybe<ParcelDropOffPointSearchInput>;
};

export type QuerySetDropOffPointsArgs = {
  id: Scalars['ID'];
};
