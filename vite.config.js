const Path = require('path');
const vuePlugin = require('@vitejs/plugin-vue')
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite';
import { ArcoResolver } from 'unplugin-vue-components/resolvers';

const { defineConfig } = require('vite');

/**
 * https://vitejs.dev/config
 */
const config = defineConfig({
    root: Path.join(__dirname, 'src', 'renderer'),
    publicDir: 'public',
    server: {
        port: 8080,
    },
    open: false,
    build: {
        outDir: Path.join(__dirname, 'build', 'renderer'),
        emptyOutDir: true,
    },
    plugins: [
        vuePlugin(),
        AutoImport({
            resolvers: [ArcoResolver()],
          }),
          Components({
            resolvers: [
              ArcoResolver({
                sideEffect: true
              })
            ]
          })
    ],
});

module.exports = config;
