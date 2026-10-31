// Runs the AI service's Python (from ai-service/.venv) on Windows, macOS and Linux:
//   node scripts/py.mjs -m pytest
// The virtual env keeps python in .venv\Scripts\python.exe on Windows and
// .venv/bin/python elsewhere, so npm scripts can't name it directly.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../ai-service');
const python =
  process.platform === 'win32'
    ? path.join(aiDir, '.venv', 'Scripts', 'python.exe')
    : path.join(aiDir, '.venv', 'bin', 'python');

if (!fs.existsSync(python)) {
  console.error(`Python environment not found at ${python}. Run "npm run setup" first.`);
  process.exit(1);
}

const child = spawn(python, process.argv.slice(2), { cwd: aiDir, stdio: 'inherit' });
// Pass Ctrl+C / stop signals on to Python so the server shuts down cleanly.
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
