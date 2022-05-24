# Google Cloud Tasks Vendure Plugin

![Vendure version](https://img.shields.io/npm/dependency-version/vendure-plugin-google-cloud-tasks/dev/@vendure/core)

Plugin for using Vendure worker with Google Cloud Tasks. Some services, like Google Cloud Run,
don't allow any processing outside the request context, including PubSub pull subscriptions.

Cloud Tasks push messages to public HTTPS endpoint, the worker instance in this case, thus also leveraging loadbalancing of your instance.

Automatically creates queues, but doesn't delete them, because of possible inflight messages.

## Plugin setup

1. Remove `DefaultJobQueuePlugin` from your vendure-config.
   Add this plugin to your config:

```js
plugins: [
  CloudTasksPlugin.init({
    // Must be public
    taskHandlerHost: 'https://your-public-host/',
    projectId: 'your-google-project-id',
    // Where the taskqueue will be created
    location: 'europe-west1',
    // Used to prevent unwanted requests to your public endpoint
    authSecret: 'some-secret-to-authenticate-incoming-messages',
    // Used to distinguish taskQueues within the same
    // Google Project (if you have OTAP environments in the same project for example)
    queueSuffix: 'plugin-test',
  }),
];
```

## Run dev-server

`yarn serve` to start a local devserver.
Got to `http://localhost:3050/admin` to rebuild the index to trigger a worker job.
Make sure you have the following variables in a local `.env` file for the dev-server to work.

```js
GOOGLE_CLOUD_PROJECT_ID = yourID;
TASKQUEUE_LOCATION = europe - west1;
```

:info: When running locally, make sure your local `gcloud` cli is authenticated.

## Testing

// TODO

## Tech details

This plugin sets the `CloudTasksJobQueueStrategy` as the jobQueueStrategy.
On application start queues are created and the processFunction is saved in a `map<queueName, processFunction>` .
CloudTasks will push the jobData to `CloudTaskHandler`, the handler will look for the processFunction based on the given queue,
and pass the jobData to the process function.

## Enjoying our plugins?

Enjoy the Pinelab Vendure plugins? [Consider becoming a sponsor](https://github.com/sponsors/Pinelab-studio).

Or check out [pinelab.studio](https://pinelab.studio) for more articles about our integrations.
<br/>
<br/>
<br/>
[![Pinelab.studio logo](https://pinelab.studio/assets/img/favicon.png)](https://pinelab.studio)
