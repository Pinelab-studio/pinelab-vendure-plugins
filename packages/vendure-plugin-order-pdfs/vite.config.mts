import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { join, relative, resolve } from 'path';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';

const monorepoRoot = resolve(__dirname, '../..');

export default defineConfig({
  base: '/dashboard',
  build: {
    outDir: join(__dirname, 'dist/dashboard'),
  },
  server: {
    proxy: {
      '/admin-api': {
        target: 'http://localhost:3050',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    vendureDashboardPlugin({
      vendureConfigPath: pathToFileURL('./test/vendure-config.ts'),
      api: { host: 'auto', port: 'auto' },
      gqlOutputPath: './src/gql',
      // Use a local temp dir instead of the default inside node_modules
      tempCompilationDir: join(__dirname, '.vendure-dashboard-temp'),
      // Monorepo path adapter: compile relative to the monorepo root so
      // that imports outside this package (e.g. ../test) stay inside the
      // temp dir instead of emitting .js files next to the .ts sources
      pathAdapter: {
        sourceRoot: monorepoRoot,
        getCompiledConfigPath: ({ inputRootDir, outputPath, configFileName }) =>
          join(
            outputPath,
            relative(monorepoRoot, inputRootDir),
            configFileName
          ),
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
