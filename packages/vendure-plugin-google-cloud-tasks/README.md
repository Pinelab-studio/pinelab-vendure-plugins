# Google Cloud Tasks Vendure Plugin

Using Vendure worker with Google Cloud Tasks. Some services, like Google Cloud Run,
don't allow any processing outside the request context, including pull subscriptions.

Cloud Tasks push messages to public HTTPS endpoint, the worker instance in this case, thus also leveraging loadbalancing of your instance.

Automatically creates queues, but doesn't delete them, because of possible inflight messages.

## Testing

Make sure you have `gcloud` cli installed locally and authorized on the project you want to use.
