module.exports = (async () => {
  const { default: parentConfig } = await import('../../eslint.config.js');
  return [
    ...parentConfig,
    {
      languageOptions: {
        parserOptions: {
          project: './tsconfig.eslint.json',
        },
      },
    },
  ];
})();
