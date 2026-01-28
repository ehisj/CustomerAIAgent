import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { transcribeAudio } from '../services/sttService.js';
import { queryVector } from '../services/vectorService.js';
import { generateResponse } from '../services/llmService.js';
import { textToSpeech } from '../services/ttsService.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

const router = Router();

// Configure multer to preserve file extension (required for Whisper)
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    // Get base mimetype (strip codec info like ;codecs=opus)
    const baseMime = file.mimetype.split(';')[0];

    const mimeToExt = {
      'audio/webm': '.webm',
      'audio/mp4': '.mp4',
      'audio/m4a': '.m4a',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/wave': '.wav',
      'audio/x-wav': '.wav',
      'audio/ogg': '.ogg',
      'audio/flac': '.flac',
    };
    const ext = mimeToExt[baseMime] || path.extname(file.originalname) || '.webm';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for audio
});

/**
 * POST /api/chat/voice
 * Process voice input and return response with TTS audio.
 * Body: multipart/form-data with 'audio' field
 * Returns: { transcript, response, sources, isConfident, audio (base64) }
 */
router.post('/voice', upload.single('audio'), async (req, res) => {
  let audioPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    audioPath = req.file.path;
    logger.info('Processing voice chat', { fileSize: req.file.size });

    // Step 1: Transcribe audio
    const { text: transcript } = await transcribeAudio(audioPath);

    if (!transcript || transcript.trim().length === 0) {
      return res.status(400).json({ error: 'Could not transcribe audio' });
    }

    // Step 2: Query vector DB
    const { chunks } = await queryVector(transcript, config.rag.topK);

    // Step 3: Generate LLM response
    const { response, isConfident } = await generateResponse(transcript, chunks);

    // Step 4: Generate TTS audio
    const audioBuffer = await textToSpeech(response);
    const audioBase64 = audioBuffer.toString('base64');

    // Format sources for response
    const sources = chunks.map((chunk) => ({
      source: chunk.metadata?.source || 'Unknown',
      snippet: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
      relevance: (1 - chunk.distance).toFixed(2), // Convert distance to similarity score
    }));

    res.json({
      transcript,
      response,
      sources,
      isConfident,
      audio: audioBase64,
      audioFormat: 'mp3',
    });
  } catch (error) {
    logger.error('Voice chat failed', { error: error.message });
    res.status(500).json({ error: error.message });
  } finally {
    // Clean up uploaded audio file
    if (audioPath) {
      try {
        await fs.unlink(audioPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
});

/**
 * POST /api/chat/text
 * Process text input and return response.
 * Body: { message: string, includeTts?: boolean }
 * Returns: { response, sources, isConfident, audio? (base64) }
 */
router.post('/text', async (req, res) => {
  try {
    const { message, includeTts = false } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'No message provided' });
    }

    logger.info('Processing text chat', { messageLength: message.length });

    // Step 1: Query vector DB
    const { chunks } = await queryVector(message, config.rag.topK);

    // Step 2: Generate LLM response
    const { response, isConfident } = await generateResponse(message, chunks);

    // Format sources for response
    const sources = chunks.map((chunk) => ({
      source: chunk.metadata?.source || 'Unknown',
      snippet: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
      relevance: (1 - chunk.distance).toFixed(2),
    }));

    const result = {
      response,
      sources,
      isConfident,
    };

    // Optionally include TTS
    if (includeTts) {
      const audioBuffer = await textToSpeech(response);
      result.audio = audioBuffer.toString('base64');
      result.audioFormat = 'mp3';
    }

    res.json(result);
  } catch (error) {
    logger.error('Text chat failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/chat/health
 * Health check endpoint.
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
