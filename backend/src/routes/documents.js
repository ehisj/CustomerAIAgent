import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import {
  ingestDocument,
  listDocuments,
  deleteDocument,
  generateDocumentId,
  getCollectionStats,
} from '../services/vectorService.js';
import { parseDocument, SUPPORTED_EXTENSIONS, isValidExtension } from '../utils/documentParser.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    // Preserve original extension with unique prefix
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for PDFs
  fileFilter: (req, file, cb) => {
    if (isValidExtension(file.originalname)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `File type not allowed. Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`
        )
      );
    }
  },
});

/**
 * POST /api/documents/upload
 * Upload and ingest a document into the vector database.
 * Supports: .txt, .doc, .docx, .pdf
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    filePath = req.file.path;
    const originalName = req.file.originalname;

    logger.info('Processing document upload', { filename: originalName, size: req.file.size });

    // Parse document to extract text
    const { text, filetype } = await parseDocument(filePath, originalName);

    if (!text || text.length === 0) {
      return res.status(400).json({ error: 'Document appears to be empty' });
    }

    // Generate document ID
    const documentId = generateDocumentId();
    const uploadedAt = new Date().toISOString();

    // Ingest into vector DB with metadata
    const result = await ingestDocument(text, {
      documentId,
      source: originalName,
      filetype,
      ingestedAt: uploadedAt,
      uploadedAt,
    });

    logger.info('Document uploaded successfully', {
      documentId,
      filename: originalName,
      chunksInserted: result.chunksAdded,
    });

    res.json({
      documentId: result.documentId,
      filename: originalName,
      filetype,
      chunksInserted: result.chunksAdded,
      uploadedAt,
    });
  } catch (error) {
    logger.error('Document upload failed', { error: error.message });

    // Determine appropriate status code
    const statusCode = error.message.includes('not allowed') ||
                      error.message.includes('empty') ||
                      error.message.includes('Unsupported')
      ? 400
      : 500;

    res.status(statusCode).json({ error: error.message });
  } finally {
    // Clean up uploaded file
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        logger.warn('Failed to clean up uploaded file', { filePath, error: unlinkError.message });
      }
    }
  }
});

/**
 * GET /api/documents
 * List all documents in the vector database.
 */
router.get('/', async (req, res) => {
  try {
    const { documents } = await listDocuments();

    res.json({
      documents,
      total: documents.length,
    });
  } catch (error) {
    logger.error('Failed to list documents', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/documents/stats
 * Get collection statistics.
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getCollectionStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/documents/:documentId
 * Delete a document and all its chunks from the vector database.
 */
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    const result = await deleteDocument(documentId);

    if (!result.deleted) {
      return res.status(404).json({
        error: 'Document not found',
        documentId,
      });
    }

    res.json({
      deleted: true,
      documentId: result.documentId,
      chunksDeleted: result.chunksDeleted,
    });
  } catch (error) {
    logger.error('Failed to delete document', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
