import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { existsSync } from 'fs';
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
      // Use a local temp dir instead of the default inside node_modules
      tempCompilationDir: join(__dirname, '.vendure-dashboard-temp'),
      // Monorepo path adapter: TS preserves directory structure relative
      // to the monorepo root in the compiled output
      pathAdapter: {
        getCompiledConfigPath: ({
          inputRootDir,
          outputPath,
          configFileName,
        }) => {
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
      '@/gql': resolve(__dirname, './src/gql/graphql.ts'),
    },
  },
});
