const path = require('path');

/** PM2 cluster config — run from apps/web: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'myfng-web',
      cwd: __dirname,
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      interpreter: 'node',
      node_args: '--require ./scripts/html-pretty-patch.js',
      instances: 3,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
