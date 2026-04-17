# navicator-backend

Backend service for Navicator with HTTP + WebSocket support.

## AI Features

- **7 agent modes**: Auto, Coder, Planner, Debugger, Reviewer, Explainer, Chain (`Plan → Code`).
- **9 built-in free OpenRouter models**: Qwen3 (2), DeepSeek R1/V3 (2), Gemma 3 (1), Llama 4 (2), Mistral (1), Phi-3 (1).
- **One-click file application** support exposed via backend capabilities metadata.
- **Persistent memory system** stored on disk for project context across sessions.

## API endpoints

- `GET /health`
- `GET /api/ai/features`
- `GET /api/ai/memory`
- `POST /api/ai/memory`
- `POST /api/ai/mode`
- `GET /api/files/tree`
- `GET /api/files/read?path=...`
- `POST /api/files/write`

## Run

```bash
npm install
npm start
```
