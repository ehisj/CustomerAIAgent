import { ChromaClient } from 'chromadb';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { chunkText } from '../utils/chunker.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

let client = null;
let collection = null;

/**
 * Generate a stable document ID.
 * @returns {string} UUID for the document
 */
export function generateDocumentId() {
  return uuidv4();
}

/**
 * Initialize Chroma client and get/create collection.
 */
async function getCollection() {
  if (collection) return collection;

  try {
    client = new ChromaClient({ path: config.chroma.host });
    collection = await client.getOrCreateCollection({
      name: config.chroma.collectionName,
      metadata: { 'hnsw:space': 'cosine' },
    });
    logger.info('Connected to Chroma collection', { name: config.chroma.collectionName });
    return collection;
  } catch (error) {
    logger.error('Failed to connect to Chroma', { error: error.message });
    throw new Error(`Vector DB connection failed: ${error.message}`);
  }
}

/**
 * Generate embeddings for text using OpenAI.
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<number[][]>} Array of embeddings
 */
async function generateEmbeddings(texts) {
  const response = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

/**
 * Ingest a document into the vector database.
 * @param {string} text - Document text
 * @param {object} metadata - Document metadata (e.g., filename, source, documentId)
 * @returns {Promise<{chunksAdded: number, documentId: string}>}
 */
export async function ingestDocument(text, metadata = {}) {
  const coll = await getCollection();

  // Generate or use provided documentId for tracking all chunks
  const documentId = metadata.documentId || generateDocumentId();

  const chunks = chunkText(text);
  logger.info('Chunking document', { chunks: chunks.length, source: metadata.source, documentId });

  const ids = chunks.map(() => uuidv4());
  const embeddings = await generateEmbeddings(chunks);

  const metadatas = chunks.map((chunk, index) => ({
    ...metadata,
    documentId,
    chunkIndex: index,
    chunkTotal: chunks.length,
  }));

  await coll.add({
    ids,
    embeddings,
    documents: chunks,
    metadatas,
  });

  logger.info('Document ingested', { chunksAdded: chunks.length, documentId });
  return { chunksAdded: chunks.length, documentId };
}

/**
 * Query the vector database for relevant chunks.
 * @param {string} query - Query text
 * @param {number} topK - Number of results to return
 * @returns {Promise<{chunks: Array<{text: string, metadata: object, distance: number}>}>}
 */
export async function queryVector(query, topK = config.rag.topK) {
  const coll = await getCollection();

  const [queryEmbedding] = await generateEmbeddings([query]);

  const results = await coll.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    include: ['documents', 'metadatas', 'distances'],
  });

  const chunks = [];
  if (results.documents && results.documents[0]) {
    for (let i = 0; i < results.documents[0].length; i++) {
      chunks.push({
        text: results.documents[0][i],
        metadata: results.metadatas[0][i],
        distance: results.distances[0][i],
      });
    }
  }

  logger.info('Vector query completed', { query: query.substring(0, 50), results: chunks.length });
  return { chunks };
}

/**
 * Delete all documents from the collection.
 */
export async function clearCollection() {
  try {
    client = new ChromaClient({ path: config.chroma.host });
    await client.deleteCollection({ name: config.chroma.collectionName });
    collection = null;
    logger.info('Collection cleared');
    return { success: true };
  } catch (error) {
    logger.error('Failed to clear collection', { error: error.message });
    throw error;
  }
}

/**
 * List all documents in the collection (grouped by documentId).
 * @returns {Promise<{documents: Array<{documentId: string, filename: string, filetype: string, uploadedAt: string, chunkCount: number}>}>}
 */
export async function listDocuments() {
  const coll = await getCollection();

  try {
    // Get all items from the collection
    const result = await coll.get({
      include: ['metadatas'],
    });

    if (!result.metadatas || result.metadatas.length === 0) {
      return { documents: [] };
    }

    // Group by documentId
    const documentsMap = new Map();

    for (const metadata of result.metadatas) {
      const docId = metadata.documentId || metadata.source; // Fallback for legacy docs

      if (!documentsMap.has(docId)) {
        documentsMap.set(docId, {
          documentId: docId,
          filename: metadata.source || 'Unknown',
          filetype: metadata.filetype || 'txt',
          uploadedAt: metadata.ingestedAt || metadata.uploadedAt || null,
          chunkCount: 0,
        });
      }

      documentsMap.get(docId).chunkCount++;
    }

    // Convert to array and sort by upload date (newest first)
    const documents = Array.from(documentsMap.values()).sort((a, b) => {
      if (!a.uploadedAt) return 1;
      if (!b.uploadedAt) return -1;
      return new Date(b.uploadedAt) - new Date(a.uploadedAt);
    });

    logger.info('Listed documents', { count: documents.length });
    return { documents };
  } catch (error) {
    logger.error('Failed to list documents', { error: error.message });
    throw error;
  }
}

/**
 * Delete a document and all its chunks from the collection.
 * @param {string} documentId - The document ID to delete
 * @returns {Promise<{deleted: boolean, documentId: string, chunksDeleted: number}>}
 */
export async function deleteDocument(documentId) {
  const coll = await getCollection();

  try {
    // Find all chunk IDs for this document
    const result = await coll.get({
      where: { documentId: documentId },
      include: ['metadatas'],
    });

    if (!result.ids || result.ids.length === 0) {
      // Try fallback for legacy documents (using source as documentId)
      const legacyResult = await coll.get({
        where: { source: documentId },
        include: ['metadatas'],
      });

      if (!legacyResult.ids || legacyResult.ids.length === 0) {
        logger.warn('Document not found for deletion', { documentId });
        return { deleted: false, documentId, chunksDeleted: 0 };
      }

      // Delete legacy document chunks
      await coll.delete({ ids: legacyResult.ids });
      logger.info('Legacy document deleted', { documentId, chunksDeleted: legacyResult.ids.length });
      return { deleted: true, documentId, chunksDeleted: legacyResult.ids.length };
    }

    // Delete all chunks
    await coll.delete({ ids: result.ids });

    logger.info('Document deleted', { documentId, chunksDeleted: result.ids.length });
    return { deleted: true, documentId, chunksDeleted: result.ids.length };
  } catch (error) {
    logger.error('Failed to delete document', { documentId, error: error.message });
    throw error;
  }
}

/**
 * Get collection statistics.
 * @returns {Promise<{totalChunks: number, totalDocuments: number}>}
 */
export async function getCollectionStats() {
  const coll = await getCollection();

  try {
    const count = await coll.count();
    const { documents } = await listDocuments();

    return {
      totalChunks: count,
      totalDocuments: documents.length,
    };
  } catch (error) {
    logger.error('Failed to get collection stats', { error: error.message });
    throw error;
  }
}

/**
 * Alternative: Swap to Qdrant or Pinecone
 *
 * For Qdrant:
 * 1. npm install @qdrant/js-client-rest
 * 2. Replace ChromaClient with QdrantClient
 * 3. Adjust upsert/search methods per Qdrant API
 *
 * For Pinecone:
 * 1. npm install @pinecone-database/pinecone
 * 2. Initialize with API key and environment
 * 3. Use index.upsert() and index.query()
 */
