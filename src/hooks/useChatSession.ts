'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react'
import { buildUserMessageParts, type ChatComposerPayload } from '@/lib/chat-attachments'
import { getItem, setItem } from '@/lib/client-storage'
import { readPersistedMessages, writePersistedMessages } from '@/lib/chat-persistence'
import { createChatTransport } from '@/lib/chat-transport'
import { getTextFromParts, isStreamingStatus, type ChatStreamPhase } from '@/lib/chat-utils'
import { generateId } from '@/lib/id'
import type { ChatMessage } from '@/lib/types'
import { DEFAULT_AI_MODEL, isAIModelValue, type AIModelValue } from '@/services/ai-models'
import { CACHE_KEY } from '@/services/constant'
import { useChat, type UseChatHelpers } from '@ai-sdk/react'

// 32ms throttles stream-driven state updates to ~31fps, which is below 60fps but
// noticeably reduces React render churn during token streaming on slower devices.
const CHAT_STREAM_THROTTLE_MS = 32
const DEFAULT_SYSTEM_PROMPT = 'You are a professional, friendly, and helpful AI assistant.'
const DEFAULT_COMPOSER_ERROR_MESSAGE = 'Something went wrong. Please try again.'
const NETWORK_COMPOSER_ERROR_MESSAGE = 'Network error. Please check your connection and try again.'
const EMPTY_MESSAGES: ChatMessage[] = []

interface UseChatSessionReturn {
  messages: ChatMessage[]
  status: UseChatHelpers<ChatMessage>['status']
  streamPhase: ChatStreamPhase
  isLoading: boolean
  streamError: string | null
  composerError: string | null
  selectedModel: AIModelValue
  setComposerError: Dispatch<SetStateAction<string | null>>
  setSelectedModel: (model: AIModelValue) => void
  handleSend: (payload: ChatComposerPayload) => Promise<boolean>
  handleStop: () => void
  handleClearMessages: () => void
  handleDismissError: () => void
}

type ChatSetMessages = UseChatHelpers<ChatMessage>['setMessages']
type ChatSendMessage = UseChatHelpers<ChatMessage>['sendMessage']

type StreamPhaseParams = {
  isLoading: boolean
  messages: ChatMessage[]
  hasPendingToolCall: boolean
}

type SendUserMessageParams = {
  chatId: string
  payload: ChatComposerPayload
  selectedModel: AIModelValue
  isLoading: boolean
  sendMessage: ChatSendMessage
  setComposerError: Dispatch<SetStateAction<string | null>>
  setHasPendingToolCall: Dispatch<SetStateAction<boolean>>
}

type SessionCommitOptions = {
  trimTrailingAssistant?: boolean
}

function readSelectedModel(): AIModelValue {
  const persistedModel = getItem(CACHE_KEY.SELECTED_AI_MODEL)
  return isAIModelValue(persistedModel) ? persistedModel : DEFAULT_AI_MODEL.value
}

function dropTrailingEmptyAssistantMessages(conversation: ChatMessage[]): ChatMessage[] {
  let end = conversation.length
  while (end > 0) {
    const last = conversation[end - 1]
    if (last.role !== 'assistant' || getTextFromParts(last.parts).trim().length > 0) {
      break
    }
    end--
  }
  return end === conversation.length ? conversation : conversation.slice(0, end)
}

function parseErrorMessageFromJsonText(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text)

    if (typeof parsed === 'string') {
      const message = parsed.trim()
      return message.length > 0 ? message : null
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'message' in parsed &&
      typeof (parsed as { message?: unknown }).message === 'string'
    ) {
      const message = (parsed as { message: string }).message.trim()
      return message.length > 0 ? message : null
    }
  } catch {
    // Ignore parse errors and fall back to the raw message.
  }

  return null
}

function getComposerErrorMessage(error: unknown): string {
  if (error == null) {
    return DEFAULT_COMPOSER_ERROR_MESSAGE
  }

  if (typeof error === 'string') {
    const rawMessage = error.trim()
    if (rawMessage.length === 0) {
      return DEFAULT_COMPOSER_ERROR_MESSAGE
    }

    return parseErrorMessageFromJsonText(rawMessage) ?? rawMessage
  }

  if (error instanceof Error) {
    const rawMessage = error.message.trim()
    if (rawMessage.length === 0) {
      return DEFAULT_COMPOSER_ERROR_MESSAGE
    }

    const parsedMessage = parseErrorMessageFromJsonText(rawMessage)
    if (parsedMessage) {
      return parsedMessage
    }

    const lowerMessage = rawMessage.toLowerCase()
    if (
      lowerMessage === 'failed to fetch' ||
      lowerMessage.includes('networkerror') ||
      lowerMessage.includes('network request failed')
    ) {
      return NETWORK_COMPOSER_ERROR_MESSAGE
    }

    return rawMessage
  }

  return DEFAULT_COMPOSER_ERROR_MESSAGE
}

function commitConversation(
  chatId: string,
  conversation: ChatMessage[],
  options: SessionCommitOptions = {}
): ChatMessage[] {
  const nextConversation = options.trimTrailingAssistant
    ? dropTrailingEmptyAssistantMessages(conversation)
    : conversation
  writePersistedMessages(chatId, nextConversation)
  return nextConversation
}

function hydrateMessagesFromStorage(chatId: string, setMessages: ChatSetMessages): void {
  const persistedMessages = readPersistedMessages(chatId)
  if (persistedMessages.length === 0) {
    return
  }

  setMessages((currentMessages) => {
    return currentMessages.length === 0 ? persistedMessages : currentMessages
  })
}

function deriveStreamPhase({
  isLoading,
  messages,
  hasPendingToolCall
}: StreamPhaseParams): ChatStreamPhase {
  if (!isLoading) {
    return 'idle'
  }

  const pendingAssistantMessage = messages.length > 0 ? messages[messages.length - 1] : undefined
  const pendingAssistantHasText =
    pendingAssistantMessage?.role === 'assistant' &&
    getTextFromParts(pendingAssistantMessage.parts).trim().length > 0

  if (pendingAssistantHasText) {
    return 'streaming'
  }

  return hasPendingToolCall ? 'tool-calling' : 'thinking'
}

async function sendUserMessage({
  chatId,
  payload,
  selectedModel,
  isLoading,
  sendMessage,
  setComposerError,
  setHasPendingToolCall
}: SendUserMessageParams): Promise<boolean> {
  const parts = buildUserMessageParts(payload.text, payload.uploadedImages)
  if (parts.length === 0) {
    setComposerError('Please enter a message or upload an image to continue.')
    return false
  }

  if (isLoading) {
    setComposerError('Message is already sending. Please wait a moment.')
    return false
  }

  try {
    setComposerError(null)
    setHasPendingToolCall(false)

    const userMessage: ChatMessage = {
      id: generateId(),
      createdAt: new Date(),
      role: 'user',
      parts
    }

    const persistedMessages = readPersistedMessages(chatId)
    commitConversation(chatId, [...persistedMessages, userMessage])

    await sendMessage(userMessage, {
      body: { prompt: DEFAULT_SYSTEM_PROMPT, model: selectedModel }
    })
    return true
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return true
    }
    setComposerError(getComposerErrorMessage(err))
    console.error(err)
    return false
  }
}

export function useChatSession(chatId: string): UseChatSessionReturn {
  const [composerError, setComposerError] = useState<string | null>(null)
  const [dismissedError, setDismissedError] = useState<Error | null>(null)
  const [hasPendingToolCall, setHasPendingToolCall] = useState(false)
  const [selectedModel, setSelectedModelState] = useState<AIModelValue>(readSelectedModel)
  const [transport] = useState(createChatTransport)

  const setSelectedModel = useCallback((model: AIModelValue) => {
    setSelectedModelState(model)
    setItem(CACHE_KEY.SELECTED_AI_MODEL, model)
  }, [])

  const commitMessages = useCallback(
    (conversation: ChatMessage[]) => {
      return commitConversation(chatId, conversation)
    },
    [chatId]
  )

  const commitTrimmedMessages = useCallback(
    (conversation: ChatMessage[]) => {
      return commitConversation(chatId, conversation, { trimTrailingAssistant: true })
    },
    [chatId]
  )

  const handleFinish = useCallback(
    ({ messages: finalMessages, isAbort }: { messages: ChatMessage[]; isAbort: boolean }) => {
      setHasPendingToolCall(false)

      if (isAbort) {
        return commitTrimmedMessages(finalMessages)
      }

      commitMessages(finalMessages)
    },
    [commitMessages, commitTrimmedMessages]
  )

  const handleError = useCallback((err: Error) => {
    setHasPendingToolCall(false)
    console.error(err)
  }, [])

  const handleToolCall = useCallback(() => {
    setHasPendingToolCall(true)
  }, [])

  const { messages, setMessages, sendMessage, status, error, stop } = useChat<ChatMessage>({
    id: chatId,
    messages: EMPTY_MESSAGES,
    transport,
    experimental_throttle: CHAT_STREAM_THROTTLE_MS,
    onToolCall: handleToolCall,
    onFinish: handleFinish,
    onError: handleError
  })

  useEffect(() => {
    hydrateMessagesFromStorage(chatId, setMessages)
  }, [chatId, setMessages])

  const isLoading = isStreamingStatus(status)
  const streamPhase = useMemo<ChatStreamPhase>(() => {
    return deriveStreamPhase({
      isLoading,
      messages,
      hasPendingToolCall
    })
  }, [hasPendingToolCall, isLoading, messages])

  useEffect(() => {
    if (!error) return
    setMessages(commitTrimmedMessages)
  }, [commitTrimmedMessages, error, setMessages])

  const streamError = error && error !== dismissedError ? error.message : null

  const handleSend = useCallback(
    (payload: ChatComposerPayload) => {
      return sendUserMessage({
        chatId,
        payload,
        selectedModel,
        isLoading,
        sendMessage,
        setComposerError,
        setHasPendingToolCall
      })
    },
    [chatId, isLoading, selectedModel, sendMessage, setComposerError]
  )

  const handleStop = useCallback(() => {
    setHasPendingToolCall(false)
    stop()
    setMessages(commitTrimmedMessages)
  }, [commitTrimmedMessages, setMessages, stop])

  const handleClearMessages = useCallback(() => {
    if (isLoading) return
    setHasPendingToolCall(false)
    stop()
    setMessages([])
    commitMessages([])
  }, [commitMessages, isLoading, setMessages, stop])

  const handleDismissError = useCallback(() => {
    setDismissedError(error ?? null)
  }, [error])

  return {
    messages,
    status,
    streamPhase,
    isLoading,
    streamError,
    composerError,
    selectedModel,
    setComposerError,
    setSelectedModel,
    handleSend,
    handleStop,
    handleClearMessages,
    handleDismissError
  }
}
