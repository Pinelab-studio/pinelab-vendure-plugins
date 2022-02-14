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
  DateTime: any;
  JSON: any;
};

export type ExportedOrder = {
  __typename?: 'ExportedOrder';
  createdAt?: Maybe<Scalars['DateTime']>;
  /** Field that will be shown as anchor in UI */
  externalLink?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  /** Free text field for additional messages */
  message?: Maybe<Scalars['String']>;
  orderId: Scalars['String'];
  /** Reference to the external platform. For example the uuid of the exported order */
  reference?: Maybe<Scalars['String']>;
  /** Indicates whether the order has been successfully exported or not */
  successful: Scalars['Boolean'];
  updatedAt?: Maybe<Scalars['DateTime']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  updateOrderExportConfig: Array<OrderExportConfig>;
};

export type MutationUpdateOrderExportConfigArgs = {
  input: OrderExportConfigInput;
};

export type OrderExportArgument = {
  __typename?: 'OrderExportArgument';
  name: Scalars['String'];
  value?: Maybe<Scalars['String']>;
};

export type OrderExportArgumentInput = {
  name: Scalars['String'];
  value?: InputMaybe<Scalars['String']>;
};

export type OrderExportConfig = {
  __typename?: 'OrderExportConfig';
  arguments: Array<OrderExportArgument>;
  name: Scalars['ID'];
};

export type OrderExportConfigInput = {
  arguments: Array<OrderExportArgumentInput>;
  name: Scalars['String'];
};

export type Query = {
  __typename?: 'Query';
  allExportedOrders: Array<ExportedOrder>;
  allOrderExportConfigs: Array<OrderExportConfig>;
};

export type QueryAllExportedOrdersArgs = {
  filter?: InputMaybe<AllExportedOrdersFilter>;
};

export type AllExportedOrdersFilter = {
  limit?: InputMaybe<Scalars['Int']>;
  successful?: InputMaybe<Scalars['Boolean']>;
};

export type AllOrderExportConfigsQueryVariables = Exact<{
  [key: string]: never;
}>;

export type AllOrderExportConfigsQuery = {
  __typename?: 'Query';
  allOrderExportConfigs: Array<{
    __typename?: 'OrderExportConfig';
    name: string;
    arguments: Array<{
      __typename?: 'OrderExportArgument';
      name: string;
      value?: string | null;
    }>;
  }>;
};

export type GetFailedOrdersQueryVariables = Exact<{ [key: string]: never }>;

export type GetFailedOrdersQuery = {
  __typename?: 'Query';
  allExportedOrders: Array<{
    __typename?: 'ExportedOrder';
    id: string;
    createdAt?: any | null;
    updatedAt?: any | null;
    orderId: string;
    reference?: string | null;
    message?: string | null;
    externalLink?: string | null;
    successful: boolean;
  }>;
};

export type UpdateOrderExportConfigMutationVariables = Exact<{
  input: OrderExportConfigInput;
}>;

export type UpdateOrderExportConfigMutation = {
  __typename?: 'Mutation';
  updateOrderExportConfig: Array<{
    __typename?: 'OrderExportConfig';
    name: string;
    arguments: Array<{
      __typename?: 'OrderExportArgument';
      name: string;
      value?: string | null;
    }>;
  }>;
};
