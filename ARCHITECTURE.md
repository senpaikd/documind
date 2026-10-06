# Documind Architecture

## Overview

Documind is a stateless, browser-first retrieval-augmented generation (RAG) application. It intentionally avoids a database and hosted vector store for the MVP. Documents exist only in React state for the life of the browser tab.

```text
PDF / TXT / Markdown
        │
        ▼
Browser extraction ──► normalized, page-aware passages
        │
        ▼
Local lexical ranking ──► top 6 passages
        │
        ▼
POST /api/ask ──► schema validation ──► OpenAI Responses API
        │                                  store: false
        ▼
Answer + cited passage numbers ──► source drawer
```

## Components

- `src/app/workspace.tsx`: client-side upload, extraction orchestration, in-memory state, local ranking, chat, and citation UI.
- `src/lib/pdf.ts`: dynamically loaded PDF.js browser parser. Text is extracted page by page so citations can retain page numbers.
- `src/lib/documents.ts`: file validation helpers, text normalization, overlapping chunking, lexical tokenization, and inverse-document-frequency ranking.
- `src/app/api/ask/route.ts`: Node.js Route Handler that validates the boundary, reads server-only environment variables, calls the OpenAI Responses API, and returns a small response contract.
- `src/lib/validation.ts`: shared Zod request limits and types.

## Data flow

1. The user selects or drops a supported file.
2. TXT and Markdown use the browser `File.text()` API. PDF.js processes PDF bytes inside the browser and emits page-aware text.
3. Text is normalized and split into overlapping passages of roughly 900 characters.
4. On each question, a lightweight local lexical ranker scores all passages and selects at most six.
5. The browser sends only the question, up to ten recent messages, and those selected passages to `/api/ask`.
6. The server validates sizes and shape. With `OPENAI_API_KEY`, it calls `client.responses.create` with `store: false`. Without a key, it creates a deterministic extractive demo response.
7. The client maps returned citation numbers back to the exact passages already held locally.

## Security boundaries

### Browser

- Holds full document text in volatile memory.
- Performs file parsing, chunking, and ranking.
- Cannot access `OPENAI_API_KEY`; no `NEXT_PUBLIC_` secret exists.
- Sends a bounded subset of text only after the user asks a question.

### Documind server

- Receives selected passages, the question, and bounded recent chat history.
- Validates the request with Zod and rejects oversized bodies.
- Reads `OPENAI_API_KEY` and `OPENAI_MODEL` from the server environment.
- Does not persist documents, requests, or responses.

### OpenAI API

- Receives the selected passages and prompt, not the original file.
- Requests explicitly set `store: false`.
- Provider abuse-monitoring and retention policies still apply; operators should review their OpenAI account's data controls.

## Trust and citation model

Passage numbers are assigned immediately before the API call. The model is instructed to cite only these numbers. The server discards out-of-range citation numbers and adds the top passage as a fallback citation if the response contains no valid reference. Citations indicate the supplied source passage; they do not independently prove that a model interpretation is correct.

## Operational limits

- Maximum eight files per session and 10 MB per file.
- Maximum six retrieved passages per question in the client (the API accepts at most eight).
- No OCR; image-only PDFs report a clear error.
- No persistence, authentication, multi-user workspace, or semantic embeddings.
- Large PDFs are constrained by browser memory and PDF.js extraction speed.
