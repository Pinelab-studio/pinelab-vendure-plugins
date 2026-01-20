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
  ID: number | string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type Mutation = {
  __typename?: 'Mutation';
  /** Set all webhooks for the current channel. This will overwrite any existing webhooks. */
  setWebhooks: Array<Webhook>;
};

export type MutationSetWebhooksArgs = {
  webhooks: Array<WebhookInput>;
};

export type Query = {
  __typename?: 'Query';
  /** Get all available Vendure events that can be used to trigger webhooks */
  availableWebhookEvents: Array<Scalars['String']>;
  /**
   * "
   * Get all available webhook request transformers
   */
  availableWebhookRequestTransformers: Array<WebhookRequestTransformer>;
  /** Get all webhooks for the current channel */
  webhooks: Array<Webhook>;
};

export type Webhook = {
  __typename?: 'Webhook';
  channelAgnostic: Scalars['Boolean'];
  event: Scalars['String'];
  id: Scalars['ID'];
  requestTransformer?: Maybe<WebhookRequestTransformer>;
  url: Scalars['String'];
};

export type WebhookInput = {
  channelAgnostic?: InputMaybe<Scalars['Boolean']>;
  event: Scalars['String'];
  transformerName?: InputMaybe<Scalars['String']>;
  url: Scalars['String'];
};

export type WebhookRequestTransformer = {
  __typename?: 'WebhookRequestTransformer';
  name: Scalars['String'];
  supportedEvents: Array<Scalars['String']>;
};

export type SetWebhooksMutationVariables = Exact<{
  webhooks: Array<WebhookInput> | WebhookInput;
}>;

export type SetWebhooksMutation = {
  __typename?: 'Mutation';
  setWebhooks: Array<{
    __typename?: 'Webhook';
    id: number | string;
    event: string;
    url: string;
    channelAgnostic: boolean;
    requestTransformer?: {
      __typename?: 'WebhookRequestTransformer';
      name: string;
      supportedEvents: Array<string>;
    } | null;
  }>;
};

export type WebhooksQueryVariables = Exact<{ [key: string]: never }>;

export type WebhooksQuery = {
  __typename?: 'Query';
  webhooks: Array<{
    __typename?: 'Webhook';
    id: number | string;
    event: string;
    url: string;
    channelAgnostic: boolean;
    requestTransformer?: {
      __typename?: 'WebhookRequestTransformer';
      name: string;
      supportedEvents: Array<string>;
    } | null;
  }>;
};

export type AvailableWebhookEventsQueryVariables = Exact<{
  [key: string]: never;
}>;

export type AvailableWebhookEventsQuery = {
  __typename?: 'Query';
  availableWebhookEvents: Array<string>;
};

export type AvailableWebhookRequestTransformersQueryVariables = Exact<{
  [key: string]: never;
}>;

export type AvailableWebhookRequestTransformersQuery = {
  __typename?: 'Query';
  availableWebhookRequestTransformers: Array<{
    __typename?: 'WebhookRequestTransformer';
    name: string;
    supportedEvents: Array<string>;
  }>;
};

export const SetWebhooks = gql`
  mutation setWebhooks($webhooks: [WebhookInput!]!) {
    setWebhooks(webhooks: $webhooks) {
      id
      event
      requestTransformer {
        name
        supportedEvents
      }
      url
      channelAgnostic
    }
  }
`;
export const Webhooks = gql`
  query webhooks {
    webhooks {
      id
      event
      requestTransformer {
        name
        supportedEvents
      }
      url
      channelAgnostic
    }
  }
`;
export const AvailableWebhookEvents = gql`
  query availableWebhookEvents {
    availableWebhookEvents
  }
`;
export const AvailableWebhookRequestTransformers = gql`
  query availableWebhookRequestTransformers {
    availableWebhookRequestTransformers {
      name
      supportedEvents
    }
  }
`;
