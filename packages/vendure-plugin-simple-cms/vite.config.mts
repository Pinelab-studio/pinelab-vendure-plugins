import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { defineConfig } from 'vite';

const gqlOutputPath = process.env.SIMPLE_CMS_GQL_OUTPUT_PATH ?? './src/gql';

export default defineConfig({
  base: '/dashboard',
  build: {
    outDir: join(__dirname, 'dist/dashboard'),
  },
  plugins: [
    vendureDashboardPlugin({
      vendureConfigPath: pathToFileURL('./test/vendure-config.ts'),
      api: {
        host: 'http://localhost',
        port: Number(process.env.SIMPLE_CMS_PORT ?? 3050),
      },
      gqlOutputPath,
      // Use a local temp dir instead of the default inside node_modules
      tempCompilationDir: join(__dirname, '.vendure-dashboard-temp'),
      // Monorepo path adapter: TS preserves directory structure relative
      // to the monorepo root in the compiled output
      pathAdapter: {
        sourceRoot: __dirname,
        getCompiledConfigPath: ({ outputPath, configFileName }) => {
          // Tell Vendure the compiled vendure-config.js is placed in ".vendure-dashboard-temp/test/vendure-config.js"
          return join(outputPath, 'test', configFileName);
        },
      },
    }),
  ],
  resolve: {
    alias: {
      // This allows all plugins to reference a shared set of
      // GraphQL types.
      '@/gql': resolve(__dirname, gqlOutputPath, 'graphql.ts'),
    },
  },
});
