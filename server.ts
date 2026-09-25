import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Migrated Python FastAPI endpoints
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'FormatAI',
      backend: 'python',
    });
  });

  app.get('/api/root', (_req, res) => {
    res.json({
      message: 'FormatAI Python FastAPI Backend is running.',
      service: 'FormatAI',
      backend: 'python',
      docs_url: '/docs',
    });
  });

  app.get('/docs', (_req, res) => {
    res.json({
      openapi: '3.1.0',
      info: {
        title: 'FormatAI Backend',
        description: 'Python FastAPI backend for FormatAI academic document formatting application (migrated to Express).',
        version: '0.1.0',
      },
      paths: {
        '/api/health': {
          get: {
            summary: 'Health check endpoint returning backend status.',
            responses: {
              '200': {
                description: 'Successful Response',
                content: {
                  'application/json': {
                    schema: {
                      title: 'HealthResponse',
                      type: 'object',
                      properties: {
                        status: { title: 'Status', type: 'string' },
                        service: { title: 'Service', type: 'string' },
                        backend: { title: 'Backend', type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
