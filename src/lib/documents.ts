import type { Passage } from "./types";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILES = 8;

export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
] as const;

const extensionKinds = {
  pdf: "pdf",
  txt: "text",
  md: "markdown",
  markdown: "markdown",
} as const;

export function getDocumentKind(filename: string, mimeType = "") {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const fromExtension = extensionKinds[extension as keyof typeof extensionKinds];

  if (fromExtension) return fromExtension;
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/markdown") return "markdown";
  if (mimeType === "text/plain") return "text";
  return null;
}

export function validateFile(file: Pick<File, "name" | "size" | "type">) {
  if (!getDocumentKind(file.name, file.type)) {
    return "Unsupported file. Upload a PDF, TXT, or Markdown document.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "File is larger than the 10 MB limit.";
  }
  if (file.size === 0) return "This file is empty.";
  return null;
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLongBlock(block: string, maxLength: number) {
  const sentences = block.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [block];
  const pieces: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = `${current} ${sentence.trim()}`.trim();
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) pieces.push(current);
    if (sentence.length <= maxLength) {
      current = sentence.trim();
      continue;
    }
    const words = sentence.trim().split(/\s+/);
    current = "";
    for (const word of words) {
      const wordCandidate = `${current} ${word}`.trim();
      if (wordCandidate.length > maxLength && current) {
        pieces.push(current);
        current = word;
      } else {
        current = wordCandidate;
      }
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

export function chunkText(
  rawText: string,
  options: { maxLength?: number; overlap?: number } = {},
) {
  const maxLength = options.maxLength ?? 900;
  const overlap = Math.min(options.overlap ?? 140, Math.floor(maxLength / 3));
  const text = normalizeText(rawText);
  if (!text) return [];

  const blocks = text
    .split(/\n\s*\n/)
    .flatMap((block) => splitLongBlock(block.trim(), maxLength))
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    const previousTail = current.slice(-overlap).replace(/^\S*\s/, "").trim();
    current = previousTail ? `${previousTail}\n\n${block}` : block;
    if (current.length > maxLength) {
      chunks.push(current.slice(0, maxLength).trim());
      current = current.slice(maxLength - overlap).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

const STOP_WORDS = new Set(
  "a an and are as at be been but by can could did do does for from had has have how i if in into is it its may might more most not of on or our should so than that the their then there these they this to was we were what when where which who will with would you your".split(
    " ",
  ),
);

export function tokenize(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .match(/[\p{L}\p{N}]{2,}/gu) ?? []
  ).filter((token) => !STOP_WORDS.has(token));
}

export function rankPassages(query: string, passages: Passage[], limit = 6) {
  const queryTerms = [...new Set(tokenize(query))];
  if (!queryTerms.length) return passages.slice(0, limit);

  const documentFrequency = new Map<string, number>();
  for (const passage of passages) {
    const uniqueTerms = new Set(tokenize(passage.text));
    for (const term of queryTerms) {
      if (uniqueTerms.has(term)) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }
  }

  return passages
    .map((passage, originalIndex) => {
      const terms = tokenize(`${passage.filename} ${passage.text}`);
      const frequencies = new Map<string, number>();
      for (const term of terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
      let score = 0;
      for (const term of queryTerms) {
        const frequency = frequencies.get(term) ?? 0;
        if (!frequency) continue;
        const inverseFrequency = Math.log(
          1 + (passages.length + 1) / ((documentFrequency.get(term) ?? 0) + 1),
        );
        score += (1 + Math.log(frequency)) * inverseFrequency;
      }
      const exactPhrase = passage.text.toLowerCase().includes(query.toLowerCase());
      return { passage, score: score + (exactPhrase ? 4 : 0), originalIndex };
    })
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
    .slice(0, limit)
    .map(({ passage }) => passage);
}

export function createPassages({
  documentId,
  filename,
  pages,
}: {
  documentId: string;
  filename: string;
  pages: Array<{ page: number | null; text: string }>;
}) {
  let index = 0;
  return pages.flatMap(({ page, text }) =>
    chunkText(text).map((chunk) => {
      const passage: Passage = {
        id: `${documentId}-${index}`,
        documentId,
        filename,
        page,
        text: chunk,
        index,
      };
      index += 1;
      return passage;
    }),
  );
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
