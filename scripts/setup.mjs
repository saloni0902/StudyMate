// First-time setup for all three apps: `npm run setup` from the project root.
// Installs dependencies, creates the Python virtual env and the .env files.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const run = (cmd, args, cwd) => {
  console.log(`\n> ${cmd} ${args.join(' ')}  (in ${path.relative(root, cwd) || '.'})`);
  // On Windows, npm is a .cmd file, which only starts through a shell.
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: isWindows && cmd === 'npm' });
};

// Returns [command, ...args] for a Python 3.12+ (e.g. ['py', '-3.12'] on Windows).
function findPython() {
  const candidates = isWindows
    ? [['py', '-3.12'], ['py', '-3.13'], ['py', '-3'], ['python']]
    : [['python3.12'], ['python3'], ['python']];
  for (const [cmd, ...args] of candidates) {
    try {
      const version = execFileSync(cmd, [...args, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
      const [major, minor] = version.split('.').map(Number);
      if (major === 3 && minor >= 12) return [cmd, ...args];
      console.warn(`${[cmd, ...args].join(' ')} is Python ${version}; StudyMate needs 3.12 or newer.`);
    } catch {
      // not installed under this name
    }
  }
  throw new Error('Python 3.12+ was not found. Install it from https://www.python.org/downloads/');
}

// Copy .env.example to .env (once), filling in fresh secrets.
function makeEnv(dir, secrets) {
  const target = path.join(dir, '.env');
  if (fs.existsSync(target)) return console.log(`${path.relative(root, target)} already exists, leaving it as it is.`);
  let text = fs.readFileSync(path.join(dir, '.env.example'), 'utf8');
  for (const [key, value] of Object.entries(secrets)) text = text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
  fs.writeFileSync(target, text);
  console.log(`Created ${path.relative(root, target)}`);
}

const serviceKey = crypto.randomBytes(24).toString('hex');
makeEnv(path.join(root, 'backend'), { AI_SERVICE_KEY: serviceKey, JWT_SECRET: crypto.randomBytes(32).toString('hex') });
makeEnv(path.join(root, 'ai-service'), { AI_SERVICE_KEY: serviceKey });

run('npm', ['install'], path.join(root, 'backend'));
run('npm', ['install'], path.join(root, 'frontend'));

const aiDir = path.join(root, 'ai-service');
if (!fs.existsSync(path.join(aiDir, '.venv'))) {
  const [python, ...args] = findPython();
  run(python, [...args, '-m', 'venv', '.venv'], aiDir);
}
// Use the venv's python with "-m pip" (works the same on every system).
const venvPython = isWindows ? path.join(aiDir, '.venv', 'Scripts', 'python.exe') : path.join(aiDir, '.venv', 'bin', 'python');
run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip'], aiDir);
run(venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt'], aiDir);

console.log(`
Setup done. Next:
  1. Put your free Gemini key in ai-service/.env  (GEMINI_API_KEY=...)
     Get one at https://aistudio.google.com/apikey
  2. Start everything:  npm run dev
  3. Open http://localhost:5173
`);
