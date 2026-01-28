<template>
  <div class="audio-recorder">
    <button
      @mousedown="startRecording"
      @mouseup="stopRecording"
      @mouseleave="stopRecording"
      @touchstart.prevent="startRecording"
      @touchend.prevent="stopRecording"
      :disabled="disabled"
      :class="['record-btn', { recording: isRecording }]"
    >
      <div class="record-icon">
        <svg v-if="!isRecording" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      </div>
      <span class="record-text">
        {{ isRecording ? 'Release to send' : 'Hold to speak' }}
      </span>
    </button>

    <!-- Audio Visualization -->
    <div v-if="isRecording" class="visualizer">
      <div
        v-for="i in 5"
        :key="i"
        class="bar"
        :style="{ animationDelay: `${i * 0.1}s` }"
      ></div>
    </div>

    <p class="hint">
      {{ isRecording ? 'Listening...' : 'Press and hold the button to record' }}
    </p>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue';

const props = defineProps({
  disabled: Boolean,
});

const emit = defineEmits(['recording-complete']);

const isRecording = ref(false);
let mediaRecorder = null;
let audioChunks = [];
let currentStream = null;
let currentMimeType = '';

async function startRecording() {
  if (props.disabled || isRecording.value) return;

  try {
    // Request microphone with specific constraints for better quality
    currentStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      }
    });

    // Try formats in order of compatibility
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    currentMimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        currentMimeType = type;
        break;
      }
    }

    if (!currentMimeType) {
      currentMimeType = 'audio/webm';
    }

    console.log('Recording with mimeType:', currentMimeType);

    mediaRecorder = new MediaRecorder(currentStream, {
      mimeType: currentMimeType,
      audioBitsPerSecond: 128000,
    });
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      console.log('Data available:', event.data.size, 'bytes');
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      console.log('Recording stopped, chunks:', audioChunks.length);

      // Stop all tracks to release microphone
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }

      if (audioChunks.length === 0) {
        console.error('No audio data captured');
        alert('No audio was captured. Please try again and speak into your microphone.');
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: currentMimeType });
      console.log('Created blob:', audioBlob.size, 'bytes');

      if (audioBlob.size < 1000) {
        console.warn('Audio blob is very small, might be empty');
        alert('Recording was too short. Please hold the button longer while speaking.');
        return;
      }

      emit('recording-complete', { blob: audioBlob, mimeType: currentMimeType });
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      alert('Recording error: ' + event.error.message);
    };

    // Start recording - request data every 250ms for more reliable capture
    mediaRecorder.start(250);
    isRecording.value = true;
    console.log('Recording started');
  } catch (error) {
    console.error('Failed to start recording:', error);
    alert('Could not access microphone. Please ensure microphone permissions are granted.\n\nError: ' + error.message);
  }
}

function stopRecording() {
  if (!isRecording.value || !mediaRecorder) return;

  console.log('Stopping recording...');
  mediaRecorder.stop();
  isRecording.value = false;
}

// Clean up on unmount
onUnmounted(() => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
  }
});
</script>

<style scoped>
.audio-recorder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.record-btn {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: none;
  background: #1b2a4a;
  color: white;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(27, 42, 74, 0.3);
}

.record-btn:hover:not(:disabled) {
  transform: scale(1.05);
  background: #2a9d8f;
  box-shadow: 0 4px 16px rgba(42, 157, 143, 0.4);
}

.record-btn:active:not(:disabled),
.record-btn.recording {
  transform: scale(0.95);
  background: #ef4444;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.record-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.record-icon {
  width: 24px;
  height: 24px;
}

.record-icon svg {
  width: 100%;
  height: 100%;
}

.record-text {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.visualizer {
  display: flex;
  gap: 3px;
  height: 24px;
  align-items: center;
}

.bar {
  width: 3px;
  background: #2a9d8f;
  border-radius: 2px;
  animation: pulse 0.5s ease-in-out infinite alternate;
}

@keyframes pulse {
  from { height: 8px; }
  to { height: 24px; }
}

.hint {
  color: #9ca3af;
  font-size: 0.8rem;
}
</style>
