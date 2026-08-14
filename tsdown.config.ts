/**
 * Standalone build: no dsh checkout or npm install required.
 *
 * - lib/index.js   host (node) half, ESM.
 * - lib/client.js  browser half, CJS wrapped in the __ModuleLoader__ factory
 *                  contract the dsh client module table expects.
 *
 * Every @deepseek-ai/* and react import stays external: at runtime the
 * harness resolves them from its own platform module table / plugin graph.
 */
import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    name: 'dsh-auth',
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2022',
    dts: false,
    clean: true,
    deps: {
      neverBundle: [
        '@deepseek-ai/cordis',
        '@deepseek-ai/schemastery',
        /^node:/u,
      ],
    },
    outputOptions: {
      entryFileNames: 'index.js',
    },
  },
  {
    name: 'dsh-auth/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    dts: false,
    clean: false,
    deps: {
      neverBundle: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-client-runtime',
        '@deepseek-ai/dsh-client-runtime/client',
        '@deepseek-ai/dsh-client-ui-slots',
        '@deepseek-ai/dsh-client-web-react',
        '@deepseek-ai/dsh-client-ui-primitives',
        '@deepseek-ai/dsh-client-ui-attachment',
        '@deepseek-ai/dsh-client-schema-form',
      ],
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-auth", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
