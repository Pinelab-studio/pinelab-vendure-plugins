/*import nock from "nock";
import { createTestEnvironment, registerInitializer, SqljsInitializer, testConfig } from "@vendure/testing";
import gql from "graphql-tag";
import { DefaultLogger, InitialData, LogLevel } from "@vendure/core";
import { initialData } from "../../test/initialData";
import { CloudTasksPlugin } from "../src/cloud-tasks.plugin";*/

describe('CloudTasks job queue e2e', () => {
  it('Needs to be implemented', async () => {});

  /*  // TODO record googleapi calls
  nock("https://oauth2.googleapis.com")
    .post("/token")
    .times(2)
    .reply(200, {
      access_token: 'abc',
      refresh_token: '123',
      expires_in: 10,
    });

  registerInitializer("sqljs", new SqljsInitializer("__data__"));
  testConfig.plugins.push(
    CloudTasksPlugin.init({
      taskHandlerHost: "https://localhost",
      projectId: "test-project",
      location: "europe-west1",
      authSecret: "some-secret-to-authenticate-cloud-tasks",
      queueSuffix: "plugin-test"
    })
  );
  testConfig.logger = new DefaultLogger({ level: LogLevel.Debug });
  const { server, adminClient, shopClient } = createTestEnvironment(testConfig);

  beforeAll(async () => {
    await server.init({
      initialData: initialData as InitialData,
      productsCsvPath: "../test/products-import.csv"
    });
  }, 1800 * 1000);

  afterAll(async () => {
    await server.destroy();
  });

  // FIXME: work with nock to intercept outgoing calls
  it("Reindex job", async () => {
    const scope = nock("https://oauth2.googleapis.com/token")
      .post("/!*", (body) => {
        console.log(`------------------- body`, body);
        return body.username && body.password;
      })
      .reply(200);
    const { reindex } = await adminClient.query(
      gql`
          mutation {
              reindex {
                  id
              }
          }
      `
    );
    expect(reindex).toBeDefined();
  });*/
});
