module.exports = (async () => {
  const { default: parentConfig } = await import('../../eslint-base.config.js');
  return [
    ...parentConfig,
    {
      ignores: ['src/**/*.js', 'src/**/*.d.ts'],
    },
    {
      languageOptions: {
        parserOptions: {
          project: './tsconfig.eslint.json',
        },
      },
    },
  ];
})();
