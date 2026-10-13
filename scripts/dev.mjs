import { spawn } from 'node:child_process';

const children = ['api', 'web'].map((app) =>
  spawn('npm', ['run', 'dev', '-w', `@observatorio/${app}`], {
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  }),
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    try {
      process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error);
    }
  }
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', (error) => { console.error(error); stop(1); });
  child.on('exit', (code) => stop(code ?? 1));
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
