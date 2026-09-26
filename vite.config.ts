import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { handleDevApiRequest } from './src/server/devApiMiddleware';

function apiDevMiddlewarePlugin(): Plugin {
  return {
    name: 'vite-plugin-dev-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (handleDevApiRequest(req, res)) {
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  return {
    plugins: [react(), tailwindcss(), apiDevMiddlewarePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '0.0.0.0',
      port,
      allowedHosts: true as const,
    },
  };
});
