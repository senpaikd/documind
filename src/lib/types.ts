export type DocumentKind = "pdf" | "text" | "markdown";

export type DocumentStatus = "uploading" | "processing" | "ready" | "error";

export interface Passage {
  id: string;
  documentId: string;
  filename: string;
  page: number | null;
  text: string;
  index: number;
}

export interface ProcessedDocument {
  id: string;
  name: string;
  kind: DocumentKind;
  size: number;
  status: DocumentStatus;
  passages: Passage[];
  error?: string;
}

export interface ChatCitation extends Passage {
  number: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  demo?: boolean;
}
