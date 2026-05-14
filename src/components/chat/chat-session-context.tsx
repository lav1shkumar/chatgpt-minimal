import {
  createContext,
  useContext,
  useMemo,
  type Context,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react'
import { type ChatComposerPayload } from '@/lib/chat-attachments'
import { type ChatStreamPhase, type ChatStreamStatus } from '@/lib/chat-utils'
import type { ChatMessage } from '@/lib/types'
import type { AIModelValue } from '@/services/ai-models'

type ChatMessagesContextValue = {
  messages: ChatMessage[]
  streamStatus: ChatStreamStatus
  streamPhase: ChatStreamPhase
  error: string | null
  onDismissError: () => void
  onEditUserMessage: (message: ChatMessage) => void
}

type ChatComposerContextValue = {
  isSending: boolean
  composerError: string | null
  selectedModel: AIModelValue
  setComposerError: Dispatch<SetStateAction<string | null>>
  setSelectedModel: (model: AIModelValue) => void
  onClear: () => void
  onSend: (payload: ChatComposerPayload) => Promise<boolean> | boolean
  onStop: () => void
}

type ChatSessionProviderProps = ChatMessagesContextValue &
  ChatComposerContextValue & {
    children: ReactNode
  }

const ChatMessagesContext = createContext<ChatMessagesContextValue | null>(null)
const ChatComposerContext = createContext<ChatComposerContextValue | null>(null)

function useRequiredContext<T>(context: Context<T | null>, contextName: string): T {
  const value = useContext(context)
  if (value !== null) {
    return value
  }
  throw new Error(`${contextName} must be used within ChatSessionProvider.`)
}

export function ChatSessionProvider({
  messages,
  streamStatus,
  streamPhase,
  error,
  onDismissError,
  onEditUserMessage,
  isSending,
  composerError,
  selectedModel,
  setComposerError,
  setSelectedModel,
  onClear,
  onSend,
  onStop,
  children
}: ChatSessionProviderProps): React.JSX.Element {
  const messagesValue = useMemo<ChatMessagesContextValue>(
    () => ({
      messages,
      streamStatus,
      streamPhase,
      error,
      onDismissError,
      onEditUserMessage
    }),
    [messages, streamStatus, streamPhase, error, onDismissError, onEditUserMessage]
  )

  const composerValue = useMemo<ChatComposerContextValue>(
    () => ({
      isSending,
      composerError,
      selectedModel,
      setComposerError,
      setSelectedModel,
      onClear,
      onSend,
      onStop
    }),
    [
      isSending,
      composerError,
      selectedModel,
      setComposerError,
      setSelectedModel,
      onClear,
      onSend,
      onStop
    ]
  )

  return (
    <ChatMessagesContext.Provider value={messagesValue}>
      <ChatComposerContext.Provider value={composerValue}>{children}</ChatComposerContext.Provider>
    </ChatMessagesContext.Provider>
  )
}

export function useChatMessagesContext(): ChatMessagesContextValue {
  return useRequiredContext(ChatMessagesContext, 'ChatMessagesContext')
}

export function useChatComposerContext(): ChatComposerContextValue {
  return useRequiredContext(ChatComposerContext, 'ChatComposerContext')
}
