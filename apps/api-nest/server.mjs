import { loadEnvFile } from 'node:process';

try {
  loadEnvFile(new URL('.env', import.meta.url));
} catch (error) {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
}

await import('./dist/main.js');
