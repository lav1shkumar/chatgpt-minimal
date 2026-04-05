import { z } from 'zod'

export const chatMessageRoleSchema = z.enum(['user', 'assistant', 'system'])

function createPartSchema<TShape extends z.ZodRawShape>(shape: TShape) {
  return z.object(shape).passthrough()
}

const knownPartSchema = z.discriminatedUnion('type', [
  createPartSchema({ type: z.literal('text'), text: z.string() }),
  createPartSchema({ type: z.literal('file'), mediaType: z.string(), url: z.string() }),
  createPartSchema({ type: z.literal('reasoning'), text: z.string() }),
  createPartSchema({ type: z.literal('step-start') }),
  createPartSchema({ type: z.literal('source-url'), sourceId: z.string(), url: z.string() }),
  createPartSchema({
    type: z.literal('source-document'),
    sourceId: z.string(),
    mediaType: z.string(),
    title: z.string()
  })
])

const knownPartTypes = [
  'text',
  'file',
  'reasoning',
  'step-start',
  'source-url',
  'source-document'
] as const

const knownPartTypeSet = new Set<string>(knownPartTypes)

const fallbackPartSchema = createPartSchema({ type: z.string() }).refine(
  (part) => !knownPartTypeSet.has(part.type),
  { message: 'Known part types must satisfy their required schema.' }
)

export const chatMessagePartSchema = knownPartSchema.or(fallbackPartSchema)

export const chatMessageSchema = z.object({
  role: chatMessageRoleSchema,
  parts: z.array(chatMessagePartSchema)
})
