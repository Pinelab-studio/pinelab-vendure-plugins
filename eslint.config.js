import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // Prevent formatting conflicts between eslint and Prettier. Always apply last
  eslintConfigPrettier,
  {
    ignores: ["*.config.js", "dist", "node_modules"],
  },
);
