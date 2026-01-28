# AI Customer Agent

A voice-enabled AI customer service agent with RAG (Retrieval-Augmented Generation) capabilities. Speak or type questions and receive contextual answers from your knowledge base.

## Features

- **Voice Input**: Press and hold to speak, release to send
- **Text Input**: Type questions directly
- **RAG Pipeline**: Retrieves relevant information from ingested documents
- **Voice Output**: Responses spoken via text-to-speech
- **Confidence Indicators**: Shows when the agent is uncertain
- **Source Attribution**: Displays which documents informed the response
- **Document Library**: Web UI to upload, view, and delete documents
  - Drag-and-drop file upload
  - Supports `.txt`, `.doc`, `.docx`, and `.pdf` formats
  - Search and sort documents
  - Delete documents with confirmation

## Tech Stack

- **Frontend**: Vue 3 + Vite
- **Backend**: Node.js + Express
- **Vector DB**: Chroma
- **AI Services**: OpenAI (Whisper, GPT, Embeddings, TTS)

## Quick Start

### Prerequisites

- Node.js 18+
- Docker
- OpenAI API key

### Setup

```bash
# 1. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and add OPENAI_API_KEY

# 2. Start Chroma
docker-compose up -d

# 3. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 4. Ingest sample documents
cd backend && npm run ingest

# 5. Start backend (Terminal 1)
cd backend && npm run dev

# 6. Start frontend (Terminal 2)
cd frontend && npm run dev

# 7. Open http://localhost:5173
```

## API Endpoints

### Chat Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/voice` | POST | Process voice input (audio → transcript → RAG → response → TTS) |
| `/api/chat/text` | POST | Process text input (text → RAG → response) |
| `/api/chat/health` | GET | Health check |

### Document Management Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List all documents with metadata |
| `/api/documents/upload` | POST | Upload document (.txt, .doc, .docx, .pdf) |
| `/api/documents/:id` | DELETE | Delete document and all its chunks |
| `/api/documents/stats` | GET | Get collection statistics |

### Legacy Ingest Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingest` | POST | Ingest document file (.txt, .md, .json) |
| `/api/ingest/text` | POST | Ingest raw text into vector DB |
| `/api/ingest` | DELETE | Clear all documents from vector DB |

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── services/      # STT, Vector, LLM, TTS services
│   │   ├── routes/        # API routes (chat, ingest, documents)
│   │   ├── utils/         # Chunker, logger, document parser
│   │   ├── scripts/       # Ingestion script
│   │   ├── config.js      # Configuration
│   │   └── index.js       # Server entry
│   ├── sample_docs/       # Sample knowledge base documents
│   └── uploads/           # Temporary upload directory
├── frontend/
│   └── src/
│       ├── components/    # Vue components (AudioRecorder, DocumentLibrary)
│       └── App.vue        # Main application with chat & document views
├── docs/                  # Architecture documentation
└── docker-compose.yml     # Chroma DB setup
```

## Demo Script

1. Start the application (see Quick Start)
2. Click "Voice" mode
3. Hold the record button and say: "What are your business hours?"
4. Release and wait for the response
5. The agent should respond with hours from `company_faq.txt`
6. Try text mode: "What's your return policy?"
7. Try an unknown question: "What's your favorite color?"
   - Agent should indicate uncertainty

## Swapping Components

Each service includes comments for alternative implementations:

- **Vector DB**: Swap Chroma for Qdrant or Pinecone
- **LLM**: Swap OpenAI for Ollama (local)
- **STT**: Swap Whisper API for whisper.cpp (local)
- **TTS**: Swap OpenAI TTS for ElevenLabs or Coqui

See individual service files in `backend/src/services/` for details.

## Managing Documents

### Via Web UI (Recommended)

1. Open the app at http://localhost:5173
2. Click the **Documents** tab in the header
3. Drag-and-drop files or click to browse
4. Supported formats: `.txt`, `.doc`, `.docx`, `.pdf`
5. View all documents in the table with search/sort
6. Delete documents with confirmation (removes from vector DB)

### Via CLI Script

Place `.txt` or `.md` files in `backend/sample_docs/` and run:

```bash
cd backend && npm run ingest           # Add to existing
cd backend && npm run ingest -- --clear  # Clear and re-ingest
```

### Via API

**Upload a document:**
```bash
curl -X POST http://localhost:3001/api/documents/upload \
  -F "file=@/path/to/document.pdf"
```

**List documents:**
```bash
curl http://localhost:3001/api/documents
```

**Delete a document:**
```bash
curl -X DELETE http://localhost:3001/api/documents/{documentId}
```

### How Deletion Works

When you delete a document:
1. All chunks belonging to that document are identified by `documentId`
2. All matching vectors/embeddings are removed from Chroma
3. The document no longer appears in queries or the document list
4. This action is irreversible

## License

MIT
