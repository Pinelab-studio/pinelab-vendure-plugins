import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/dashboard',
  build: {
    outDir: join(__dirname, 'dist/dashboard'),
  },
  plugins: [
    vendureDashboardPlugin({
      vendureConfigPath: pathToFileURL('./test/vendure-config.ts'),
      api: { host: 'http://localhost', port: 3050 },
      gqlOutputPath: './src/gql',
      tempCompilationDir: join(__dirname, '.vendure-dashboard-temp'),
      pathAdapter: {
        // sourceRoot = package root → compiled files land inside tempDir
        // (default sourceRoot = dirname(vendureConfigPath) = test/, which
        // causes src/ files to compile to tempDir/../src/ outside tempDir
        // where plugin discovery cannot find them)
        sourceRoot: __dirname,
        /**
         * Resolves the absolute path to the compiled Vendure config file
         * inside the temp compilation directory.
         *
         * @param outputPath The root directory where compiled files are written
         * @param configFileName The filename of the compiled config (e.g. vendure-config.js)
         * @returns The absolute path to the compiled config file under the test/ subdirectory
         */
        getCompiledConfigPath: ({ outputPath, configFileName }) => {
          return join(outputPath, 'test', configFileName);
        },
      },
    }),
  ],
  resolve: {
    alias: {
      // This allows all plugins to reference a shared set of
      // GraphQL types.
      '@/gql': resolve(__dirname, './src/gql/graphql.ts'),
    },
  },
});
