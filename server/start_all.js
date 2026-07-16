import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const localHome = path.join(rootDir, '.temp_home');
const env = { ...process.env, HOME: localHome };

console.log(`🏠 Overriding HOME to: ${localHome}`);

console.log('🚀 Starting JoldiGo Backend Server...');
const backendProc = spawn('node', [path.join(__dirname, 'index.js')], {
  cwd: __dirname,
  env
});

backendProc.stdout.on('data', (data) => {
  process.stdout.write(`[Backend] ${data}`);
});

backendProc.stderr.on('data', (data) => {
  process.stderr.write(`[Backend ERROR] ${data}`);
});

console.log('🚀 Starting JoldiGo Frontend Dev Server...');
const frontendProc = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
  cwd: rootDir,
  env
});

frontendProc.stdout.on('data', (data) => {
  process.stdout.write(`[Frontend] ${data}`);
});

frontendProc.stderr.on('data', (data) => {
  process.stderr.write(`[Frontend ERROR] ${data}`);
});

process.on('SIGINT', () => {
  console.log('Stopping servers...');
  backendProc.kill();
  frontendProc.kill();
  process.exit();
});
