import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';

function pythonBackendPlugin(): Plugin {
  let pythonProcess: ChildProcess | null = null;
  let isStarting = false;

  const isBackendHealthy = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:8001/api/health', (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(false);
      });
    });
  };

  const spawnUvicorn = () => {
    if (isStarting || pythonProcess) return;
    isStarting = true;

    console.log('[FormatAI Plugin] Launching Python FastAPI backend on http://127.0.0.1:8001 ...');
    pythonProcess = spawn(
      'python3',
      ['-m', 'uvicorn', 'backend.main:app', '--host', '0.0.0.0', '--port', '8001'],
      {
        stdio: ['ignore', 'inherit', 'inherit'],
        detached: false,
      }
    );

    pythonProcess.on('error', (err) => {
      console.error('[FormatAI Plugin] Failed to start Python backend:', err.message);
      pythonProcess = null;
      isStarting = false;
    });

    pythonProcess.on('exit', (code, signal) => {
      console.warn(`[FormatAI Plugin] Python backend exited (code: ${code}, signal: ${signal})`);
      pythonProcess = null;
      isStarting = false;
    });

    // Reset starting lock after a brief startup window
    setTimeout(() => {
      isStarting = false;
    }, 2000);
  };

  return {
    name: 'vite-plugin-python-backend',
    async configureServer(server) {
      const healthy = await isBackendHealthy();
      if (!healthy) {
        spawnUvicorn();
      } else {
        console.log('[FormatAI Plugin] Python FastAPI backend is already active on port 8001.');
      }

      // Keep backend alive with periodic health check
      const monitorInterval = setInterval(async () => {
        const ok = await isBackendHealthy();
        if (!ok && !pythonProcess && !isStarting) {
          console.log('[FormatAI Plugin] Python backend unreachable; reviving service...');
          spawnUvicorn();
        }
      }, 4000);
      monitorInterval.unref();

      const cleanup = () => {
        clearInterval(monitorInterval);
        if (pythonProcess) {
          console.log('[FormatAI Plugin] Terminating Python backend...');
          try {
            pythonProcess.kill('SIGTERM');
          } catch {
            // Ignore termination errors on shutdown
          }
          pythonProcess = null;
        }
      };

      server.httpServer?.on('close', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('exit', cleanup);
    },
  };
}

export default defineConfig(() => {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  return {
    plugins: [react(), tailwindcss(), pythonBackendPlugin()],
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
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://127.0.0.1:8001',
          changeOrigin: true,
          secure: false,
          timeout: 60000,
          configure: (proxy) => {
            proxy.on('error', (err, _req, res) => {
              // Gracefully handle proxy ECONNREFUSED without crashing Vite
              if (res && 'writeHead' in res && !(res as any).headersSent) {
                (res as any).writeHead(503, {
                  'Content-Type': 'application/json',
                  'Retry-After': '2',
                });
                (res as any).end(
                  JSON.stringify({
                    error: 'FastAPI backend is initializing. Please wait a moment...',
                    code: 'BACKEND_STARTING',
                  })
                );
              }
            });
          },
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port,
      allowedHosts: true as const,
    },
  };
});
