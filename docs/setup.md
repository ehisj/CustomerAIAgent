# Setup Guide

## Prerequisites

- Node.js 18+
- Docker (for running Chroma)
- OpenAI API key

## Quick Start

### 1. Clone and Configure

```bash
# Copy environment file
cp backend/.env.example backend/.env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-key-here
```

### 2. Start Chroma Vector Database

```bash
docker-compose up -d
```

Verify Chroma is running:
```bash
curl http://localhost:8000/api/v1/heartbeat
```

### 3. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 4. Ingest Sample Documents

```bash
cd backend
npm run ingest
```

### 5. Start the Application

Terminal 1 (Backend):
```bash
cd backend && npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend && npm run dev
```

### 6. Open the Application

Navigate to http://localhost:5173

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (required) | Your OpenAI API key |
| `PORT` | 3001 | Backend server port |
| `CHROMA_HOST` | http://localhost:8000 | Chroma database URL |
| `COLLECTION_NAME` | customer_docs | Vector collection name |
| `TOP_K` | 3 | Number of chunks to retrieve |
| `CONFIDENCE_THRESHOLD` | 0.7 | Similarity threshold (0-1) |
| `LLM_MODEL` | gpt-4o-mini | OpenAI model for responses |
| `EMBEDDING_MODEL` | text-embedding-3-small | OpenAI embedding model |
| `TTS_MODEL` | tts-1 | OpenAI TTS model |
| `TTS_VOICE` | alloy | TTS voice (alloy, echo, fable, onyx, nova, shimmer) |

## Troubleshooting

### Microphone not working
- Ensure browser has microphone permissions
- Check that you're using HTTPS or localhost
- Try a different browser (Chrome recommended)

### Chroma connection errors
- Verify Docker container is running: `docker ps`
- Check Chroma logs: `docker-compose logs chroma`
- Ensure port 8000 is not in use

### OpenAI API errors
- Verify API key is correctly set in .env
- Check API key has sufficient credits
- Ensure API key has access to required models

### Audio playback issues
- Check browser audio permissions
- Verify response includes audio data
- Try refreshing the page
