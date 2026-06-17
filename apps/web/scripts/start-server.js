const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, '../.next/standalone/apps/web/server.js'),
  path.join(__dirname, '../.next/standalone/server.js'),
];

const serverPath = candidates.find((candidate) => fs.existsSync(candidate));

if (!serverPath) {
  console.error('[start-server] Standalone build not found. Run `npm run build` first.');
  process.exit(1);
}

require(serverPath);
