# 1.3.0 (2023-11-21)

- Only log error when job is not added to queue after configured retries
- Apply exponential backoff when adding to queue doesn't work.

# 1.2.0 (2023-10-24)

- Updated vendure to 2.1.1

# 1.1.2 (2023-09-26)

- Added `onJobFailure` option to inspect errors from failed jobs([#262](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/262))
