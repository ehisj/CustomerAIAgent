import OpenAI from 'openai';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Convert text to speech using OpenAI TTS.
 * @param {string} text - Text to convert to speech
 * @returns {Promise<Buffer>} Audio buffer (MP3 format)
 */
export async function textToSpeech(text) {
  logger.info('Starting TTS', { textLength: text.length });

  try {
    const response = await openai.audio.speech.create({
      model: config.openai.ttsModel,
      voice: config.openai.ttsVoice,
      input: text,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    logger.info('TTS completed', { audioSize: buffer.length });
    return buffer;
  } catch (error) {
    logger.error('TTS failed', { error: error.message });
    throw new Error(`TTS failed: ${error.message}`);
  }
}

/**
 * Alternative: Swap to ElevenLabs
 *
 * 1. npm install elevenlabs
 * 2. Set ELEVENLABS_API_KEY in .env
 *
 * import { ElevenLabsClient } from 'elevenlabs';
 *
 * const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
 *
 * export async function textToSpeechElevenLabs(text) {
 *   const audio = await elevenlabs.generate({
 *     voice: 'Rachel',
 *     text: text,
 *     model_id: 'eleven_monolingual_v1'
 *   });
 *   return Buffer.from(audio);
 * }
 */

/**
 * Alternative: Swap to Coqui TTS (local, open-source)
 *
 * 1. Install Coqui TTS server: pip install TTS
 * 2. Run server: tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC
 *
 * export async function textToSpeechLocal(text) {
 *   const response = await fetch('http://localhost:5002/api/tts', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ text })
 *   });
 *   return Buffer.from(await response.arrayBuffer());
 * }
 */
