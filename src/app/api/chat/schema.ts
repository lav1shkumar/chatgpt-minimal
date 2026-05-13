import { chatMessageSchema } from '@/lib/chat-message-contract'
import { AI_MODEL_VALUES, DEFAULT_AI_MODEL } from '@/services/ai-models'
import { z } from 'zod'

export const chatRequestSchema = z.object({
  prompt: z.string().trim().min(1),
  model: z.enum(AI_MODEL_VALUES).default(DEFAULT_AI_MODEL.value),
  messages: z.array(chatMessageSchema)
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
