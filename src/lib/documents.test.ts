import { describe, expect, it } from "vitest";

import { chunkText, createPassages, rankPassages } from "./documents";
import type { Passage } from "./types";

describe("chunkText", () => {
  it("returns no chunks for whitespace-only content", () => {
    expect(chunkText(" \n\n  ")).toEqual([]);
  });

  it("keeps chunks bounded and carries overlap between long sections", () => {
    const text = Array.from(
      { length: 18 },
      (_, index) => `Sentence ${index + 1} explains a document workflow with enough detail to test splitting.`,
    ).join(" ");
    const chunks = chunkText(text, { maxLength: 240, overlap: 45 });

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.length <= 240)).toBe(true);
    expect(chunks.every((chunk) => chunk.trim() === chunk)).toBe(true);
  });

  it("preserves page metadata when creating passages", () => {
    const passages = createPassages({
      documentId: "doc-1",
      filename: "report.pdf",
      pages: [{ page: 4, text: "A short but meaningful fourth-page finding." }],
    });

    expect(passages).toHaveLength(1);
    expect(passages[0]).toMatchObject({ page: 4, filename: "report.pdf", index: 0 });
  });
});

describe("rankPassages", () => {
  const passage = (id: string, text: string): Passage => ({
    id,
    documentId: "doc",
    filename: "brief.md",
    page: null,
    text,
    index: Number(id),
  });

  it("ranks passages with rare matching terms above unrelated text", () => {
    const passages = [
      passage("0", "The quarterly budget covers travel and software."),
      passage("1", "Project Atlas launches in September with a limited beta."),
      passage("2", "The cafeteria menu changes every week."),
    ];

    expect(rankPassages("When does Project Atlas launch?", passages, 2)[0].id).toBe("1");
  });

  it("respects the result limit", () => {
    const passages = [passage("0", "alpha"), passage("1", "alpha beta"), passage("2", "beta")];
    expect(rankPassages("alpha", passages, 2)).toHaveLength(2);
  });
});
