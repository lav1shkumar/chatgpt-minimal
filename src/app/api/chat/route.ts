import type { NextRequest } from 'next/server'
import { MAX_IMAGE_SIZE, SUPPORTED_API_IMAGE_TYPES } from '@/lib/chat-attachment-shared'
import { AppError } from '@/lib/errors'
import { getModel } from '@/services/ai-provider'
import { isJsonObject } from '@/types/json'
import { azure as azureProvider } from '@ai-sdk/azure'
import {
  APICallError,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  smoothStream,
  stepCountIs,
  streamText,
  UnsupportedFunctionalityError,
  type LanguageModel,
  type ToolSet,
  type UIMessage
} from 'ai'

import { chatRequestSchema, type ChatRequest } from './schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 4 * ceil(10 MiB / 3) = 13,981,016. Base64 expands bytes by ~4/3 and rounds up to 4-char blocks.
const MAX_IMAGE_BASE64_LENGTH = 4 * Math.ceil(MAX_IMAGE_SIZE / 3)
const DATA_URL_REGEX = /^data:([^;]+);base64,(.+)$/i
const DATA_URL_PREFIX_REGEX = /^data:/i
const GENERIC_STREAM_ERROR_MESSAGE = 'Something went wrong. Please try again.'
const GENERIC_INTERNAL_ERROR_MESSAGE = 'Something went wrong'
const STREAM_RESPONSE_HEADERS = {
  'Content-Encoding': 'none',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'Transfer-Encoding': 'chunked'
} as const

type MessageLike = { role: 'user' | 'assistant' | 'system'; parts: unknown[] }
type ProviderToolLike = { inputSchema: unknown }
type ModelConfig = ReturnType<typeof getModel>
type ModelMessages = Awaited<ReturnType<typeof convertToModelMessages>>
type ProviderStreamResult = ReturnType<typeof streamText>
type ProviderStreamFactory = () => ProviderStreamResult
type ProviderFallbackMatcher = (error: unknown) => boolean

type ProviderStreamPlan = {
  createPrimaryStream: ProviderStreamFactory
  createFallbackStream?: ProviderStreamFactory
  shouldFallbackOnError?: ProviderFallbackMatcher
}

type ProviderStreamInput = {
  modelConfig: ModelConfig
  messages: ModelMessages
  abortSignal: AbortSignal
}

function toToolSet<TTools extends Record<string, ProviderToolLike>>(tools: TTools): ToolSet {
  return tools as unknown as ToolSet
}

function parseDataUrl(dataUrl: string): { base64: string; mimeType?: string } | null {
  const match = dataUrl.match(DATA_URL_REGEX)
  if (!match) return null
  return { mimeType: match[1], base64: match[2] }
}

function normalizeMediaType(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : undefined
}

function normalizeMessageParts(messages: MessageLike[]): MessageLike[] {
  return messages.map((msg) => {
    if (msg.role !== 'user') return msg

    let changed = false
    const normalizedParts: unknown[] = []

    for (const part of msg.parts) {
      if (!isJsonObject(part)) {
        normalizedParts.push(part)
        continue
      }

      if (part.type !== 'file' || typeof part.url !== 'string') {
        normalizedParts.push(part)
        continue
      }

      if (!DATA_URL_PREFIX_REGEX.test(part.url)) {
        normalizedParts.push(part)
        continue
      }

      const parsed = parseDataUrl(part.url)
      if (!parsed || !parsed.base64) {
        changed = true
        continue
      }

      const mediaTypeFromPart = normalizeMediaType(part.mediaType)
      const mediaTypeFromDataUrl = normalizeMediaType(parsed.mimeType)
      const mediaType = mediaTypeFromPart || mediaTypeFromDataUrl

      if (!mediaType || !SUPPORTED_API_IMAGE_TYPES.has(mediaType)) {
        changed = true
        normalizedParts.push({ type: 'text', text: '[Unsupported image format]' })
        continue
      }

      if (parsed.base64.length > MAX_IMAGE_BASE64_LENGTH) {
        changed = true
        normalizedParts.push({ type: 'text', text: '[Image too large]' })
        continue
      }

      changed = true
      normalizedParts.push({ ...part, mediaType, url: parsed.base64 })
    }

    return changed ? { ...msg, parts: normalizedParts } : msg
  })
}

function getErrorTextForWebSearchCheck(error: unknown): string | undefined {
  if (APICallError.isInstance(error)) {
    return [error.message, error.responseBody]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join('\n')
      .toLowerCase()
  }
  if (error instanceof Error) {
    return error.message.toLowerCase()
  }
  return undefined
}

function isWebSearchSetupFallbackError(error: unknown): boolean {
  // Only allow fallback for feature/setup incompatibilities.
  // Request execution failures (auth/rate-limit/network) should not be downgraded silently.
  if (UnsupportedFunctionalityError.isInstance(error)) {
    const functionality = error.functionality.toLowerCase()
    return functionality.includes('web_search') || functionality.includes('web search')
  }

  const text = getErrorTextForWebSearchCheck(error)
  if (!text) return false

  const mentionsWebSearch = text.includes('web_search') || text.includes('web search')
  const mentionsUnsupported = text.includes('not supported') || text.includes('unsupported')
  return mentionsWebSearch && mentionsUnsupported
}

function getPublicStreamErrorMessage(error: unknown): string {
  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401:
      case 403:
        return 'Model provider authentication failed. Please check your API settings.'
      case 429:
        return 'Rate limit reached. Please try again shortly.'
      default:
        if (typeof error.statusCode === 'number' && error.statusCode >= 500) {
          return 'Model provider is temporarily unavailable. Please try again later.'
        }
    }
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return 'Request cancelled.'
  }

  return GENERIC_STREAM_ERROR_MESSAGE
}

// --- Validation ---

async function parseRequest(req: NextRequest): Promise<ChatRequest | Response> {
  let payload: unknown

  try {
    payload = await req.json()
  } catch (error) {
    console.warn('[Chat API] Invalid JSON request body', error)
    return new AppError('invalid_json', 'Invalid JSON in request body').toResponse()
  }

  const parsed = chatRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return new AppError('invalid_request', 'Invalid request body').toResponse()
  }

  return parsed.data
}

// --- Normalization ---

async function buildModelMessages(
  prompt: ChatRequest['prompt'],
  messages: ChatRequest['messages']
): Promise<ModelMessages> {
  const systemMessage: ChatRequest['messages'][number] = {
    role: 'system',
    parts: [{ type: 'text', text: prompt }]
  }

  const normalizedMessages = normalizeMessageParts([systemMessage, ...messages])
  return convertToModelMessages(normalizedMessages as Array<Omit<UIMessage, 'id'>>)
}

// --- Provider ---

function createBaseStreamOptions(messages: ModelMessages, abortSignal: AbortSignal) {
  return {
    messages,
    abortSignal,
    stopWhen: stepCountIs(5),
    experimental_transform: smoothStream({ chunking: 'word' as const })
  }
}

function runPlainStream(
  model: LanguageModel,
  baseStreamOptions: ReturnType<typeof createBaseStreamOptions>
): ProviderStreamResult {
  return streamText({
    model,
    ...baseStreamOptions
  })
}

function buildWebSearchTools(modelConfig: ModelConfig): ToolSet {
  if (modelConfig.mode === 'azure') {
    const tools = {
      web_search_preview: azureProvider.tools.webSearchPreview({
        searchContextSize: 'high'
      })
    } satisfies Record<'web_search_preview', ProviderToolLike>

    return toToolSet(tools)
  }

  const openaiModelConfig = modelConfig as Extract<ModelConfig, { mode: 'openai' }>
  const tools = {
    web_search_preview: openaiModelConfig.openaiProvider.tools.webSearchPreview({
      searchContextSize: 'high'
    })
  } satisfies Record<'web_search_preview', ProviderToolLike>

  return toToolSet(tools)
}

function createProviderStream({
  modelConfig,
  messages,
  abortSignal
}: ProviderStreamInput): ProviderStreamPlan {
  const baseStreamOptions = createBaseStreamOptions(messages, abortSignal)
  const createFallbackStream = () => runPlainStream(modelConfig.model, baseStreamOptions)

  if (modelConfig.mode === 'azure') {
    return {
      createPrimaryStream: () =>
        streamText({
          model: modelConfig.model,
          tools: buildWebSearchTools(modelConfig),
          ...baseStreamOptions
        }),
      createFallbackStream,
      shouldFallbackOnError: isWebSearchSetupFallbackError
    }
  }

  const openaiModelConfig = modelConfig as Extract<ModelConfig, { mode: 'openai' }>
  return {
    createPrimaryStream: () =>
      streamText({
        model: openaiModelConfig.openaiProvider.responses(openaiModelConfig.openaiModel),
        tools: buildWebSearchTools(openaiModelConfig),
        ...baseStreamOptions
      }),
    createFallbackStream,
    shouldFallbackOnError: isWebSearchSetupFallbackError
  }
}

// --- Stream response ---

function createStreamResponse(providerPlan: ProviderStreamPlan): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        const primary = providerPlan.createPrimaryStream()
        for await (const part of primary.toUIMessageStream({
          sendSources: true,
          sendReasoning: false,
          onError: (error) => {
            throw error
          }
        })) {
          writer.write(part)
        }
      } catch (error) {
        if (!providerPlan.shouldFallbackOnError?.(error) || !providerPlan.createFallbackStream) {
          throw error
        }

        console.warn(
          '[Chat API] Web search unavailable at request start; falling back to plain chat',
          error
        )

        const fallback = providerPlan.createFallbackStream()
        for await (const part of fallback.toUIMessageStream({
          sendSources: false,
          sendReasoning: false,
          sendStart: false,
          onError: (fallbackError) => {
            throw fallbackError
          }
        })) {
          writer.write(part)
        }
      }
    },
    onError: (error) => {
      console.error('[Chat API] Stream error:', error)
      return getPublicStreamErrorMessage(error)
    }
  })

  return createUIMessageStreamResponse({
    stream,
    headers: STREAM_RESPONSE_HEADERS
  })
}

export async function POST(req: NextRequest): Promise<Response> {
  const parsed = await parseRequest(req)
  if (parsed instanceof Response) return parsed

  try {
    const modelMessages = await buildModelMessages(parsed.prompt, parsed.messages)
    const result = createProviderStream({
      modelConfig: getModel(),
      messages: modelMessages,
      abortSignal: req.signal
    })

    return createStreamResponse(result)
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return new AppError('internal_error', GENERIC_INTERNAL_ERROR_MESSAGE).toResponse()
  }
}
