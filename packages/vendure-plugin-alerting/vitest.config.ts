import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 10000,
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
