import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
    {
        input: 'src/fonttest.mjs',
        output: {
            file: 'fonts/fonttest.js',
            format: 'iife'
        },
        plugins: [nodeResolve(), commonjs()]
    }
];