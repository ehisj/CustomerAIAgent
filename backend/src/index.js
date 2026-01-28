import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import chatRoutes from './routes/chat.js';
import ingestRoutes from './routes/ingest.js';
import documentsRoutes from './routes/documents.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip,
  });
  next();
});

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/documents', documentsRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Customer AI Agent API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/chat/health',
      voiceChat: 'POST /api/chat/voice',
      textChat: 'POST /api/chat/text',
      ingestFile: 'POST /api/ingest',
      ingestText: 'POST /api/ingest/text',
      clearDocs: 'DELETE /api/ingest',
      documents: {
        list: 'GET /api/documents',
        upload: 'POST /api/documents/upload',
        delete: 'DELETE /api/documents/:documentId',
        stats: 'GET /api/documents/stats',
      },
    },
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port}`);
  logger.info('API endpoints ready');

  if (!config.openai.apiKey) {
    logger.warn('OPENAI_API_KEY not set - API calls will fail');
  }
});
