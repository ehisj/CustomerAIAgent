/**
 * Ingest Script - Load sample documents into the vector database.
 * Usage: npm run ingest
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ingestDocument, clearCollection } from '../services/vectorService.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_DOCS_DIR = path.join(__dirname, '../../sample_docs');

async function main() {
  const args = process.argv.slice(2);
  const clearFirst = args.includes('--clear');

  try {
    if (clearFirst) {
      logger.info('Clearing existing collection...');
      await clearCollection();
    }

    logger.info('Starting document ingestion...');

    // Read all files from sample_docs directory
    const files = await fs.readdir(SAMPLE_DOCS_DIR);
    const textFiles = files.filter((f) => f.endsWith('.txt') || f.endsWith('.md'));

    if (textFiles.length === 0) {
      logger.warn('No documents found in sample_docs directory');
      return;
    }

    logger.info(`Found ${textFiles.length} documents to ingest`);

    let totalChunks = 0;

    for (const file of textFiles) {
      const filePath = path.join(SAMPLE_DOCS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');

      logger.info(`Ingesting: ${file}`);

      const result = await ingestDocument(content, {
        source: file,
        ingestedAt: new Date().toISOString(),
      });

      totalChunks += result.chunksAdded;
      logger.info(`  Added ${result.chunksAdded} chunks from ${file}`);
    }

    logger.info('Ingestion complete!');
    logger.info(`Total documents: ${textFiles.length}`);
    logger.info(`Total chunks: ${totalChunks}`);
  } catch (error) {
    logger.error('Ingestion failed', { error: error.message });
    process.exit(1);
  }
}

main();
