import { chatMessagePartSchema, chatMessageRoleSchema } from '@/lib/chat-message-contract'
import { getItem, removeItem, setItem, type StorageAction } from '@/lib/client-storage'
import type { ChatMessage } from '@/lib/types'
import { CACHE_KEY } from '@/services/constant'
import { z } from 'zod'

const persistedMessageSchema = z
  .object({
    id: z.string(),
    role: chatMessageRoleSchema,
    parts: z.array(chatMessagePartSchema)
  })
  .passthrough()

function storageKey(chatId: string): string {
  return CACHE_KEY.chatMessages(chatId)
}

function logStorageWarning(action: StorageAction, key: string, error: unknown): void {
  const verb = action === 'write' ? 'persist' : 'read'
  console.warn(`[chat-persistence] Failed to ${verb} messages for key="${key}"`, error)
}

const storageOptions = { onError: logStorageWarning }

/**
 * Strip base64 file payloads before saving to stay under localStorage quota.
 * UI keeps rendering a lightweight fallback for stripped images.
 */
function hasInlineFileData(part: ChatMessage['parts'][number]): boolean {
  return part.type === 'file' && typeof part.url === 'string' && part.url.startsWith('data:')
}

function stripBinaryDataForStorage(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.role !== 'user' || !Array.isArray(message.parts)) {
      return message
    }

    if (!message.parts.some(hasInlineFileData)) {
      return message
    }

    return {
      ...message,
      parts: message.parts.map((part) => (hasInlineFileData(part) ? { ...part, url: '' } : part))
    }
  })
}

function deserializeMessage(raw: unknown): ChatMessage | null {
  const parsed = persistedMessageSchema.safeParse(raw)
  if (!parsed.success) return null

  const base = {
    ...(parsed.data as Omit<ChatMessage, 'createdAt'>),
    parts: parsed.data.parts as ChatMessage['parts']
  }

  const createdAtRaw = parsed.data.createdAt
  if (
    createdAtRaw != null &&
    (typeof createdAtRaw === 'string' || typeof createdAtRaw === 'number')
  ) {
    const date = new Date(createdAtRaw)
    if (!Number.isNaN(date.getTime())) {
      return { ...base, createdAt: date }
    }
  }

  return { ...base, createdAt: undefined }
}

function getStoredMessages(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : []
}

export function readPersistedMessages(chatId: string): ChatMessage[] {
  const key = storageKey(chatId)
  const raw = getItem(key, storageOptions)
  if (raw == null) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    logStorageWarning('read', key, error)
    return []
  }

  const storedMessages = getStoredMessages(parsed)

  return storedMessages.flatMap((item) => {
    const message = deserializeMessage(item)
    return message ? [message] : []
  })
}

export function writePersistedMessages(chatId: string, messages: ChatMessage[]): void {
  const key = storageKey(chatId)
  if (messages.length === 0) {
    removeItem(key, storageOptions)
    return
  }

  try {
    const serializableMessages = stripBinaryDataForStorage(messages).map((message) => ({
      ...message,
      createdAt: message.createdAt ? message.createdAt.toISOString() : undefined
    }))

    setItem(key, JSON.stringify(serializableMessages), storageOptions)
  } catch (error) {
    logStorageWarning('write', key, error)
  }
}
