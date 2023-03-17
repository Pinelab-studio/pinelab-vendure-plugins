# Contributing to the Pinelab plugins

Below you can find our opinionated guide on how to contribute to this repository, and how we prefer to work at Pinelab.

## Gettings started

1. [Create a fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo) of [this repository](https://github.com/Pinelab-studio/pinelab-vendure-plugins)
2. Checkout the `master` branch and make sure it's up to date with `git pull upstream master`
3. Create a feature branch `git checkout -b feat/gifts-plugin`
4. Define testcases first. Just the text, don't implement them yet. This helps you think about what the functionality of the code should be. Example:

```ts
it('Allows administrators to define free gifts', async () => {});

it('Allows customers to select gifts', async () => {});
```

5. Implement your testcases before you do any work on the implementation. This helps you come up with logical GraphQL queries and mutations, and you want to see your testcases fail before they succeed, to prevent false positives.
6. Now, you can run your tests with `yarn test`. Every test should fail, that's ok for now.
7. Implement the code needed for your testcases one by one. Making each test succeed one at a time.
8. Now, when all your tests succeed, [create a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request-from-a-fork) against the `master` branch
9. The pull request should automatically run formatter and linter checks, as wel as automated e2e tests.
10. Make sure to review your own pull request before asking a maintainer to review it.
11. That's it, thanks for your contribution!
