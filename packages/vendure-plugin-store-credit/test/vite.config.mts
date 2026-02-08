import { vendureDashboardPlugin } from '@vendure/dashboard/vite';
import { join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dashboard',
  build: {
    outDir: join(__dirname, '../dist/dashboard'),
  },
  plugins: [
    vendureDashboardPlugin({
      vendureConfigPath: path.join(__dirname, 'vendure-config.ts'),
      api: { host: 'auto', port: 'auto' },
      // gqlOutputPath: './src/gql',

      // 1. MUST BE PRESENT: Fixes the "looking in node_modules" error
      tempCompilationDir: path.join(process.cwd(), '.vendure-dashboard-temp'),

      pathAdapter: {
        // 2. MUST BE PRESENT: Finds your config deep inside the temp folder
        getCompiledConfigPath: ({ outputPath }) => {
          // This matches the path you found earlier:
          // .vendure-dashboard-temp/vendure-plugin-store-credit/test/vendure-config.js
          return path.join(
            outputPath,
            'vendure-plugin-store-credit',
            'test',
            'vendure-config.js'
          );
        },

        // 3. NEW FIX: Handles the imports inside your config
        // If your config says import ... from '../src/index', this ensures it looks for .js
        transformTsConfigPathMappings: ({ phase, patterns }) => {
          if (phase === 'loading') {
            return patterns.map((p) => p.replace(/\.ts$/, '.js'));
          }
          return patterns;
        },
      },
    }),
  ],
});

// import 'ts-node/register';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// export default defineConfig({
//     plugins: [
//         vendureDashboardPlugin({
//             // 2. Point to the absolute path of your TS config
//             vendureConfigPath: path.join(__dirname, 'vendure-config.ts'),

//             api: { host: 'auto', port: 'auto' },
//             gqlOutputPath: '../src/gql',

//             // 3. Remove the 'pathAdapter' and 'tempCompilationDir'
//             // We want to force it to use the file directly, not the temp version.
//         }),
//     ],
// });

// export default defineConfig({
//     base: '/dashboard',
//     build: {
//         outDir: join(__dirname, '../dist/dashboard')
//     },
//     plugins: [
//         vendureDashboardPlugin({
//             // The vendureDashboardPlugin will scan your configuration in order
//             // to find any plugins which have dashboard extensions, as well as
//             // to introspect the GraphQL schema based on any API extensions
//             // and custom fields that are configured.
//             vendureConfigPath: path.join(__dirname, 'vendure-config.ts'),
//             // Points to the location of your Vendure server.
//             api: { host: 'auto', port: 'auto' },
//             // When you start the Vite server, your Admin API schema will
//             // be introspected and the types will be generated in this location.
//             // These types can be used in your dashboard extensions to provide
//             // type safety when writing queries and mutations.
//             tempCompilationDir: path.join(process.cwd(), '.vendure-dashboard-temp'),
//             gqlOutputPath: '../src/gql',
//             pathAdapter: {
//                 getCompiledConfigPath: ({ outputPath }) => {
//                     const fullPath = path.join(outputPath, 'vendure-plugin-store-credit', 'test', 'vendure-config.js');

//                     // ADD THIS LOG:
//                     console.log('\n🔍 [DEBUG] Looking for config at:', fullPath);

//                     return fullPath;
//                 },

//                 // This helper just passes imports through unchanged
//                 transformTsConfigPathMappings: ({ phase, patterns }) => {
//                     // The 'loading' phase is when the plugin tries to execute your config file.
//                     // We need to make sure it doesn't try to load .ts files directly.
//                     if (phase === 'loading') {
//                         return patterns.map((p) => {
//                             // Change "src/index.ts" to "src/index.js"
//                             return p.replace(/\.ts$/, '.js');
//                         });
//                     }
//                     return patterns;
//                 },
//             },
//         }),
//     ],
//     resolve: {
//         alias: {
//             // This allows all plugins to reference a shared set of
//             // GraphQL types.
//             '@/gql': resolve(__dirname, '../src/gql/graphql.ts'),
//             '@/vdb': resolve(__dirname, '../../../node_modules/@vendure/dashboard/src/lib'),
//             'virtual:vendure-ui-config': resolve(__dirname, "../../../node_modules/@vendure/dashboard/src/lib/virtual.d.ts"),
//             'virtual:dashboard-extensions': resolve(__dirname, "../../../node_modules/@vendure/dashboard/src/lib/virtual.d.ts"),
//             'virtual:admin-api-schema': resolve(__dirname, "../../../node_modules/@vendure/dashboard/src/lib/virtual.d.ts")
//         },
//     },
// });
