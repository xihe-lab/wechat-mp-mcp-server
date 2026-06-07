import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    conditions: ['node'],
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'better-sqlite3',
        'axios',
        'form-data',
        'node:fs',
        'node:path',
        'node:process',
        'node:http',
        'node:https',
        'node:stream',
        'node:util',
        'node:url',
        'node:buffer',
        'node:events',
        'node:crypto',
        'node:zlib',
        'node:net',
        'node:tls',
        'node:os',
        'node:child_process',
        'fs',
        'path',
        'process',
        'http',
        'https',
        'stream',
        'util',
        'url',
        'buffer',
        'events',
        'crypto',
        'zlib',
        'net',
        'tls',
        'os',
        'child_process',
      ],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
