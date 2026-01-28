# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Voice-enabled AI customer service agent with RAG (Retrieval-Augmented Generation). Users speak or type questions, the system retrieves relevant context from a vector database, generates LLM responses grounded in that context, and speaks the response back via TTS.

## Development Commands

```bash
# Start Chroma vector database
docker-compose up -d

# Backend
cd backend && npm install
npm run dev         # Start with hot reload
npm run ingest      # Ingest sample documents into vector DB
npm run ingest -- --clear  # Clear and re-ingest

# Frontend
cd frontend && npm install
npm run dev         # Start Vite dev server (http://localhost:5173)
npm run build       # Production build
```

## Architecture

### Stack
- **Frontend**: Vue 3 + Vite (port 5173)
- **Backend**: Node.js + Express (port 3001)
- **Vector DB**: Chroma (port 8000, via Docker)
- **AI Services**: OpenAI (Whisper STT, GPT-4o-mini, text-embedding-3-small, TTS)

### Key Files
- `backend/src/services/` - Core services (sttService, vectorService, llmService, ttsService)
- `backend/src/routes/chat.js` - Voice and text chat endpoints
- `backend/src/routes/ingest.js` - Document ingestion endpoints
- `frontend/src/App.vue` - Main UI with mode toggle and response display
- `frontend/src/components/AudioRecorder.vue` - MediaRecorder-based voice capture

### Data Flow (Voice)
1. Audio captured via MediaRecorder → sent as multipart/form-data
2. STT transcribes → Vector search retrieves top-K chunks
3. LLM generates response with context → TTS converts to audio
4. Response returned with transcript, text, sources, confidence, and base64 audio

### RAG Pipeline
- Documents chunked (500 chars, 50 overlap) and embedded via OpenAI
- Query embedded and matched against Chroma using cosine similarity
- Confidence threshold (0.7) determines if agent hedges response
- LLM prompted with strict "use context only" instructions

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/voice` | POST | Audio in → full pipeline → response + TTS |
| `/api/chat/text` | POST | Text in → RAG → response (optional TTS) |
| `/api/ingest` | POST | Upload document file |
| `/api/ingest/text` | POST | Ingest raw text |
| `/api/ingest` | DELETE | Clear vector collection |

## Configuration

Environment variables in `backend/.env`:
- `OPENAI_API_KEY` - Required for all AI services
- `CHROMA_HOST` - Vector DB URL (default: http://localhost:8000)
- `TOP_K` - Number of chunks to retrieve (default: 3)
- `CONFIDENCE_THRESHOLD` - Similarity threshold (default: 0.7)
- `LLM_MODEL`, `EMBEDDING_MODEL`, `TTS_MODEL`, `TTS_VOICE` - Model selection

## Swapping Components

Each service file contains commented alternative implementations:
- **Vector DB**: Chroma → Qdrant/Pinecone (see vectorService.js)
- **LLM**: OpenAI → Ollama local (see llmService.js)
- **STT**: Whisper API → whisper.cpp local (see sttService.js)
- **TTS**: OpenAI → ElevenLabs/Coqui (see ttsService.js)
