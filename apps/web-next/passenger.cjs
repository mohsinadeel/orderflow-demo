const { loadEnvFile } = require('node:process');

try {
  loadEnvFile(`${__dirname}/.env`);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

require('./server.js');
