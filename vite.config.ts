import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { defineConfig, Plugin } from 'vite';
import { handleDevApiRequest } from './src/server/devApiMiddleware';

let uvicornProcess: ChildProcess | null = null;

function startUvicornBackend(): void {
  if (uvicornProcess) return;

  const persistentPkgDir = path.resolve(__dirname, '.python_packages');
  const env = {
    ...process.env,
    PYTHONPATH: `${persistentPkgDir}:${process.env.PYTHONPATH || ''}`,
  };

  try {
    uvicornProcess = spawn(
      'python3',
      ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8001'],
      {
        cwd: __dirname,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    uvicornProcess.stdout?.on('data', (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) console.log(`[FastAPI] ${msg}`);
    });

    uvicornProcess.stderr?.on('data', (chunk) => {
      const msg = chunk.toString().trim();
      if (msg) console.error(`[FastAPI Error] ${msg}`);
    });

    uvicornProcess.on('exit', () => {
      uvicornProcess = null;
    });

    const cleanup = () => {
      if (uvicornProcess) {
        try {
          uvicornProcess.kill('SIGTERM');
        } catch {
          // ignore
        }
        uvicornProcess = null;
      }
    };

    process.once('exit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  } catch (err) {
    console.error('Failed to spawn uvicorn backend:', err);
  }
}

function pythonFastApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-fastapi-backend',
    configureServer(server) {
      startUvicornBackend();

      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }

        const proxyReq = http.request(
          {
            hostname: '127.0.0.1',
            port: 8001,
            path: req.url,
            method: req.method,
            headers: {
              ...req.headers,
              host: '127.0.0.1:8001',
            },
            timeout: 30000,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );

        proxyReq.on('error', () => {
          // If FastAPI backend is booting, fallback seamlessly to dev middleware
          if (!res.headersSent) {
            if (!handleDevApiRequest(req, res)) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend initializing...' }));
            }
          }
        });

        proxyReq.on('timeout', () => {
          proxyReq.destroy();
          if (!res.headersSent) {
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Gateway timeout' }));
          }
        });

        req.pipe(proxyReq);
      });
    },
  };
}

export default defineConfig(() => {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  return {
    plugins: [react(), tailwindcss(), pythonFastApiPlugin()],
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
