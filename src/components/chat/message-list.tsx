import { useChatMessagesContext } from '@/components/chat/chat-session-context'
import { ChatStreamError } from '@/components/chat/chat-stream-error'
import { Message } from '@/components/chat/message'
import { isStreamingStatus } from '@/lib/chat-utils'
import type { ChatMessage } from '@/lib/types'

const PENDING_ASSISTANT_MESSAGE: ChatMessage = {
  id: 'pending-assistant-message',
  role: 'assistant',
  parts: []
}

export function MessageList(): React.JSX.Element {
  const { messages, streamStatus, streamPhase, error, onDismissError } = useChatMessagesContext()
  const isStreaming = isStreamingStatus(streamStatus)
  const lastMessageIndex = messages.length - 1
  const lastAssistantIndex =
    isStreaming && lastMessageIndex >= 0 && messages[lastMessageIndex].role === 'assistant'
      ? lastMessageIndex
      : -1
  const showPendingAssistant = isStreaming && lastAssistantIndex === -1

  return (
    <div className="flex flex-col gap-5">
      {messages.map((item, index) => {
        const isLastStreaming = isStreaming && index === lastAssistantIndex
        return (
          <div
            key={item.id}
            className="[contain-intrinsic-size:auto_80px] [content-visibility:auto]"
          >
            <Message
              message={item}
              isThinking={isLastStreaming}
              streamPhase={isLastStreaming ? streamPhase : undefined}
            />
          </div>
        )
      })}
      {showPendingAssistant ? (
        <div className="[contain-intrinsic-size:auto_80px] [content-visibility:auto]">
          <Message message={PENDING_ASSISTANT_MESSAGE} isThinking streamPhase={streamPhase} />
        </div>
      ) : null}
      <ChatStreamError error={error} onDismissError={onDismissError} />
    </div>
  )
}
