'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore, type RefObject } from 'react'
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/chat-composer'
import { ChatSessionProvider } from '@/components/chat/chat-session-context'
import { MessageList } from '@/components/chat/message-list'
import { Separator } from '@/components/ui/separator'
import { useChatSession } from '@/hooks/useChatSession'
import type { ChatMessage } from '@/lib/types'
import { isMobileViewport } from '@/lib/viewport'
import { StickToBottom } from 'use-stick-to-bottom'

const SINGLE_CHAT_ID = 'chat-minimal-session'
const CHAT_COLUMN_MAX_WIDTH = 'max-w-[70rem]'
const SAFE_AREA_HORIZONTAL_PADDING =
  'pr-[max(env(safe-area-inset-right),1rem)] pl-[max(env(safe-area-inset-left),1rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)] lg:pr-[max(env(safe-area-inset-right),2rem)] lg:pl-[max(env(safe-area-inset-left),2rem)]'
const CHAT_COLUMN_CLASS = `@container/chat mx-auto w-full ${CHAT_COLUMN_MAX_WIDTH} ${SAFE_AREA_HORIZONTAL_PADDING}`
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeToReducedMotionPreference(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
  mediaQuery.addEventListener('change', onChange)

  return () => {
    mediaQuery.removeEventListener('change', onChange)
  }
}

function getReducedMotionPreferenceSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

type ChatViewProps = {
  composerRef: RefObject<ChatComposerHandle | null>
}

function EmptyChatView({ composerRef }: ChatViewProps): React.JSX.Element {
  return (
    <div className="bg-background text-foreground flex min-h-0 flex-1 flex-col items-center justify-center pr-[max(env(safe-area-inset-right),1rem)] pl-[max(env(safe-area-inset-left),1rem)]">
      <div className="relative flex w-full max-w-3xl -translate-y-6 flex-col gap-10 text-center">
        <div className="flex flex-col gap-5">
          <h1 className="text-foreground text-3xl font-medium tracking-tight text-balance md:text-4xl lg:text-5xl">
            How can I help?
          </h1>
        </div>
        <ChatComposer ref={composerRef} showClear={false} />
      </div>
    </div>
  )
}

function ConversationView({ composerRef }: ChatViewProps): React.JSX.Element {
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotionPreference,
    getReducedMotionPreferenceSnapshot,
    () => false
  )
  const scrollBehavior = prefersReducedMotion ? 'auto' : 'smooth'

  return (
    <div className="bg-background text-foreground relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <h1 className="sr-only">Chat conversation</h1>
      <StickToBottom
        className="relative min-h-0 flex-1 overflow-y-auto"
        initial={scrollBehavior}
        resize={scrollBehavior}
      >
        <StickToBottom.Content className="relative flex min-h-full flex-col">
          <div className={`${CHAT_COLUMN_CLASS} relative flex-1 pt-5 pb-4`}>
            <MessageList />
          </div>
        </StickToBottom.Content>
      </StickToBottom>
      <div className="bg-background relative shrink-0">
        <Separator className="bg-border/60" />
        <div
          className={`${CHAT_COLUMN_CLASS} pt-2.5 pb-[calc(0.5rem+env(safe-area-inset-bottom))]`}
        >
          <ChatComposer ref={composerRef} showClear={true} />
        </div>
      </div>
    </div>
  )
}

function Chat(): React.JSX.Element {
  const composerRef = useRef<ChatComposerHandle>(null)

  const {
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
  } = useChatSession(SINGLE_CHAT_ID)
  const hasMessages = messages.length > 0

  useEffect(() => {
    if (!isMobileViewport()) {
      composerRef.current?.focus()
    }
  }, [])

  const handleEditUserMessage = useCallback((message: ChatMessage) => {
    composerRef.current?.startEdit(message)
  }, [])

  return (
    <ChatSessionProvider
      messages={messages}
      streamStatus={status}
      streamPhase={streamPhase}
      error={streamError}
      onDismissError={handleDismissError}
      onEditUserMessage={handleEditUserMessage}
      isSending={isLoading}
      composerError={composerError}
      selectedModel={selectedModel}
      setComposerError={setComposerError}
      setSelectedModel={setSelectedModel}
      onClear={handleClearMessages}
      onStop={handleStop}
      onSend={handleSend}
    >
      {hasMessages ? (
        <ConversationView composerRef={composerRef} />
      ) : (
        <EmptyChatView composerRef={composerRef} />
      )}
    </ChatSessionProvider>
  )
}

export default Chat
