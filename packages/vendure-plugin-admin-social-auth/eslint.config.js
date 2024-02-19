import parentConfig from "../../eslint.config.js";

export default [
  ...parentConfig,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
      },
    },
  },
];
