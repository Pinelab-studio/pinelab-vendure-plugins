import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FulfillmentStateTransitionError } from '@vendure/common/lib/generated-types';
import { api, getDetailQueryOptions, graphql } from '@vendure/dashboard';
import { toast } from 'sonner';

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
  [CONFIGURABLE_OPERATION_DEF_FRAGMENT],
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
  `,
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

  /** Creates a fulfillment and ships the settled order, reporting API failures. */
  const shipSettledOrder = async (hydratedOrder: any): Promise<boolean> => {
    const { data: shippingOperationsDetail } =
      await refetchShippingMethodOperations();
    const handlerCode =
      hydratedOrder?.order?.shippingLines[0].shippingMethod
        .fulfillmentHandlerCode;
    const handler = (shippingOperationsDetail?.fulfillmentHandlers ?? []).find(
      (handler) => handler.code === handlerCode,
    );
    if (!handler) {
      toast.error(`No handler found for ${handlerCode}`);
      return false;
    }
    const args = handler.args.map((arg) => ({ name: arg.name, value: '' }));
    const response = await createFulfillmentMutation.mutateAsync({
      handler: { code: handlerCode, arguments: args },
      lines: order.lines.map((line: any) => ({
        quantity: line.quantity,
        orderLineId: String(line.id),
      })),
    });
    let fulfillmentId = (response?.addFulfillmentToOrder as any)?.id;
    const creationError = response?.addFulfillmentToOrder;
    if (creationError?.errorCode === 'ITEMS_ALREADY_FULFILLED_ERROR') {
      fulfillmentId = order.fulfillments?.[0].id;
    } else if (creationError.errorCode) {
      toast.error(
        `${creationError.errorCode} - ${creationError.transitionError}`,
      );
      return false;
    }
    const transition = await transitionMutation.mutateAsync({
      id: fulfillmentId,
      state: 'Shipped',
    });
    const error =
      transition?.transitionFulfillmentToState as FulfillmentStateTransitionError;
    if (error?.errorCode)
      toast.error(`${error.errorCode} - ${error.transitionError}`);
    return true;
  };

  /** Delivers an existing fulfillment, accepting an already-delivered response. */
  const deliverShippedOrder = async (): Promise<boolean> => {
    const response = await transitionMutation.mutateAsync({
      id: order.fulfillments?.[0].id,
      state: 'Delivered',
    });
    const error =
      response?.transitionFulfillmentToState as FulfillmentStateTransitionError;
    if (error?.errorCode?.indexOf('"Delivered" to "Delivered"') > -1)
      return true;
    if (error.errorCode) {
      toast.error(`${error.errorCode} - ${error.transitionError}`);
      return false;
    }
    return true;
  };

  const handleComplete = async () => {
    try {
      if (!window.confirm('Are you sure? This can not be undone.')) {
        return;
      }
      const { data: hydratedOrder } = await refetchOrder();
      switch (order.state) {
        case 'AddingItems':
          return toast.error('Active orders cannot be completed.');
        case 'Delivered':
          return toast.warning('Order is already Delivered.');
        case 'Cancelled':
          return toast.error('Order is already Cancelled.');
      }
      if (
        order.state === 'PaymentSettled' &&
        !(await shipSettledOrder(hydratedOrder))
      )
        return;
      if (order.state === 'Shipped' && !(await deliverShippedOrder())) return;
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
