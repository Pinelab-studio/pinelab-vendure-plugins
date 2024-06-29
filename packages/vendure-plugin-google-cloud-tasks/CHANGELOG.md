# 1.7.0 (2024-09-06)

- Updated `@google-cloud/tasks` to `"^5.4.0"`
- Generates a unique task name; this reduces the latency during creation of the task

# 1.6.0 (2024-07-21)

- Updated Vendure to 2.2.6

# 1.5.0 (2024-01-30)

- Don't store `job.data` when it's too big for MySQL text column
- Remove jobs older than 30 days on application startup

# 1.4.0 (2023-12-19)

- Allow setting `fallback:true` to fallback to HTTP instead of gRPC to prevent DEADLINE_EXCEEDED errors. For more details see https://github.com/googleapis/nodejs-tasks/issues/397#issuecomment-618580649
- Allow setting of all Google Cloud Tasks Client options via `clientOptions: ...`
- Removed `bodySizeLimit` option, because body-parser is loaded by NestJs since Vendure V2

# 1.3.0 (2023-11-21)

- Only log error when job is not added to queue after configured retries
- Apply exponential backoff when adding to queue doesn't work.

# 1.2.0 (2023-10-24)

- Updated vendure to 2.1.1

# 1.1.2 (2023-09-26)

- Added `onJobFailure` option to inspect errors from failed jobs([#262](https://github.com/Pinelab-studio/pinelab-vendure-plugins/pull/262))
