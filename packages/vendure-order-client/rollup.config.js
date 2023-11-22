import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'lib',
    format: 'esm',
  },
  plugins: [typescript()],
  external: ['nanostores', 'graphql-request', 'mitt'],
};
