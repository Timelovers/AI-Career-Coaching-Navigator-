import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const esbuild = require('esbuild');
const outfile = path.join(root, 'scripts', '.tmp-check.mjs');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'check-llm.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
});

const child = spawn(process.execPath, [outfile], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
