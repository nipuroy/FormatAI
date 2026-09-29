import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { defineConfig, Plugin } from 'vite';

let uvicornProcess: ChildProcess | null = null;

function pythonFastApiPlugin(): Plugin {
  return {
    name: 'vite-plugin-fastapi-backend',
    configureServer() {
      if (uvicornProcess) return;

      const persistentPkgDir = path.resolve(__dirname, '.python_packages');
      const env = {
        ...process.env,
        PYTHONPATH: `${persistentPkgDir}:${__dirname}:${process.env.PYTHONPATH || ''}`,
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

        uvicornProcess.on('exit', (code) => {
          console.log(`[FastAPI] Exited with code ${code}`);
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
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
          secure: false,
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
