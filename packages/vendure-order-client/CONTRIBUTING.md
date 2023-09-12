# Development and contributing

Contributions always welcome!

1. Make your changes
2. Run `yarn test`
3. Run `yarn build`

If both of these commands succeed, create a PR!

## Type generation

If you've added new GraphQL queries in `queries.ts`, you can generate types for the query/mutation, it's inputs and the return type:

1. Start the dev server with `yarn start`
2. In another terminal window, run `yarn generate`
