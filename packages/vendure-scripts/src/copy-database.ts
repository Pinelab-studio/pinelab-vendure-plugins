/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
// Some eslint rules are disabled, because there are no types available for 'prompt-confirm'
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

const Confirm = require('prompt-confirm');
import { spawn } from 'child_process';

export interface DBConfig {
  username: string;
  password: string;
  host: string;
  databaseName: string;
}

/**
 * Download prod db to local file with mysqldump
 */
export async function exportDbToFile(
  config: DBConfig,
  exportFile = `/tmp/db_export.sql`,
  requiresPrompt = true
): Promise<string> {
  if (requiresPrompt) {
    const promptCommand = new Confirm(
      `Downloading database ${config.databaseName} (${config.host}) to "${exportFile}". Proceed?`
    );
    const accept = await promptCommand.run();
    if (!accept) {
      process.exit(0);
    }
  }
  await execute(
    `mysqldump -v --set-gtid-purged=OFF --column-statistics=0 -u ${config.username} -h ${config.host} --password='${config.password}' ${config.databaseName} > ${exportFile}`
  );
  return exportFile;
}

/**
 * Import the given sql file into the database
 */
export async function insertIntoDb(
  config: DBConfig,
  sqlFile: string,
  requiresPrompt = true
): Promise<void> {
  if (requiresPrompt) {
    const promptCommand = new Confirm(
      `Inserting "${sqlFile}" into database ${config.databaseName} (${config.host}). Proceed?`
    );
    const accept = await promptCommand.run();
    if (!accept) {
      process.exit(0);
    }
  }
  await execute(
    `mysql --verbose -u ${config.username} -h ${config.host} --password='${config.password}' ${config.databaseName} < ${sqlFile}`
  );
}

/**
 * Execute the given command and return a promise.
 * Logs the output of the command to the console in realtime.
 */
async function execute(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, [], { stdio: 'inherit', shell: true });
    proc.on('error', function (error) {
      reject(new Error(error.message));
    });
    proc.on('exit', function (code) {
      if (code !== 0) {
        reject(new Error('exited with code ' + code));
      } else {
        resolve();
      }
    });
  });
}
