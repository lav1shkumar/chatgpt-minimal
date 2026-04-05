import type { ChatMessage, ChatMessagePart } from '@/lib/types'
import type { ChatStatus } from 'ai'

export type ChatStreamStatus = ChatStatus
export type ChatStreamPhase = 'idle' | 'thinking' | 'tool-calling' | 'streaming'

const STREAMING_STATUSES: ReadonlySet<ChatStreamStatus> = new Set<ChatStreamStatus>([
  'submitted',
  'streaming'
])

export function isStreamingStatus(status: ChatStreamStatus | undefined): boolean {
  return status != null && STREAMING_STATUSES.has(status)
}

export function findLastMessageIndex(messages: ChatMessage[], role: ChatMessage['role']): number {
  return messages.findLastIndex((message) => message.role === role)
}

export function getTextFromParts(parts: ChatMessagePart[]): string {
  const textSegments: string[] = []

  for (const part of parts) {
    if (part.type === 'text') {
      textSegments.push(part.text)
    }
  }

  return textSegments.join('')
}
