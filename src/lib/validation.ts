import { z } from "zod";

export const passageInputSchema = z.object({
  id: z.string().min(1).max(120),
  documentId: z.string().min(1).max(120),
  filename: z.string().min(1).max(255),
  page: z.number().int().positive().nullable(),
  text: z.string().min(1).max(4_000),
  index: z.number().int().nonnegative(),
});

export const askRequestSchema = z.object({
  question: z.string().trim().min(2).max(1_000),
  passages: z.array(passageInputSchema).min(1).max(8),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4_000),
      }),
    )
    .max(10)
    .default([]),
});

export type AskRequest = z.infer<typeof askRequestSchema>;
