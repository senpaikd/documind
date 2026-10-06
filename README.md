# Documind

Documind is a polished, privacy-conscious AI document assistant built with Next.js. Upload PDFs, text files, or Markdown, ask questions in natural language, and inspect the exact source passages behind every answer.

The MVP keeps full documents in the browser. It extracts, chunks, and ranks passages locally, then sends only the most relevant context to a server-only OpenAI Responses API integration.

## Features

- Drag-and-drop PDF, TXT, and Markdown upload
- In-browser text extraction with page-aware PDF citations
- Overlapping passage chunking and local lexical relevance ranking
- Multi-turn question and answer interface
- Numbered inline citations and clickable source cards
- Citation drawer with the exact excerpt and PDF page number when available
- Server-only `OPENAI_API_KEY` and configurable `OPENAI_MODEL`
- Explicit `store: false` on every OpenAI Responses API request
- Useful deterministic demo mode when no API key is configured
- File, payload, history, passage, and provider error validation
- Responsive interface with keyboard and reduced-motion support
- Unit tests for chunking, ranking, and request validation

## Screenshots

> Screenshots are intentionally left as a publishing checklist item. Add desktop and mobile captures to [`docs/screenshots`](docs/screenshots/README.md) after deployment.

| Desktop workspace | Mobile workspace |
| --- | --- |
| `docs/screenshots/workspace-desktop.png` | `docs/screenshots/workspace-mobile.png` |

## Architecture

```text
Browser                                      Server
┌──────────────────────────────┐             ┌───────────────────────────┐
│ Parse PDF / TXT / Markdown   │             │ Validate request          │
│ Chunk page-aware text        │  top 6      │ Read server-only API key  │
│ Rank passages for a question ├────────────►│ OpenAI Responses API      │
│ Render answer + source cards │◄────────────┤ Return answer + references│
└──────────────────────────────┘             └───────────────────────────┘
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the complete data flow, trust boundaries, citation model, and operational limits.

## Requirements

- Node.js 20.19+ (Node.js 22 LTS is recommended)
- npm
- An OpenAI API key for AI-generated synthesis (optional for demo mode)

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   **macOS / Linux**

   ```bash
   cp .env.example .env.local
   ```

   **Windows PowerShell**

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Add your key to `.env.local` if you want live AI answers. Leave it blank to use demo mode.

   ```dotenv
   OPENAI_API_KEY=your_api_key_here
   OPENAI_MODEL=gpt-5-mini
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

For the quickest tour, choose **Try the sample brief**, select a suggested question, and submit it.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | No | — | Server-only OpenAI credential. Missing/blank enables demo mode. |
| `OPENAI_MODEL` | No | `gpt-5-mini` | Model passed to the Responses API. |

Never prefix the API key with `NEXT_PUBLIC_`; doing so would make it available to browser code.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |

## Privacy

- Complete document files are not uploaded to the application server.
- PDF, TXT, and Markdown extraction happens in the browser.
- Chunking and lexical ranking happen in the browser.
- When a question is submitted, the question, bounded recent conversation, and up to six relevant passages are sent to the Documind server and then to OpenAI when a key is configured.
- OpenAI requests use `store: false`. This controls Responses API application-state storage but does not replace the provider's broader data and abuse-monitoring policies.
- Nothing is persisted by this MVP. Refreshing the page clears the workspace and chat.

## Validation and safety

- Supported extensions and MIME types are checked before processing.
- Each file is limited to 10 MB; each workspace is limited to eight files.
- API payloads are validated with Zod and capped by question, history, passage-count, passage-length, and total request limits.
- Credentials are read only inside the Node.js Route Handler.
- Provider errors are mapped to safe user-facing messages; server logs do not intentionally include document text.

## Limitations

- Scanned/image-only PDFs are not supported because the MVP does not include OCR.
- Retrieval is lexical rather than embedding-based, so synonyms and highly implicit matches may rank less effectively.
- Documents and conversations are session-only and cannot be shared.
- Tables and multi-column PDFs may extract in an imperfect reading order.
- Model output can still be wrong. Citation cards make its source context inspectable, but do not guarantee the interpretation.

## Deployment

### Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in **Project Settings → Environment Variables**.
4. Deploy. The default Next.js build command (`npm run build`) and output settings are sufficient.

### Other Node.js hosts

Build and start the app with:

```bash
npm ci
npm run build
npm run start
```

Set the same environment variables in the host's server-side secret manager. The Route Handler requires a Node.js runtime and outbound HTTPS access to the OpenAI API.

## Publishing checklist

- Add desktop and mobile screenshots.
- Review dependency audit output and update within the supported Next.js/PDF.js ranges.
- Configure production environment variables.
- Re-run `npm run lint`, `npm test`, `npm run typecheck`, and `npm run build`.
- Verify a text PDF and a Markdown file in the deployed browser.

## License

Add the license that best fits your intended distribution before publishing.
