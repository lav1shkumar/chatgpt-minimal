import type { JsonValue } from '@/types/json'
import type { UIMessage, UIMessagePart, UITools } from 'ai'

export type ChatMessageSource =
  | { type: 'url'; sourceId: string; url: string; title?: string }
  | {
      type: 'document'
      sourceId: string
      mediaType: string
      title: string
      filename?: string
    }

// Intentionally empty: this app does not define custom UI message data parts.
type DataParts = { [key: string]: never }

export type ChatMessagePart = UIMessagePart<DataParts, UITools>

export type ChatMessage = Omit<
  UIMessage<Record<string, JsonValue>, DataParts, UITools>,
  'createdAt'
> & { createdAt?: Date }
