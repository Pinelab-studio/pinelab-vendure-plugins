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

export type Mutation = {
  __typename?: 'Mutation';
  runGoedgepicktFullSync?: Maybe<Scalars['Boolean']>;
  updateGoedgepicktConfig?: Maybe<GoedgepicktConfigUpdateResult>;
};

export type MutationUpdateGoedgepicktConfigArgs = {
  input: GoedgepicktConfigInput;
};

export type Query = {
  __typename?: 'Query';
  goedgepicktConfig?: Maybe<GoedgepicktConfig>;
};

export type UpdateGoedgepicktConfigMutationVariables = Exact<{
  input: GoedgepicktConfigInput;
}>;

export type UpdateGoedgepicktConfigMutation = {
  __typename?: 'Mutation';
  updateGoedgepicktConfig?:
    | {
        __typename?: 'GoedgepicktConfig';
        enabled?: boolean | null;
        apiKey?: string | null;
        webshopUuid?: string | null;
        autoFulfill?: boolean | null;
        orderWebhookKey?: string | null;
        orderWebhookUrl?: string | null;
        stockWebhookKey?: string | null;
        stockWebhookUrl?: string | null;
      }
    | { __typename?: 'GoedgepicktError'; message?: string | null }
    | null;
};

export type GoedgepicktConfigQueryVariables = Exact<{ [key: string]: never }>;

export type GoedgepicktConfigQuery = {
  __typename?: 'Query';
  goedgepicktConfig?: {
    __typename?: 'GoedgepicktConfig';
    enabled?: boolean | null;
    apiKey?: string | null;
    webshopUuid?: string | null;
    autoFulfill?: boolean | null;
    orderWebhookKey?: string | null;
    orderWebhookUrl?: string | null;
    stockWebhookKey?: string | null;
    stockWebhookUrl?: string | null;
  } | null;
};

export type RunGoedgepicktFullSyncMutationVariables = Exact<{
  [key: string]: never;
}>;

export type RunGoedgepicktFullSyncMutation = {
  __typename?: 'Mutation';
  runGoedgepicktFullSync?: boolean | null;
};
