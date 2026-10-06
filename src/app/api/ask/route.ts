import "server-only";

import OpenAI from "openai";
import { ZodError } from "zod";

import { askRequestSchema, type AskRequest } from "@/lib/validation";

export const runtime = "nodejs";

function excerptSentence(text: string, question: string) {
  const terms = question.toLowerCase().split(/\W+/).filter((term) => term.length > 3);
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  return (sentences.find((sentence) =>
    terms.some((term) => sentence.toLowerCase().includes(term)),
  ) ?? sentences[0]).trim();
}

function createDemoAnswer(request: AskRequest) {
  const primary = excerptSentence(request.passages[0].text, request.question);
  const secondary = request.passages[1]
    ? excerptSentence(request.passages[1].text, request.question)
    : null;
  return {
    answer: secondary
      ? `A relevant passage states: “${primary}” [1] Another relevant passage adds: “${secondary}” [2]`
      : `A relevant passage states: “${primary}” [1]`,
    citationNumbers: secondary ? [1, 2] : [1],
    demo: true,
  };
}

function citationNumbersFrom(answer: string, maximum: number) {
  const found = [...answer.matchAll(/\[(\d+)]/g)]
    .map((match) => Number(match[1]))
    .filter((number) => Number.isInteger(number) && number >= 1 && number <= maximum);
  return [...new Set(found)];
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 80_000) {
      return Response.json({ error: "Request is too large." }, { status: 413 });
    }

    const input = askRequestSchema.parse(await request.json());
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return Response.json(createDemoAnswer(input));

    const context = input.passages.map((passage, index) =>
      `[${index + 1}] ${passage.filename}${passage.page ? `, page ${passage.page}` : ""}\n${passage.text}`,
    ).join("\n\n");
    const history = input.history.map((message) =>
      `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`,
    ).join("\n");

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5-mini",
      store: false,
      instructions:
        "You are a careful document analyst. Answer only from the supplied passages. Cite factual claims with the passage number in square brackets, for example [1]. If the passages do not answer the question, say so clearly. Never invent a citation or use a passage number outside the supplied range. Keep the answer concise and useful.",
      input: `${history ? `Recent conversation:\n${history}\n\n` : ""}Question: ${input.question}\n\nPassages:\n${context}`,
      max_output_tokens: 700,
    });

    let answer = response.output_text.trim();
    if (!answer) {
      return Response.json({ error: "The AI provider returned an empty response." }, { status: 502 });
    }
    let citationNumbers = citationNumbersFrom(answer, input.passages.length);
    if (!citationNumbers.length) {
      answer = `${answer} [1]`;
      citationNumbers = [1];
    }
    return Response.json({ answer, citationNumbers, demo: false });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Invalid request.", details: error.issues.map((issue) => issue.message) },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    console.error("Document question failed", error);
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    return Response.json(
      {
        error: safeStatus === 401
          ? "The configured OpenAI API key was rejected."
          : safeStatus === 429
            ? "The AI service is busy or the rate limit was reached. Try again shortly."
            : "The answer could not be generated. Please try again.",
      },
      { status: safeStatus },
    );
  }
}
