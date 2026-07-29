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
      api: { host: 'http://localhost', port: 3050 },
      gqlOutputPath: './src/gql',
      tempCompilationDir: join(__dirname, '.vendure-dashboard-temp'),
      pathAdapter: {
        sourceRoot: join(monorepoRoot, 'packages'),
        getCompiledConfigPath: ({
          inputRootDir,
          outputPath,
          configFileName,
        }) => {
          const relPath = inputRootDir.split('/packages/')[1] ?? '';
          return join(outputPath, relPath, configFileName);
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@/gql': resolve(__dirname, './src/gql/graphql.ts'),
    },
  },
});
