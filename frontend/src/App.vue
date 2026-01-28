<template>
  <div class="app">
    <header class="header">
      <h1>AI Customer Agent</h1>
      <p class="subtitle">{{ currentView === 'chat' ? 'Speak or type your question' : 'Manage your knowledge base' }}</p>
      <!-- Navigation Toggle -->
      <nav class="nav-toggle" role="tablist" aria-label="Main navigation">
        <button
          :class="['nav-btn', { active: currentView === 'chat' }]"
          @click="currentView = 'chat'"
          role="tab"
          :aria-selected="currentView === 'chat'"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Chat</span>
        </button>
        <button
          :class="['nav-btn', { active: currentView === 'documents' }]"
          @click="currentView = 'documents'"
          role="tab"
          :aria-selected="currentView === 'documents'"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <span>Documents</span>
        </button>
      </nav>
    </header>

    <main class="main">
      <!-- Chat View -->
      <div v-if="currentView === 'chat'" class="chat-container">
        <!-- Mode Toggle -->
        <div class="mode-toggle">
          <button
            :class="['mode-btn', { active: mode === 'voice' }]"
            @click="mode = 'voice'"
          >
            Voice
          </button>
          <button
            :class="['mode-btn', { active: mode === 'text' }]"
            @click="mode = 'text'"
          >
            Text
          </button>
        </div>

        <!-- Voice Mode -->
        <div v-if="mode === 'voice'" class="voice-mode">
          <AudioRecorder
            @recording-complete="handleVoiceInput"
            :disabled="isLoading"
          />
        </div>

        <!-- Text Mode -->
        <div v-else class="text-mode">
          <form @submit.prevent="handleTextInput" class="text-form">
            <input
              v-model="textInput"
              type="text"
              placeholder="Type your question..."
              :disabled="isLoading"
              class="text-input"
            />
            <button type="submit" :disabled="isLoading || !textInput.trim()" class="send-btn">
              {{ isLoading ? 'Sending...' : 'Send' }}
            </button>
          </form>
        </div>

        <!-- Loading Indicator -->
        <div v-if="isLoading" class="loading">
          <div class="loading-spinner"></div>
          <p>{{ loadingMessage }}</p>
        </div>

        <!-- Error Display -->
        <div v-if="error" class="error">
          <p>{{ error }}</p>
          <button @click="error = null" class="dismiss-btn">Dismiss</button>
        </div>

        <!-- Response Section -->
        <div v-if="lastResponse" class="response-section">
          <!-- Transcript -->
          <div v-if="lastResponse.transcript" class="card transcript-card">
            <h3>Your Question</h3>
            <p>{{ lastResponse.transcript }}</p>
          </div>

          <!-- Agent Response -->
          <div class="card response-card">
            <h3>
              Agent Response
              <span v-if="!lastResponse.isConfident" class="confidence-badge low">
                Low Confidence
              </span>
              <span v-else class="confidence-badge high">
                High Confidence
              </span>
            </h3>
            <p>{{ lastResponse.response }}</p>

            <!-- Audio Player -->
            <div v-if="audioUrl" class="audio-player">
              <audio ref="audioPlayer" :src="audioUrl" controls></audio>
              <button @click="playAudio" class="play-btn">
                Replay Response
              </button>
            </div>
          </div>

          <!-- Sources -->
          <div v-if="lastResponse.sources?.length" class="card sources-card">
            <h3>Retrieved Sources</h3>
            <div class="sources-list">
              <div
                v-for="(source, index) in lastResponse.sources"
                :key="index"
                class="source-item"
              >
                <div class="source-header">
                  <span class="source-name">{{ source.source }}</span>
                  <span class="source-relevance">{{ (source.relevance * 100).toFixed(0) }}% match</span>
                </div>
                <p class="source-snippet">{{ source.snippet }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Documents View -->
      <div v-else class="documents-container">
        <DocumentLibrary />
      </div>
    </main>

    <footer class="footer">
      <p>Powered by OpenAI Whisper, GPT, and Chroma Vector DB</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';
import AudioRecorder from './components/AudioRecorder.vue';
import DocumentLibrary from './components/DocumentLibrary.vue';

const currentView = ref('chat');
const mode = ref('voice');
const textInput = ref('');
const isLoading = ref(false);
const loadingMessage = ref('');
const error = ref(null);
const lastResponse = ref(null);
const audioUrl = ref(null);
const audioPlayer = ref(null);

// Clean up audio URL on unmount
onUnmounted(() => {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value);
  }
});

async function handleVoiceInput({ blob, mimeType }) {
  error.value = null;
  isLoading.value = true;

  try {
    loadingMessage.value = 'Transcribing audio...';

    // Determine correct file extension from mimeType (strip codec info)
    const baseMime = mimeType.split(';')[0];
    const extMap = {
      'audio/webm': 'webm',
      'audio/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/ogg': 'ogg',
    };
    const ext = extMap[baseMime] || 'webm';

    const formData = new FormData();
    formData.append('audio', blob, `recording.${ext}`);

    const response = await fetch('/api/chat/voice', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to process audio');
    }

    loadingMessage.value = 'Processing response...';
    const data = await response.json();

    lastResponse.value = {
      transcript: data.transcript,
      response: data.response,
      sources: data.sources,
      isConfident: data.isConfident,
    };

    // Convert base64 audio to blob URL
    if (data.audio) {
      if (audioUrl.value) {
        URL.revokeObjectURL(audioUrl.value);
      }
      const audioBytes = atob(data.audio);
      const audioArray = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i);
      }
      const blob = new Blob([audioArray], { type: 'audio/mp3' });
      audioUrl.value = URL.createObjectURL(blob);

      // Auto-play the response
      setTimeout(() => {
        if (audioPlayer.value) {
          audioPlayer.value.play();
        }
      }, 100);
    }
  } catch (err) {
    error.value = err.message;
    console.error('Voice input error:', err);
  } finally {
    isLoading.value = false;
    loadingMessage.value = '';
  }
}

async function handleTextInput() {
  if (!textInput.value.trim()) return;

  error.value = null;
  isLoading.value = true;

  try {
    loadingMessage.value = 'Processing...';

    const response = await fetch('/api/chat/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: textInput.value,
        includeTts: true,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to process message');
    }

    const data = await response.json();

    lastResponse.value = {
      transcript: textInput.value,
      response: data.response,
      sources: data.sources,
      isConfident: data.isConfident,
    };

    // Convert base64 audio to blob URL
    if (data.audio) {
      if (audioUrl.value) {
        URL.revokeObjectURL(audioUrl.value);
      }
      const audioBytes = atob(data.audio);
      const audioArray = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i);
      }
      const blob = new Blob([audioArray], { type: 'audio/mp3' });
      audioUrl.value = URL.createObjectURL(blob);
    }

    textInput.value = '';
  } catch (err) {
    error.value = err.message;
    console.error('Text input error:', err);
  } finally {
    isLoading.value = false;
    loadingMessage.value = '';
  }
}

function playAudio() {
  if (audioPlayer.value) {
    audioPlayer.value.currentTime = 0;
    audioPlayer.value.play();
  }
}
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f6fa;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem 2rem;
  text-align: center;
}

.header h1 {
  font-size: 1.75rem;
  margin-bottom: 0.25rem;
}

.subtitle {
  opacity: 0.9;
  font-size: 0.95rem;
  margin-bottom: 1rem;
}

/* Navigation Toggle */
.nav-toggle {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.nav-btn.active {
  background: white;
  color: #667eea;
  border-color: white;
}

.nav-icon {
  width: 18px;
  height: 18px;
}

.main {
  flex: 1;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.chat-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.mode-toggle {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.mode-btn {
  padding: 0.75rem 2rem;
  border: 2px solid #667eea;
  background: white;
  color: #667eea;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.mode-btn.active {
  background: #667eea;
  color: white;
}

.mode-btn:hover:not(.active) {
  background: #f0f2ff;
}

.voice-mode,
.text-mode {
  display: flex;
  justify-content: center;
}

.text-form {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  max-width: 500px;
}

.text-input {
  flex: 1;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.text-input:focus {
  outline: none;
  border-color: #667eea;
}

.send-btn {
  padding: 1rem 2rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #5a6fd6;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e0e0e0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error {
  background: #fee2e2;
  border: 1px solid #ef4444;
  color: #b91c1c;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dismiss-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.response-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card h3 {
  margin-bottom: 1rem;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.transcript-card {
  border-left: 4px solid #667eea;
}

.response-card {
  border-left: 4px solid #22c55e;
}

.confidence-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: normal;
}

.confidence-badge.high {
  background: #dcfce7;
  color: #166534;
}

.confidence-badge.low {
  background: #fef3c7;
  color: #92400e;
}

.audio-player {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.audio-player audio {
  flex: 1;
}

.play-btn {
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
}

.sources-card {
  border-left: 4px solid #f59e0b;
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.source-item {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
}

.source-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.source-name {
  font-weight: 600;
  color: #667eea;
}

.source-relevance {
  font-size: 0.875rem;
  color: #6b7280;
}

.source-snippet {
  font-size: 0.875rem;
  color: #4b5563;
  line-height: 1.5;
}

/* Documents Container */
.documents-container {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.footer {
  background: #1f2937;
  color: #9ca3af;
  text-align: center;
  padding: 1rem;
  font-size: 0.875rem;
}

/* Responsive Navigation */
@media (max-width: 480px) {
  .header {
    padding: 1rem;
  }

  .header h1 {
    font-size: 1.5rem;
  }

  .nav-btn {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
  }

  .nav-icon {
    width: 16px;
    height: 16px;
  }
}
</style>
