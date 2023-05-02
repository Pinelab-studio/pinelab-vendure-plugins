# Google Cloud Tasks Vendure plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-google-cloud-tasks/dev/@vendure/core)

### [Official documentation here](https://pinelab-plugins.com/plugin/vendure-plugin-google-cloud-tasks)

Plugin for using Vendure worker with Google Cloud Tasks

## Getting started

## Plugin setup

1. Remove `DefaultJobQueuePlugin` from your vendure-config. Add this plugin to your `vendure-config.ts`:

```ts
plugins: [
  CloudTasksPlugin.init({
    // Must reachable by Google Cloud Task. Messages are pushed to this endpoint
    taskHandlerHost: 'https://your-public-host/',
    projectId: 'your-google-project-id',
    // Region where the taskqueue should be created
    location: 'europe-west1',
    // Used to prevent unauithorized requests to your public endpoint
    authSecret: 'some-secret-to-authenticate-incoming-messages',
    /**
     *  Used to distinguish taskQueues within the same
     *  Google Project (if you have OTAP environments in the same project for example)
     *  This suffix will be appended to the queue name: "send-email-plugin-test"
     */
    queueSuffix: 'plugin-test',
    // Default amount of retries when no job.retries is given
    defaultJobRetries: 15,
    // The amount of retries when a job fails to be pushed to the queue
    createTaskRetries: 3,
  }),
];
```

2. Start the Vendure server, log in to the admin dashboard and trigger a reindex job
   via `Products > (cog icon) > reindex` to test the Cloud Tasks Plugin.
