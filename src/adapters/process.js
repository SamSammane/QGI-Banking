// Subprocess adapter for sibling repositories that expose scripts rather than
// services — the fraud-detection preprocessing entrypoints and the distillation
// shell scripts. Those scripts parse no arguments of their own, so everything
// they need has to arrive through the environment and the working directory.

import { spawn } from 'node:child_process';
import { AdapterError } from './http.js';

const DEFAULT_TIMEOUT_MS = 300_000;

export function runProcess(command, args = [], { cwd = null, env = {}, timeoutMs = DEFAULT_TIMEOUT_MS, input = null } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      reject(new AdapterError(`Could not spawn ${command}: ${err.message}`, { code: 'ADAPTER_SPAWN_FAILED' }));
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new AdapterError(`Could not run ${command}: ${err.message}`, { code: 'ADAPTER_SPAWN_FAILED' }));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(
          new AdapterError(`${command} exceeded ${timeoutMs}ms and was killed.`, { code: 'ADAPTER_TIMEOUT' })
        );
        return;
      }
      resolve({ code, stdout, stderr });
    });

    if (input != null) child.stdin.write(input);
    child.stdin.end();
  });
}
