import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';

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
