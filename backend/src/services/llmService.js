import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

const SYSTEM_PROMPT = `You are a helpful customer service agent for our company. Your role is to assist customers with their questions based ONLY on the provided context. Also your name is Athena and say "Hello! I'm Athena, your customer service assistant." at the beginning of every response .

IMPORTANT RULES:
0. Start with a brief greeting before answering the question.
1. Only answer questions using information from the provided context
2. If the context doesn't contain relevant information, say "I don't have specific information about that in my knowledge base. Could you please rephrase your question or ask about something else?"
3. Never make up information or hallucinate facts
4. Be concise, friendly, and professional
5. If the question is unclear, ask for clarification
6. If you're partially sure, indicate your confidence level

Always prioritize accuracy over helpfulness. It's better to admit you don't know than to provide incorrect information.`;

/**
 * Generate a response using the LLM with RAG context.
 * @param {string} userQuery - The user's question
 * @param {Array<{text: string, metadata: object, distance: number}>} contextChunks - Retrieved context
 * @returns {Promise<{response: string, isConfident: boolean}>}
 */
export async function generateResponse(userQuery, contextChunks) {
  logger.info('Generating LLM response', { query: userQuery.substring(0, 50) });

  // Check retrieval confidence
  const avgDistance = contextChunks.length > 0
    ? contextChunks.reduce((sum, c) => sum + c.distance, 0) / contextChunks.length
    : 1;

  // Cosine distance: 0 = identical, 2 = opposite. Threshold for "confident" is typically < 0.5
  const isConfident = avgDistance < (1 - config.rag.confidenceThreshold);

  // Format context for the prompt
  const contextText = contextChunks
    .map((chunk, i) => `[Source ${i + 1}: ${chunk.metadata?.source || 'Unknown'}]\n${chunk.text}`)
    .join('\n\n---\n\n');

  const userMessage = isConfident
    ? `Context from our knowledge base:\n\n${contextText}\n\n---\n\nCustomer question: ${userQuery}`
    : `Context from our knowledge base (Note: retrieval confidence is LOW - be extra careful):\n\n${contextText}\n\n---\n\nCustomer question: ${userQuery}\n\nIMPORTANT: The retrieved context may not be highly relevant. If you're unsure, acknowledge this and ask clarifying questions.`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openai.llmModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3, // Lower temperature for more consistent, factual responses
      max_tokens: 500,
    });

    const answer = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    logger.info('LLM response generated', {
      isConfident,
      avgDistance,
      responseLength: answer.length,
    });

    return {
      response: answer,
      isConfident,
    };
  } catch (error) {
    logger.error('LLM generation failed', { error: error.message });
    throw new Error(`LLM failed: ${error.message}`);
  }
}

/**
 * Alternative: Swap to local LLM (e.g., Ollama)
 *
 * For Ollama:
 * 1. Install Ollama: https://ollama.ai
 * 2. Pull a model: ollama pull llama2
 * 3. Use the Ollama REST API:
 *
 * export async function generateResponseLocal(userQuery, contextChunks) {
 *   const response = await fetch('http://localhost:11434/api/chat', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       model: 'llama2',
 *       messages: [
 *         { role: 'system', content: SYSTEM_PROMPT },
 *         { role: 'user', content: `Context:\n${contextText}\n\nQuestion: ${userQuery}` }
 *       ],
 *       stream: false
 *     })
 *   });
 *   const data = await response.json();
 *   return { response: data.message.content, isConfident: true };
 * }
 */
