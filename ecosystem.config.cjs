// PM2 process file for self-hosting on a Linux server (e.g. Ubuntu), as an alternative to
// Cloudflare Pages (docs/deploy.md). Both apps are static builds, so PM2's built-in static
// server (`script: 'serve'`) is enough: no Node server code, no extra dependency.
//
//   pnpm install --frozen-lockfile && pnpm build
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup      # restart on reboot
//
// `.cjs` because the root package.json is `"type": "module"` and PM2 loads this with require().
// Put a reverse proxy (nginx/Caddy) with TLS in front: PM2's server ignores `public/_headers`,
// so security and cache headers must be set there.

const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'sododeck-app',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: path.join(__dirname, 'apps/app/dist'),
        PM2_SERVE_PORT: process.env.SODODECK_APP_PORT ?? '4173',
        // SPA fallback (same as `public/_redirects`), so deep links like /deck/abc load.
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html',
      },
      max_memory_restart: '200M',
    },
    {
      name: 'sododeck-site',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: path.join(__dirname, 'apps/site/dist'),
        PM2_SERVE_PORT: process.env.SODODECK_SITE_PORT ?? '4321',
      },
      max_memory_restart: '200M',
    },
  ],
};
