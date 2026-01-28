# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Vue 3 Frontend                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │AudioRecorder │  │ Text Input   │  │   Response Display       │   │
│  │  (WebAudio)  │  │              │  │ (Transcript, Sources)    │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘   │
│         │                 │                       ▲                  │
│         └────────┬────────┘                       │                  │
│                  ▼                                │                  │
│         ┌───────────────┐                         │                  │
│         │  API Client   │─────────────────────────┘                  │
│         └───────┬───────┘                                           │
└─────────────────┼───────────────────────────────────────────────────┘
                  │ HTTP (multipart/form-data or JSON)
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Node.js Backend (Express)                       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                        API Routes                            │    │
│  │  POST /api/chat/voice  │  POST /api/chat/text  │ POST /api/ingest│
│  └─────────┬──────────────┴──────────┬────────────┴──────┬──────┘   │
│            │                         │                    │          │
│            ▼                         ▼                    ▼          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                       Services Layer                         │    │
│  │                                                              │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │    │
│  │  │STTService│  │VectorSvc │  │LLMService│  │TTSService│    │    │
│  │  │(Whisper) │  │ (Chroma) │  │  (GPT)   │  │(OpenAI)  │    │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │    │
│  └───────┼─────────────┼─────────────┼─────────────┼───────────┘    │
└──────────┼─────────────┼─────────────┼─────────────┼────────────────┘
           │             │             │             │
           ▼             ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ OpenAI   │  │  Chroma  │  │ OpenAI   │  │ OpenAI   │
    │ Whisper  │  │   DB     │  │   GPT    │  │   TTS    │
    └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

## Data Flow

### Voice Chat Flow

1. User presses and holds record button
2. Frontend captures audio via MediaRecorder API
3. Audio blob sent to `/api/chat/voice` as multipart/form-data
4. Backend processes:
   - **STT Service**: Transcribes audio using Whisper API
   - **Vector Service**: Embeds transcript and queries Chroma for relevant chunks
   - **LLM Service**: Generates response using GPT with retrieved context
   - **TTS Service**: Converts response to speech audio
5. Response returned with transcript, response text, sources, and audio (base64)
6. Frontend displays results and auto-plays audio response

### Text Chat Flow

Same as voice flow but skips STT step. Optionally includes TTS in response.

### Document Ingestion Flow

1. Document uploaded via `/api/ingest`
2. Text extracted and chunked (500 chars with 50 char overlap)
3. Each chunk embedded using OpenAI embeddings
4. Chunks stored in Chroma with metadata

## RAG Pipeline

```
Query → Embed → Vector Search → Top-K Chunks → LLM Prompt → Response
                     │
                     ▼
            Confidence Check
            (avg distance < threshold)
                     │
          ┌─────────┴─────────┐
          ▼                   ▼
    High Confidence      Low Confidence
    (normal answer)   (hedged answer +
                       clarification)
```

## Key Design Decisions

1. **OpenAI for all AI services**: Simplifies setup and provides consistent quality. Alternative implementations documented in service files.

2. **Chroma for vector storage**: Open-source, easy to run locally via Docker, good for prototyping.

3. **Chunking strategy**: 500 character chunks with 50 character overlap balances context size with retrieval precision.

4. **Confidence threshold**: Uses cosine distance (0.7 similarity threshold) to determine when to hedge responses.

5. **Base64 audio transport**: Simpler than streaming for prototype; could be optimized for production.

## Service Interfaces

### STT Service
```javascript
transcribeAudio(audioFilePath) → { text, language }
```

### Vector Service
```javascript
ingestDocument(text, metadata) → { chunksAdded }
queryVector(query, topK) → { chunks: [{ text, metadata, distance }] }
clearCollection() → { success }
```

### LLM Service
```javascript
generateResponse(query, contextChunks) → { response, isConfident }
```

### TTS Service
```javascript
textToSpeech(text) → Buffer (MP3)
```
