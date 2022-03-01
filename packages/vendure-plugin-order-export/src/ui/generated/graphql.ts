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

export type OrderExportResult = {
  __typename?: 'OrderExportResult';
  createdAt?: Maybe<Scalars['DateTime']>;
  customerEmail?: Maybe<Scalars['String']>;
  /** Field that will be shown as anchor in UI */
  externalLink?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  /** Free text field for additional messages */
  message?: Maybe<Scalars['String']>;
  orderCode: Scalars['String'];
  orderId: Scalars['String'];
  orderPlacedAt?: Maybe<Scalars['DateTime']>;
  /** Reference to the external platform. For example the uuid of the exported order */
  reference?: Maybe<Scalars['String']>;
  /** Indicates whether the order has been successfully exported or not */
  successful?: Maybe<Scalars['Boolean']>;
  updatedAt?: Maybe<Scalars['DateTime']>;
};

export type OrderExportResultFilter = {
  itemsPerPage: Scalars['Int'];
  page: Scalars['Int'];
};

export type OrderExportResultList = {
  __typename?: 'OrderExportResultList';
  items: Array<OrderExportResult>;
  totalItems: Scalars['Int'];
};

export type Query = {
  __typename?: 'Query';
  orderExportConfigs: Array<OrderExportConfig>;
  orderExportResults: OrderExportResultList;
};

export type QueryOrderExportResultsArgs = {
  filter: OrderExportResultFilter;
};

export type OrderExportConfigsQueryVariables = Exact<{ [key: string]: never }>;

export type OrderExportConfigsQuery = {
  __typename?: 'Query';
  orderExportConfigs: Array<{
    __typename?: 'OrderExportConfig';
    name: string;
    arguments: Array<{
      __typename?: 'OrderExportArgument';
      name: string;
      value?: string | null;
    }>;
  }>;
};

export type OrderExportResultsQueryVariables = Exact<{
  filter: OrderExportResultFilter;
}>;

export type OrderExportResultsQuery = {
  __typename?: 'Query';
  orderExportResults: {
    __typename?: 'OrderExportResultList';
    totalItems: number;
    items: Array<{
      __typename?: 'OrderExportResult';
      id: string;
      createdAt?: any | null;
      updatedAt?: any | null;
      orderPlacedAt?: any | null;
      orderId: string;
      orderCode: string;
      customerEmail?: string | null;
      reference?: string | null;
      message?: string | null;
      externalLink?: string | null;
      successful?: boolean | null;
    }>;
  };
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
