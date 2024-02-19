// .prettierrc.mjs
/** @type {import("prettier").Config} */
export default {
  plugins: ["./node_modules/prettier-plugin-astro/dist/index.js"],
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
  ],
};
