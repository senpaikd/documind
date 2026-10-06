"use client";

import {
  ArrowUp, Check, ChevronRight, FileText, Library, LoaderCircle, LockKeyhole,
  MessageSquareText, Plus, Search, ShieldCheck, Sparkles, Trash2, UploadCloud, X,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useMemo, useRef, useState } from "react";

import {
  createPassages, formatBytes, getDocumentKind, MAX_FILES, rankPassages, validateFile,
} from "@/lib/documents";
import type { ChatCitation, ChatMessage, ProcessedDocument } from "@/lib/types";

const suggestions = [
  "What are the main takeaways?",
  "Summarize the most important details.",
  "What decisions or next steps are mentioned?",
];

const sampleText = `Documind Product Brief

Documind is a privacy-conscious document assistant designed for research teams. Documents are parsed and divided into passages inside the browser. Local relevance ranking selects only a small set of passages before a question is sent to the server.

The first release supports PDF, plain text, and Markdown files up to 10 MB each. Files remain in the current browser session and are not uploaded as complete documents. The server sends the user's question and the selected passages to the configured AI provider.

The product goal is to help people understand long reports quickly while keeping every answer traceable. Answers include numbered citations. Selecting a citation reveals the exact source excerpt and page number when PDF page information is available.

Success is measured by grounded answers, fast time to insight, and clear privacy communication. Future releases may add persistent workspaces, OCR for scanned PDFs, and semantic embeddings.`;

function DocumentIcon({ kind }: { kind: ProcessedDocument["kind"] }) {
  return <span className={`file-kind file-kind--${kind}`} aria-hidden="true">
    {kind === "pdf" ? "PDF" : kind === "markdown" ? "MD" : "TXT"}
  </span>;
}

function CitationText({ content }: { content: string }) {
  return content.split(/(\[\d+])/g).map((part, index) =>
    /^\[\d+]$/.test(part)
      ? <span className="citation-pill" key={`${part}-${index}`}>{part.slice(1, -1)}</span>
      : part,
  );
}

export default function Workspace() {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<ChatCitation | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readyDocuments = documents.filter((document) => document.status === "ready");
  const allPassages = useMemo(
    () => readyDocuments.flatMap((document) => document.passages),
    [readyDocuments],
  );

  async function processFiles(files: File[]) {
    setNotice(null);
    const availableSlots = MAX_FILES - documents.length;
    if (availableSlots <= 0) {
      setNotice(`You can keep up to ${MAX_FILES} documents in one workspace.`);
      return;
    }
    const selected = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      setNotice(`Only the first ${availableSlots} file${availableSlots === 1 ? " was" : "s were"} added.`);
    }

    for (const file of selected) {
      const id = crypto.randomUUID();
      const kind = getDocumentKind(file.name, file.type);
      const validationError = validateFile(file);
      if (!kind || validationError) {
        setNotice(validationError ?? "Unsupported file.");
        continue;
      }
      const pending: ProcessedDocument = {
        id, name: file.name, kind, size: file.size, status: "uploading", passages: [],
      };
      setDocuments((current) => [...current, pending]);

      try {
        setDocuments((current) => current.map((document) =>
          document.id === id ? { ...document, status: "processing" } : document,
        ));
        const pages = kind === "pdf"
          ? await (await import("@/lib/pdf")).extractPdfPages(file)
          : [{ page: null, text: await file.text() }];
        const passages = createPassages({ documentId: id, filename: file.name, pages });
        if (!passages.length) {
          throw new Error("No readable text was found. Scanned PDFs need OCR, which is not included yet.");
        }
        setDocuments((current) => current.map((document) =>
          document.id === id ? { ...document, status: "ready", passages } : document,
        ));
      } catch (error) {
        const message = error instanceof Error ? error.message : "The document could not be processed.";
        setDocuments((current) => current.map((document) =>
          document.id === id ? { ...document, status: "error", error: message } : document,
        ));
      }
    }
  }

  function loadSample() {
    if (documents.some((document) => document.id === "sample")) return;
    const passages = createPassages({
      documentId: "sample",
      filename: "documind-product-brief.md",
      pages: [{ page: null, text: sampleText }],
    });
    setDocuments((current) => [...current, {
      id: "sample", name: "documind-product-brief.md", kind: "markdown",
      size: new Blob([sampleText]).size, status: "ready", passages,
    }]);
    setNotice(null);
  }

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length < 2 || isAnswering) return;
    if (!allPassages.length) {
      setNotice("Add a readable document before asking a question.");
      return;
    }
    const relevantPassages = rankPassages(trimmedQuestion, allPassages, 6);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(), role: "user", content: trimmedQuestion,
    };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setNotice(null);
    setIsAnswering(true);

    try {
      const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion, passages: relevantPassages, history }),
      });
      const result = await response.json() as {
        answer?: string; citationNumbers?: number[]; demo?: boolean; error?: string;
      };
      if (!response.ok || !result.answer) {
        throw new Error(result.error ?? "The answer could not be generated.");
      }
      const citations = (result.citationNumbers ?? []).map((number) => {
        const passage = relevantPassages[number - 1];
        return passage ? { ...passage, number } : null;
      }).filter((citation): citation is ChatCitation => citation !== null);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "assistant", content: result.answer!, citations, demo: result.demo,
      }]);
    } catch (error) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(), role: "assistant",
        content: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      }]);
    } finally {
      setIsAnswering(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask();
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Documind home">
          <span className="brand-mark"><Sparkles size={17} /></span><span>documind</span>
        </a>
        <div className="topbar-meta">
          <span className="secure-label"><ShieldCheck size={14} /> Private by design</span>
          <a href="#privacy" className="ghost-link">How it works <ChevronRight size={14} /></a>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> AI document workspace</div>
        <h1>Turn documents into<br /><em>clear answers.</em></h1>
        <p>Upload your research, reports, and notes. Ask anything. Every answer stays grounded in the source.</p>
        <div className="hero-proof">
          <span><Check size={14} /> Local document processing</span>
          <span><Check size={14} /> Source-backed answers</span>
          <span><Check size={14} /> No account required</span>
        </div>
      </section>

      <section className="workspace-grid" aria-label="Document workspace">
        <aside className="documents-panel">
          <div className="panel-heading">
            <div><span className="step-number">01</span><h2>Your documents</h2></div>
            <span className="count-badge">{readyDocuments.length}/{MAX_FILES}</span>
          </div>
          <button
            type="button"
            className={`drop-zone ${isDragging ? "drop-zone--active" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false); }}
            onDrop={(event) => {
              event.preventDefault(); setIsDragging(false);
              void processFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <span className="upload-icon"><UploadCloud size={25} /></span>
            <strong>Drop files here or <u>browse</u></strong>
            <small>PDF, TXT, MD · up to 10 MB each</small>
            <input
              ref={inputRef} type="file"
              accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
              multiple hidden
              onChange={(event) => {
                void processFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </button>
          {notice && <div className="inline-notice" role="alert"><X size={14} /> {notice}</div>}
          <div className="document-list" aria-live="polite">
            {documents.map((document) => (
              <article className="document-row" key={document.id}>
                <DocumentIcon kind={document.kind} />
                <div className="document-details">
                  <strong title={document.name}>{document.name}</strong>
                  <span>{formatBytes(document.size)} · {document.status === "ready" ? `${document.passages.length} passages` : document.status}</span>
                  {document.error && <small>{document.error}</small>}
                </div>
                {document.status === "processing" || document.status === "uploading"
                  ? <LoaderCircle className="spin" size={17} aria-label="Processing" />
                  : document.status === "ready"
                    ? <span className="ready-check" aria-label="Ready"><Check size={13} /></span>
                    : null}
                <button
                  type="button" className="icon-button" aria-label={`Remove ${document.name}`}
                  onClick={() => {
                    setDocuments((current) => current.filter((item) => item.id !== document.id));
                    setActiveCitation((current) => current?.documentId === document.id ? null : current);
                  }}
                ><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
          {!documents.length && <button className="sample-button" type="button" onClick={loadSample}>
            <Plus size={15} /> Try the sample brief
          </button>}
          <div className="local-note">
            <LockKeyhole size={16} />
            <p><strong>Files stay in your browser.</strong><br />Only relevant passages are sent when you ask a question.</p>
          </div>
        </aside>

        <section className="chat-panel">
          <div className="panel-heading chat-heading">
            <div><span className="step-number">02</span><h2>Ask your documents</h2></div>
            <span className="status-dot"><i /> Ready</span>
          </div>
          <div className="chat-scroll" aria-live="polite">
            {!messages.length ? <div className="chat-empty">
              <span className="empty-orbit"><MessageSquareText size={27} /></span>
              <h3>{readyDocuments.length ? "Your documents are ready" : "Answers begin with a document"}</h3>
              <p>{readyDocuments.length
                ? "Ask a question or start with one of these suggestions."
                : "Upload a file or load the sample brief to explore source-grounded answers."}</p>
              {readyDocuments.length > 0 && <div className="suggestions">
                {suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setQuestion(suggestion)}>
                  <Search size={14} /> {suggestion}
                </button>)}
              </div>}
            </div> : <div className="messages">
              {messages.map((message) => <article className={`message message--${message.role}`} key={message.id}>
                <div className="message-author">{message.role === "user" ? "You" : <><span><Sparkles size={12} /></span> Documind</>}</div>
                <div className="message-body"><CitationText content={message.content} /></div>
                {message.demo && <span className="demo-label">Demo mode · add an API key for AI-generated synthesis</span>}
                {!!message.citations?.length && <div className="citation-list">
                  {message.citations.map((citation) => <button type="button" key={citation.number} onClick={() => setActiveCitation(citation)}>
                    <span>{citation.number}</span>
                    <div><strong>{citation.filename}</strong><small>{citation.page ? `Page ${citation.page} · ` : ""}{citation.text.slice(0, 105)}…</small></div>
                    <ChevronRight size={14} />
                  </button>)}
                </div>}
              </article>)}
              {isAnswering && <div className="thinking"><span /><span /><span /> Reading relevant passages</div>}
            </div>}
          </div>
          <form className="composer" onSubmit={ask}>
            <label htmlFor="question" className="sr-only">Ask a question about your documents</label>
            <textarea
              id="question" value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, 1000))}
              onKeyDown={handleComposerKeyDown}
              placeholder={readyDocuments.length ? "Ask a question about your documents…" : "Add a document to start asking questions…"}
              disabled={!readyDocuments.length || isAnswering} rows={2}
            />
            <button type="submit" disabled={!readyDocuments.length || question.trim().length < 2 || isAnswering} aria-label="Send question">
              {isAnswering ? <LoaderCircle className="spin" size={19} /> : <ArrowUp size={19} />}
            </button>
            <span>Enter to send · Shift + Enter for a new line</span>
          </form>
        </section>
      </section>

      <section className="privacy-section" id="privacy">
        <div className="privacy-copy">
          <span className="section-kicker"><LockKeyhole size={14} /> Privacy, explained plainly</span>
          <h2>Your documents aren’t our business.</h2>
          <p>Parsing, chunking, and relevance ranking happen in your browser. Complete files are never sent to the Documind server. When you ask a question, only your question, recent conversation, and a small set of relevant text passages are sent to the server and then to OpenAI. Requests use <code>store: false</code>.</p>
        </div>
        <div className="privacy-flow" aria-label="Data flow">
          <div><span><FileText size={18} /></span><strong>Your browser</strong><small>Extract & rank locally</small></div>
          <ChevronRight size={18} />
          <div><span><Library size={18} /></span><strong>Relevant passages</strong><small>Only the best matches</small></div>
          <ChevronRight size={18} />
          <div><span><Sparkles size={18} /></span><strong>AI answer</strong><small>Cited & traceable</small></div>
        </div>
      </section>
      <footer><span>documind</span><p>Built for curious minds · Files are session-only</p></footer>

      {activeCitation && <div className="citation-overlay" role="presentation" onMouseDown={(event) => {
        if (event.currentTarget === event.target) setActiveCitation(null);
      }}>
        <aside className="citation-drawer" role="dialog" aria-modal="true" aria-labelledby="citation-title">
          <div className="drawer-header">
            <div><span>Source {activeCitation.number}</span><h2 id="citation-title">{activeCitation.filename}</h2></div>
            <button type="button" className="icon-button" onClick={() => setActiveCitation(null)} aria-label="Close source"><X size={19} /></button>
          </div>
          <div className="source-meta"><FileText size={15} /> {activeCitation.page ? `Page ${activeCitation.page}` : "Text document"} · Passage {activeCitation.index + 1}</div>
          <blockquote>{activeCitation.text}</blockquote>
          <p className="drawer-note">This excerpt was selected locally because it closely matched your question.</p>
        </aside>
      </div>}
    </main>
  );
}
