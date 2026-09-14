import { z } from 'zod';
import { profileSchema } from './models';
export const promptWriterConfigSchema = z.object({ model: profileSchema.shape.model });
export type PromptWriterConfig = z.infer<typeof promptWriterConfigSchema>;
export const promptWriterRequestSchema = z.object({
  model: profileSchema.shape.model,
  apiKey: z.string().trim().min(8).max(2048).regex(/^[^\r\n]+$/),
  idea: z.string().trim().min(1).max(1200),
  breed: z.string().trim().min(1).max(80),
  style: z.enum(['photo', 'paint', '3d']),
  freedom: z.enum(['head', 'scene']),
  task: z.enum(['create', 'edit']),
  previousPrompt: z.string().max(12000).optional(),
});
export type PromptWriterRequest = z.infer<typeof promptWriterRequestSchema>;
