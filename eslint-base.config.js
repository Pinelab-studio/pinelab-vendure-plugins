import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

// This config acts as base for all configs inside packages/*
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // Prevent formatting conflicts between eslint and Prettier. Always apply last
  eslintConfigPrettier,
  {
    ignores: [
      '*.config.js',
      'dist',
      'node_modules',
      '**/*/dev-server.ts',
      '**/test/**',
      '**/src/ui/**',
      '**/generated/graphql.ts',
      '**/*generated*',
    ],
  }
);
