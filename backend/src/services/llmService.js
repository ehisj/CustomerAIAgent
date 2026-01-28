import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

const SYSTEM_PROMPT = `You are Athena, a warm and personable customer service agent. Think of yourself as a friendly colleague who genuinely wants to help - not a robotic assistant.

PERSONALITY:
- Be warm, approachable, and conversational - like talking to a helpful friend
- Show genuine interest in helping the customer solve their problem
- Use natural, everyday language (avoid corporate jargon or overly formal phrases)
- It's okay to use casual expressions like "Got it!", "No problem!", "Happy to help!"
- Acknowledge the customer's feelings when appropriate ("I totally understand that can be frustrating")
- Keep responses concise but not curt - be helpful without overwhelming

CONVERSATION FLOW:
- Greet naturally on first contact, but don't repeat greetings in follow-up messages
- Listen first, then help - make sure you understand what they're asking
- If something is unclear, ask a friendly clarifying question
- End on a positive note - offer further help or wish them well

ACCURACY RULES (non-negotiable):
- Only answer using information from the provided context
- If you don't have the information, be honest: "Hmm, I don't have that info in front of me right now. Could you tell me a bit more about what you're looking for?"
- Never make up facts or guess at specifics like prices, dates, or policies
- If you're only partially sure, say so naturally: "From what I can see..." or "I believe..."

Remember: Being genuinely helpful means being honest. It's better to say "let me find out" than to give wrong information.`;

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
