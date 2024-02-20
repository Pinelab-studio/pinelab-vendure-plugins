// .prettierrc.mjs
/** @type {import("prettier").Config} */
export default {
  singleQuote: true,
  plugins: ['./node_modules/prettier-plugin-astro/dist/index.js'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
  ],
};
