const { loadEnvFile } = require('node:process');

try {
  loadEnvFile(`${__dirname}/.env`);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

import('./dist/main.js').catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
