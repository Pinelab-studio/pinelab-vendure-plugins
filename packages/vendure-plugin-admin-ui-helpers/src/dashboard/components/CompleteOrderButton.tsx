import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { api, getDetailQueryOptions, graphql } from '@vendure/dashboard';
import { toast } from 'sonner';
import { FulfillmentStateTransitionError } from '@vendure/common/lib/generated-types';

export const CONFIGURABLE_OPERATION_DEF_FRAGMENT = graphql(`
  fragment ConfigurableOperationDef on ConfigurableOperationDefinition {
    args {
      name
      type
      required
      defaultValue
      list
      ui
      label
      description
    }
    code
    description
  }
`);

export const GET_SHIPPING_METHOD_OPERATIONS = graphql(
  `
    query GetShippingMethodOperations {
      shippingEligibilityCheckers {
        ...ConfigurableOperationDef
      }
      shippingCalculators {
        ...ConfigurableOperationDef
      }
      fulfillmentHandlers {
        ...ConfigurableOperationDef
      }
    }
  `,
  [CONFIGURABLE_OPERATION_DEF_FRAGMENT]
);

export const orderDetailDocument = graphql(
  `
    query GetOrder($id: ID!) {
      order(id: $id) {
        id
        shippingLines {
          id
          shippingMethod {
            id
            fulfillmentHandlerCode
          }
        }
        fulfillments {
          id
        }
      }
    }
  `
);

export const CREATE_FULFILLMENT = graphql(`
  mutation CreateFulfillment($input: FulfillOrderInput!) {
    addFulfillmentToOrder(input: $input) {
      ... on Fulfillment {
        id
      }
      ... on CreateFulfillmentError {
        errorCode
        message
        fulfillmentHandlerError
      }
      ... on FulfillmentStateTransitionError {
        errorCode
        message
        transitionError
      }
    }
  }
`);

export const TRANSITION_FULFILLMENT_TO_STATE = graphql(`
  mutation TransitionFulfillmentToState($id: ID!, $state: String!) {
    transitionFulfillmentToState(id: $id, state: $state) {
      ... on Fulfillment {
        id
      }
      ... on FulfillmentStateTransitionError {
        transitionError
      }
      ... on ErrorResult {
        message
      }
    }
  }
`);

export function CompleteOrderButton({
  context,
}: {
  context: { entity?: any; route?: any };
}) {
  const { entity: order } = context;
  const queryClient = useQueryClient();

  const { refetch: refetchOrder } = useQuery({
    queryKey: ['GetOrder', { id: order.id }],
    queryFn: () => api.query(orderDetailDocument, { id: order.id }),
  });

  const { refetch: refetchShippingMethodOperations } = useQuery({
    queryKey: ['GetShippingMethodOperations'],
    queryFn: () => api.query(GET_SHIPPING_METHOD_OPERATIONS),
  });

  // Define mutations here once. They stay "primed" for use later.
  const createFulfillmentMutation = useMutation({
    mutationFn: (input: any) => api.mutate(CREATE_FULFILLMENT, { input }),
    onSuccess: async () => {
      const queryKey = getDetailQueryOptions(orderDetailDocument, {
        id: order.id,
      }).queryKey;
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: (vars: { id: string; state: string }) =>
      api.mutate(TRANSITION_FULFILLMENT_TO_STATE, vars),
    onSuccess: async () => {
      const queryKey = getDetailQueryOptions(orderDetailDocument, {
        id: order.id,
      }).queryKey;
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleComplete = async () => {
    try {
      if (!window.confirm('Are you sure? This can not be undone.')) {
        return;
      }
      const { data: hydratedOrder } = await refetchOrder();
      if (order.state === 'AddingItems') {
        return toast.error('Active orders cannot be completed.');
      }
      if (order.state === 'Delivered') {
        return toast.warning('Order is already Delivered.');
      }
      if (order.state === 'Cancelled') {
        return toast.error('Order is already Cancelled.');
      }
      if (order.state === 'PaymentSettled') {
        const { data: shippingOperationsDetail } =
          await refetchShippingMethodOperations();
        const handlerCode =
          hydratedOrder?.order?.shippingLines[0].shippingMethod
            .fulfillmentHandlerCode;
        const handler = (
          shippingOperationsDetail?.fulfillmentHandlers ?? []
        ).find((handler) => handler.code === handlerCode);
        if (!handler) {
          toast.error(`No handler found for ${handlerCode}`);
          return;
        }
        const args = handler.args.map((arg) => ({ name: arg.name, value: '' }));
        const createFullfilmentResponse =
          await createFulfillmentMutation.mutateAsync({
            handler: {
              code: handlerCode,
              arguments: args,
            },
            lines: order.lines.map((line: any) => ({
              quantity: line.quantity,
              orderLineId: String(line.id),
            })),
          });

        let fulfillmentId = (
          createFullfilmentResponse?.addFulfillmentToOrder as any
        )?.id;
        const creationError = createFullfilmentResponse?.addFulfillmentToOrder;
        if (creationError?.errorCode === 'ITEMS_ALREADY_FULFILLED_ERROR') {
          fulfillmentId = order.fulfillments?.[0].id;
        } else if (creationError.errorCode) {
          toast.error(
            `${creationError.errorCode} - ${creationError.transitionError}`
          );
          return;
        }
        const transitionFulfillmentToStateResponse =
          await transitionMutation.mutateAsync({
            id: fulfillmentId,
            state: 'Shipped',
          });

        const transitionError =
          transitionFulfillmentToStateResponse?.transitionFulfillmentToState as FulfillmentStateTransitionError;
        if (transitionError?.errorCode) {
          toast.error(
            `${transitionError.errorCode} - ${transitionError.transitionError}`
          );
        }
      }
      if (order.state === 'Shipped') {
        // await transitionToDelivered(dataService, getOrderResponse.order);
        const fulfillmentId = order.fulfillments?.[0].id;
        const transitionFulfillmentToStateResponse =
          await transitionMutation.mutateAsync({
            id: fulfillmentId,
            state: 'Delivered',
          });
        const transitionError =
          transitionFulfillmentToStateResponse?.transitionFulfillmentToState as FulfillmentStateTransitionError;
        if (
          transitionError?.errorCode?.indexOf('"Delivered" to "Delivered"') > -1
        ) {
          // this is ok
        } else if (transitionError.errorCode) {
          toast.error(
            `${transitionError.errorCode} - ${transitionError.transitionError}`
          );
          return;
        }
      }
      toast.success('Order completed');
    } catch (e: any) {
      toast.error(e.message);
      console.error(e);
    }
  };

  return (
    <button
      onClick={handleComplete}
      className="btn btn-outline btn-warning flex items-center gap-2"
      type="button"
    >
      <i className="icon times-circle" aria-hidden="true"></i>
      Complete
    </button>
  );
}
