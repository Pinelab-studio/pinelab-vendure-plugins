import path from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['./test/customer-managed-groups.spec.ts'],
    typecheck: {
      tsconfig: path.join(__dirname, './test/tsconfig.e2e.json'),
    },
  },
  plugins: [
    // SWC required to support decorators used in test plugins
    // See https://github.com/vitest-dev/vitest/issues/708#issuecomment-1118628479
    // Vite plugin
    swc.vite({
      jsc: {
        transform: {
          // See https://github.com/vendure-ecommerce/vendure/issues/2099
          useDefineForClassFields: false,
        },
      },
    }),
  ],
});
