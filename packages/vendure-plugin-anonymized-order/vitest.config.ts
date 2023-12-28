import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['./test/anonymized-order.spec.ts'],
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
