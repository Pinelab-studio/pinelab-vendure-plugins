module.exports = (async () => {
  const { default: parentConfig } = await import('../../eslint-base.config.js');
  return [
    ...parentConfig,
    {
      languageOptions: {
        parserOptions: {
          project: './tsconfig.json',
        },
      },
    },
  ];
})();
