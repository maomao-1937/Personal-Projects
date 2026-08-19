import { z } from "zod";

const conciseText = z.string().trim().min(1).max(240);

export const singleQuestionSchema = z
  .string()
  .trim()
  .min(2)
  .max(240)
  .refine(
    (value) => (value.match(/[？?]/g) ?? []).length <= 1,
    "一次只能提出一个问题",
  );

export const conceptExtractionSchema = z.object({
  concepts: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(80),
        description: z.string().trim().min(2).max(240),
        source_context: z.string().trim().min(1).max(2_000),
      }),
    )
    .min(1)
    .max(10),
});

export const assessmentSchema = z
  .object({
    assessment: z.enum(["correct", "partial", "incorrect", "unclear"]),
    understood_points: z.array(conciseText).max(12),
    missing_points: z.array(conciseText).max(12),
    misconceptions: z.array(conciseText).max(12),
    next_question: singleQuestionSchema,
  })
  .superRefine((value, context) => {
    if (
      value.assessment === "correct" &&
      (value.missing_points.length > 0 || value.misconceptions.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "判断为 correct 时不能同时存在遗漏或误解",
        path: ["assessment"],
      });
    }
  });

export const supportSchema = z
  .object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    content: z.string().trim().min(2).max(500),
    next_question: singleQuestionSchema,
  })
  .superRefine((value, context) => {
    if (value.level === 3 && value.content.length > 120) {
      context.addIssue({
        code: "custom",
        message: "Level 3 核心解释不能超过 120 字",
        path: ["content"],
      });
    }
  });

export type ConceptExtractionOutput = z.infer<typeof conceptExtractionSchema>;
export type AssessmentOutput = z.infer<typeof assessmentSchema>;
export type SupportOutput = z.infer<typeof supportSchema>;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function sourceContainsContext(
  sourceText: string,
  sourceContext: string,
): boolean {
  const source = normalizeWhitespace(sourceText);
  const context = normalizeWhitespace(sourceContext);
  return context.length > 0 && source.includes(context);
}

