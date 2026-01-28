<template>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <h1>AI Customer Agent</h1>
        <nav class="nav-toggle" role="tablist">
          <button
            :class="['nav-btn', { active: currentView === 'chat' }]"
            @click="currentView = 'chat'"
            role="tab"
            :aria-selected="currentView === 'chat'"
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Chat
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
            Documents
          </button>
        </nav>
      </div>
    </header>

    <main class="main">
      <!-- Chat View -->
      <div v-if="currentView === 'chat'" class="chat-view">
        <div class="transcript-card">
          <!-- Card Header -->
          <div class="transcript-header">
            <span class="transcript-title">Transcript</span>
            <span class="brand-label">AI Agent</span>
          </div>

          <!-- Messages -->
          <div class="messages-area" ref="messagesArea">
            <div v-if="messages.length === 0" class="empty-state">
              <p>No messages yet. Start a conversation below.</p>
            </div>
            <div
              v-for="(msg, index) in messages"
              :key="index"
              :class="['message-row', { alt: index % 2 === 1 }]"
            >
              <span class="msg-time">[{{ msg.time }}]</span>
              <div class="msg-body">
                <span :class="['msg-sender', msg.role]">
                  {{ msg.role === 'customer' ? 'Customer:' : 'Agent:' }}
                </span>
                <span class="msg-text">{{ msg.text }}</span>
                <span v-if="msg.role === 'agent' && msg.isConfident === false" class="confidence-badge low">Low Confidence</span>
                <span v-if="msg.role === 'agent' && msg.isConfident === true" class="confidence-badge high">High Confidence</span>
                <!-- Inline audio player -->
                <div v-if="msg.audioUrl" class="msg-audio">
                  <audio :src="msg.audioUrl" controls></audio>
                </div>
                <!-- Sources toggle -->
                <div v-if="msg.sources?.length" class="msg-sources">
                  <button class="sources-toggle" @click="msg.showSources = !msg.showSources">
                    {{ msg.showSources ? 'Hide' : 'Show' }} sources ({{ msg.sources.length }})
                  </button>
                  <div v-if="msg.showSources" class="sources-list">
                    <div v-for="(src, si) in msg.sources" :key="si" class="source-item">
                      <span class="source-name">{{ src.source }}</span>
                      <span class="source-relevance">{{ (src.relevance * 100).toFixed(0) }}%</span>
                      <p class="source-snippet">{{ src.snippet }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Loading row -->
            <div v-if="isLoading" class="message-row alt loading-row">
              <span class="msg-time">&nbsp;</span>
              <div class="msg-body">
                <div class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
                <span class="loading-text">{{ loadingMessage }}</span>
              </div>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="error-bar">
            <p>{{ error }}</p>
            <button @click="error = null" class="dismiss-btn">Dismiss</button>
          </div>

          <!-- Input Area -->
          <div class="input-area">
            <div class="mode-switch">
              <button :class="['mode-pill', { active: mode === 'text' }]" @click="mode = 'text'">Text</button>
              <button :class="['mode-pill', { active: mode === 'voice' }]" @click="mode = 'voice'">Voice</button>
            </div>
            <div v-if="mode === 'text'" class="text-input-row">
              <form @submit.prevent="handleTextInput" class="text-form">
                <input
                  v-model="textInput"
                  type="text"
                  placeholder="Type your question..."
                  :disabled="isLoading"
                  class="text-input"
                />
                <button type="submit" :disabled="isLoading || !textInput.trim()" class="send-btn">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </form>
            </div>
            <div v-else class="voice-input-row">
              <AudioRecorder @recording-complete="handleVoiceInput" :disabled="isLoading" />
            </div>
          </div>
        </div>
      </div>

      <!-- Documents View -->
      <div v-else class="documents-container">
        <DocumentLibrary />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onUnmounted } from 'vue';
import AudioRecorder from './components/AudioRecorder.vue';
import DocumentLibrary from './components/DocumentLibrary.vue';

const currentView = ref('chat');
const mode = ref('text');
const textInput = ref('');
const isLoading = ref(false);
const loadingMessage = ref('');
const error = ref(null);
const messages = reactive([]);
const messagesArea = ref(null);

function formatTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesArea.value) {
      messagesArea.value.scrollTop = messagesArea.value.scrollHeight;
    }
  });
}

function autoPlayAudio(url) {
  nextTick(() => {
    const audioEl = messagesArea.value?.querySelector('audio[src="' + url + '"]');
    if (audioEl) {
      audioEl.play().catch(() => {});
    }
  });
}

// Track audio URLs for cleanup
const audioUrls = [];
onUnmounted(() => {
  audioUrls.forEach(url => URL.revokeObjectURL(url));
});

function createAudioUrl(base64Audio) {
  const audioBytes = atob(base64Audio);
  const audioArray = new Uint8Array(audioBytes.length);
  for (let i = 0; i < audioBytes.length; i++) {
    audioArray[i] = audioBytes.charCodeAt(i);
  }
  const blob = new Blob([audioArray], { type: 'audio/mp3' });
  const url = URL.createObjectURL(blob);
  audioUrls.push(url);
  return url;
}

async function handleVoiceInput({ blob, mimeType }) {
  error.value = null;
  isLoading.value = true;

  try {
    loadingMessage.value = 'Transcribing audio...';

    const baseMime = mimeType.split(';')[0];
    const extMap = {
      'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3',
      'audio/wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg',
    };
    const ext = extMap[baseMime] || 'webm';

    const formData = new FormData();
    formData.append('audio', blob, `recording.${ext}`);

    const response = await fetch('/api/chat/voice', { method: 'POST', body: formData });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to process audio');
    }

    loadingMessage.value = 'Processing response...';
    const data = await response.json();

    // Push customer message
    messages.push({ role: 'customer', text: data.transcript, time: formatTime() });
    scrollToBottom();

    // Push agent message
    const agentMsg = {
      role: 'agent',
      text: data.response,
      time: formatTime(),
      sources: data.sources,
      isConfident: data.isConfident,
      showSources: false,
      audioUrl: null,
    };

    if (data.audio) {
      agentMsg.audioUrl = createAudioUrl(data.audio);
    }

    messages.push(agentMsg);
    scrollToBottom();
    if (agentMsg.audioUrl) autoPlayAudio(agentMsg.audioUrl);
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

  const userText = textInput.value;
  textInput.value = '';

  // Push customer message immediately
  messages.push({ role: 'customer', text: userText, time: formatTime() });
  scrollToBottom();

  error.value = null;
  isLoading.value = true;

  try {
    loadingMessage.value = 'Processing...';

    const response = await fetch('/api/chat/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText, includeTts: true }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to process message');
    }

    const data = await response.json();

    const agentMsg = {
      role: 'agent',
      text: data.response,
      time: formatTime(),
      sources: data.sources,
      isConfident: data.isConfident,
      showSources: false,
      audioUrl: null,
    };

    if (data.audio) {
      agentMsg.audioUrl = createAudioUrl(data.audio);
    }

    messages.push(agentMsg);
    scrollToBottom();
    if (agentMsg.audioUrl) autoPlayAudio(agentMsg.audioUrl);
  } catch (err) {
    error.value = err.message;
    console.error('Text input error:', err);
  } finally {
    isLoading.value = false;
    loadingMessage.value = '';
  }
}
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1b2a4a;
}

/* Header */
.header {
  background: #152238;
  padding: 1rem 2rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.header-content {
  max-width: 700px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header h1 {
  color: #fff;
  font-size: 1.25rem;
  margin: 0;
}

.nav-toggle {
  display: flex;
  gap: 0.375rem;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.7);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: rgba(255,255,255,0.15);
}

.nav-btn.active {
  background: #fff;
  color: #1b2a4a;
  border-color: #fff;
}

.nav-icon {
  width: 16px;
  height: 16px;
}

/* Main */
.main {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
}

.chat-view {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
}

/* Transcript Card */
.transcript-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  max-height: calc(100vh - 140px);
}

.transcript-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.transcript-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1b2a4a;
}

.brand-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e6982e;
}

/* Messages */
.messages-area {
  flex: 1;
  overflow-y: auto;
  min-height: 200px;
}

.empty-state {
  padding: 3rem 1.5rem;
  text-align: center;
  color: #9ca3af;
}

.message-row {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.5rem;
}

.message-row.alt {
  background: #f3f4f6;
}

.msg-time {
  color: #2a9d8f;
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  min-width: 52px;
  padding-top: 2px;
}

.msg-body {
  flex: 1;
}

.msg-sender {
  font-weight: 700;
  display: block;
  margin-bottom: 0.25rem;
}

.msg-sender.customer {
  color: #1b2a4a;
}

.msg-sender.agent {
  color: #2a9d8f;
}

.msg-text {
  color: #374151;
  line-height: 1.6;
}

.confidence-badge {
  display: inline-block;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
  vertical-align: middle;
  font-weight: 500;
}

.confidence-badge.high {
  background: #dcfce7;
  color: #166534;
}

.confidence-badge.low {
  background: #fef3c7;
  color: #92400e;
}

.msg-audio {
  margin-top: 0.5rem;
}

.msg-audio audio {
  width: 100%;
  height: 36px;
}

/* Sources */
.msg-sources {
  margin-top: 0.5rem;
}

.sources-toggle {
  background: none;
  border: 1px solid #d1d5db;
  color: #6b7280;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.sources-toggle:hover {
  background: #f9fafb;
}

.sources-list {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.source-item {
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
}

.source-name {
  font-weight: 600;
  color: #2a9d8f;
  font-size: 0.85rem;
}

.source-relevance {
  float: right;
  font-size: 0.8rem;
  color: #9ca3af;
}

.source-snippet {
  font-size: 0.8rem;
  color: #6b7280;
  margin-top: 0.25rem;
  line-height: 1.4;
}

/* Loading */
.loading-row {
  align-items: center;
}

.typing-indicator {
  display: inline-flex;
  gap: 4px;
  margin-right: 0.5rem;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #2a9d8f;
  border-radius: 50%;
  animation: bounce 1.2s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

.loading-text {
  font-size: 0.85rem;
  color: #9ca3af;
}

/* Error */
.error-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 0.9rem;
}

.dismiss-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

/* Input Area */
.input-area {
  border-top: 1px solid #e5e7eb;
  padding: 1rem 1.5rem;
}

.mode-switch {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.mode-pill {
  padding: 0.35rem 1rem;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #6b7280;
  border-radius: 20px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-pill.active {
  background: #1b2a4a;
  color: #fff;
  border-color: #1b2a4a;
}

.text-form {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.text-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.text-input:focus {
  outline: none;
  border-color: #2a9d8f;
}

.send-btn {
  width: 44px;
  height: 44px;
  background: #1b2a4a;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #2a9d8f;
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn svg {
  width: 20px;
  height: 20px;
}

.voice-input-row {
  display: flex;
  justify-content: center;
}

/* Documents */
.documents-container {
  max-width: 900px;
  width: 100%;
}

/* Responsive */
@media (max-width: 480px) {
  .header-content {
    flex-direction: column;
    gap: 0.75rem;
  }

  .main {
    padding: 1rem 0.5rem;
  }

  .message-row {
    padding: 0.75rem 1rem;
    gap: 0.75rem;
  }
}
</style>
