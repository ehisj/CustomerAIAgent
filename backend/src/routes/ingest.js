import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { ingestDocument, clearCollection } from '../services/vectorService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.md', '.json'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed. Allowed: ${allowedTypes.join(', ')}`));
    }
  },
});

/**
 * POST /api/ingest
 * Ingest a document into the vector database.
 * Body: multipart/form-data with 'file' field
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;

    logger.info('Ingesting document', { filename: originalName });

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Ingest into vector DB
    const result = await ingestDocument(content, {
      source: originalName,
      ingestedAt: new Date().toISOString(),
    });

    // Clean up uploaded file
    await fs.unlink(filePath);

    res.json({
      success: true,
      filename: originalName,
      chunksAdded: result.chunksAdded,
    });
  } catch (error) {
    logger.error('Ingest failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ingest/text
 * Ingest raw text into the vector database.
 * Body: { text: string, source: string }
 */
router.post('/text', async (req, res) => {
  try {
    const { text, source } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    logger.info('Ingesting text', { source: source || 'manual', length: text.length });

    const result = await ingestDocument(text, {
      source: source || 'manual_input',
      ingestedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      source: source || 'manual_input',
      chunksAdded: result.chunksAdded,
    });
  } catch (error) {
    logger.error('Ingest text failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/ingest
 * Clear all documents from the vector database.
 */
router.delete('/', async (req, res) => {
  try {
    await clearCollection();
    res.json({ success: true, message: 'Collection cleared' });
  } catch (error) {
    logger.error('Clear collection failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
