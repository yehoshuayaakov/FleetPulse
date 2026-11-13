import { readFileSync } from 'node:fs';
import { Module } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = join(root, 'server.js');
const port = Number(process.env.FLEET_E2E_PORT);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('FLEET_E2E_PORT must be a TCP port');
}

const original = readFileSync(serverPath, 'utf8');
const source = original.replace('const PORT = 3000;', `const PORT = ${port};`);

if (source === original) {
  throw new Error('Could not retarget the mock port without editing server.js');
}

const compiled = new Module(serverPath);
compiled.filename = serverPath;
compiled.paths = Module._nodeModulePaths(root);
compiled._compile(source, serverPath);
