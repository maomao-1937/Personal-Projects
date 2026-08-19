import { z } from "zod";

export const createSessionInputSchema = z.object({
  clientRequestId: z.string().uuid(),
  title: z.string().trim().min(2).max(80),
  sourceText: z
    .string()
    .trim()
    .max(60_000)
    .refine(
      (value) => value.length === 0 || value.length >= 100,
      "学习资料请留空，或至少输入 100 个字符",
    )
    .default(""),
});

export const submitAttemptInputSchema = z.object({
  clientRequestId: z.string().uuid(),
  userAnswer: z.string().trim().min(2).max(8_000),
  retryAttemptId: z.string().uuid().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
export type SubmitAttemptInput = z.infer<typeof submitAttemptInputSchema>;
