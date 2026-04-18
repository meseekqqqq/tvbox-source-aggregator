#!/usr/bin/env node

const { build } = require('esbuild');
const path = require('path');

build({
  entryPoints: [path.join(__dirname, '..', 'src', 'node-entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: path.join(__dirname, '..', 'dist', 'server.js'),
  format: 'cjs',
  external: ['better-sqlite3'],
  sourcemap: true,
}).then(() => {
  console.log('Build complete: dist/server.js');
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
