import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
import { logger } from './logger.js';

// pdf-parse v2 exports PDFParse as a named class
import { PDFParse } from 'pdf-parse';

/**
 * Supported file extensions and their MIME types
 */
export const SUPPORTED_EXTENSIONS = ['.txt', '.doc', '.docx', '.pdf'];
export const SUPPORTED_MIME_TYPES = [
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
];

/**
 * Parse a document file and extract its text content.
 * @param {string} filePath - Path to the file
 * @param {string} originalName - Original filename (for extension detection)
 * @returns {Promise<{text: string, filetype: string}>}
 */
export async function parseDocument(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type: ${ext}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`);
  }

  logger.info('Parsing document', { filename: originalName, ext });

  try {
    switch (ext) {
      case '.txt':
        return await parseTxt(filePath);
      case '.doc':
      case '.docx':
        return await parseDocx(filePath, ext);
      case '.pdf':
        return await parsePdf(filePath);
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  } catch (error) {
    logger.error('Document parsing failed', { filename: originalName, error: error.message });
    throw new Error(`Failed to parse ${originalName}: ${error.message}`);
  }
}

/**
 * Parse a plain text file.
 */
async function parseTxt(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  return { text: text.trim(), filetype: 'txt' };
}

/**
 * Parse a Word document (.doc or .docx).
 * Note: .doc files are converted through mammoth which handles both formats.
 */
async function parseDocx(filePath, ext) {
  const buffer = await fs.readFile(filePath);

  try {
    const result = await mammoth.extractRawText({ buffer });

    if (result.messages && result.messages.length > 0) {
      result.messages.forEach(msg => {
        if (msg.type === 'warning') {
          logger.warn('Document parsing warning', { message: msg.message });
        }
      });
    }

    const text = result.value.trim();

    if (!text) {
      throw new Error('Document appears to be empty or could not extract text');
    }

    return { text, filetype: ext.substring(1) };
  } catch (error) {
    if (ext === '.doc') {
      throw new Error('Legacy .doc format may not be fully supported. Please convert to .docx if possible.');
    }
    throw error;
  }
}

/**
 * Parse a PDF document.
 */
async function parsePdf(filePath) {
  const buffer = await fs.readFile(filePath);

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();
  const result = await parser.getText();
  const text = result.text.trim();

  if (!text) {
    throw new Error('PDF appears to be empty or contains only images (OCR not supported)');
  }

  logger.info('PDF parsed', { textLength: text.length });

  return { text, filetype: 'pdf' };
}

/**
 * Validate file extension.
 * @param {string} filename - Filename to check
 * @returns {boolean}
 */
export function isValidExtension(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Get file type from extension.
 * @param {string} filename - Filename
 * @returns {string}
 */
export function getFileType(filename) {
  return path.extname(filename).toLowerCase().substring(1);
}
