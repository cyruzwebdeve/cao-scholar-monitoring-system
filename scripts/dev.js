const { spawn, spawnSync } = require('node:child_process');

const npmCli = process.env.npm_execpath;
const nodeCommand = process.env.npm_node_execpath || process.execPath;
const services = [
  { name: 'frontend', directory: 'frontend' },
  { name: 'backend', directory: 'backend' },
];

let stopping = false;
let remaining = services.length;
let exitCode = 0;

const children = services.map(({ name, directory }) => {
  if (!npmCli) {
    throw new Error('Start this launcher with "npm run dev" from the project root.');
  }

  const child = spawn(nodeCommand, [npmCli, '--prefix', directory, 'run', 'dev'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('error', (error) => {
    console.error(`[${name}] Failed to start: ${error.message}`);
    exitCode = 1;
    stopAll();
  });

  child.on('exit', (code) => {
    remaining -= 1;
    if (!stopping && code !== 0) {
      console.error(`[${name}] Development server stopped unexpectedly.`);
      exitCode = code || 1;
      stopAll();
    }
    if (remaining === 0) process.exit(exitCode);
  });

  return child;
});

function stopAll(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => {
    if (child.killed) return;
    if (process.platform === 'win32' && child.pid) {
      // npm.cmd and nodemon create descendant processes on Windows. Killing
      // only the immediate wrapper can leave stale Vite/API servers bound to
      // ports 5173 and 3601, so terminate the launcher-owned process tree.
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      return;
    }
    child.kill(signal);
  });

  setTimeout(() => process.exit(exitCode), 3000).unref();
}

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));
