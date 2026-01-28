import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3001,

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    ttsModel: process.env.TTS_MODEL || 'tts-1',
    ttsVoice: process.env.TTS_VOICE || 'alloy',
  },

  chroma: {
    host: process.env.CHROMA_HOST || 'http://localhost:8000',
    collectionName: process.env.COLLECTION_NAME || 'customer_docs',
  },

  rag: {
    topK: parseInt(process.env.TOP_K || '3', 10),
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.7'),
  },
};
