import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';

const monorepoRoot = resolve(__dirname, '../..');

export default defineConfig({
  base: '/dashboard',
  build: {
    outDir: join(__dirname, 'dist/dashboard'),
  },
  plugins: [
    vendureDashboardPlugin({
      vendureConfigPath: pathToFileURL('./test/vendure-config.ts'),
      api: { host: 'http://localhost', port: '3050' },
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
          // TS compiler uses monorepoRoot/packages/ as rootDir,
          // so strip everything up to and including 'packages/'
          const relPath = inputRootDir.split('/packages/')[1] ?? '';
          return join(outputPath, relPath, configFileName);
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
