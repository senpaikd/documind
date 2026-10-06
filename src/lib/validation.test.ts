import { describe, expect, it } from "vitest";

import { askRequestSchema } from "./validation";

const validPassage = {
  id: "passage-1",
  documentId: "doc-1",
  filename: "notes.txt",
  page: null,
  text: "A relevant source passage.",
  index: 0,
};

describe("askRequestSchema", () => {
  it("accepts a bounded question and passage", () => {
    const result = askRequestSchema.safeParse({
      question: "What is the key point?",
      passages: [validPassage],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.history).toEqual([]);
  });

  it("rejects requests without context", () => {
    expect(askRequestSchema.safeParse({ question: "What happened?", passages: [] }).success).toBe(false);
  });

  it("rejects oversized questions, passages, and history", () => {
    expect(askRequestSchema.safeParse({
      question: "q".repeat(1_001),
      passages: [{ ...validPassage, text: "x".repeat(4_001) }],
      history: Array.from({ length: 11 }, () => ({ role: "user", content: "hello" })),
    }).success).toBe(false);
  });

  it("rejects invalid page numbers", () => {
    expect(askRequestSchema.safeParse({
      question: "Where is this?",
      passages: [{ ...validPassage, page: 0 }],
    }).success).toBe(false);
  });
});
