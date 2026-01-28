import OpenAI, { toFile } from 'openai';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);
const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Convert audio to MP3 format using ffmpeg for Whisper compatibility.
 * @param {string} inputPath - Path to input audio file
 * @returns {Promise<string>} Path to converted MP3 file
 */
async function convertToMp3(inputPath) {
  const outputPath = inputPath.replace(/\.[^.]+$/, '') + '_converted.mp3';

  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    logger.error('Input audio file does not exist', { path: inputPath });
    throw new Error(`Audio file not found: ${inputPath}`);
  }

  const stats = fs.statSync(inputPath);
  logger.info('Input audio file', { path: inputPath, size: stats.size });

  try {
    const { stdout, stderr } = await execAsync(
      `ffmpeg -y -i "${inputPath}" -vn -ar 16000 -ac 1 -b:a 64k "${outputPath}" 2>&1`
    );

    if (!fs.existsSync(outputPath)) {
      logger.error('FFmpeg did not create output file', { stderr });
      throw new Error('FFmpeg conversion failed');
    }

    const outStats = fs.statSync(outputPath);
    logger.info('Audio converted to MP3', { input: inputPath, output: outputPath, outputSize: outStats.size });
    return outputPath;
  } catch (error) {
    logger.error('FFmpeg conversion failed', { error: error.message, stderr: error.stderr });
    // Try to use original file anyway
    return inputPath;
  }
}

/**
 * Transcribes audio file to text using OpenAI Whisper.
 * @param {string} audioFilePath - Path to the audio file
 * @returns {Promise<{text: string, language: string}>} Transcription result
 */
export async function transcribeAudio(audioFilePath) {
  logger.info('Starting audio transcription', { file: audioFilePath });

  let convertedPath = null;

  try {
    // Convert to MP3 for guaranteed Whisper compatibility
    convertedPath = await convertToMp3(audioFilePath);

    // Read file and create proper File object for OpenAI SDK
    const audioBuffer = fs.readFileSync(convertedPath);
    const fileName = 'audio.mp3'; // Use explicit .mp3 extension

    logger.info('Sending to Whisper', { fileName, size: audioBuffer.length });

    // Use toFile helper from OpenAI SDK
    const audioFile = await toFile(audioBuffer, fileName);

    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      response_format: 'verbose_json',
    });

    logger.info('Transcription completed', {
      text: response.text.substring(0, 100),
      language: response.language,
    });

    return {
      text: response.text,
      language: response.language || 'en',
    };
  } catch (error) {
    logger.error('Transcription failed', { error: error.message });
    throw new Error(`STT failed: ${error.message}`);
  } finally {
    // Clean up converted file if it was created
    if (convertedPath && convertedPath !== audioFilePath) {
      try {
        fs.unlinkSync(convertedPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Alternative: Use local Whisper via whisper.cpp
 * To swap to local Whisper:
 * 1. Install whisper.cpp: https://github.com/ggerganov/whisper.cpp
 * 2. Download a model (e.g., ggml-base.en.bin)
 * 3. Uncomment and use this function instead:
 *
 * import { exec } from 'child_process';
 * import { promisify } from 'util';
 * const execAsync = promisify(exec);
 *
 * export async function transcribeAudioLocal(audioFilePath) {
 *   const whisperPath = process.env.WHISPER_CPP_PATH || './whisper.cpp/main';
 *   const modelPath = process.env.WHISPER_MODEL_PATH || './models/ggml-base.en.bin';
 *
 *   const { stdout } = await execAsync(
 *     `${whisperPath} -m ${modelPath} -f ${audioFilePath} -otxt`
 *   );
 *   return { text: stdout.trim(), language: 'en' };
 * }
 */
