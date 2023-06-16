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
    swc.vite({
      jsc: {
        transform: {
          useDefineForClassFields: false,
        },
      },
    }),
  ],
});
