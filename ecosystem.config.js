module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'src/server.js',
      cwd: '/root/enterpriseCamp',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'frontend',
      script: 'node_modules/.bin/vite',
      args: 'preview --host 0.0.0.0 --port 4173',
      cwd: '/root/enterpriseCamp/frontend',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
