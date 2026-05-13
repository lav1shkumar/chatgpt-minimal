import type { ChatMessage } from '@/lib/types'
import { DEFAULT_AI_MODEL, isAIModelValue } from '@/services/ai-models'
import { DefaultChatTransport } from 'ai'

export function createChatTransport() {
  return new DefaultChatTransport<ChatMessage>({
    api: '/api/chat',
    prepareSendMessagesRequest: ({ messages, body, headers }) => {
      const prompt = typeof body?.prompt === 'string' ? body.prompt : ''
      const model = isAIModelValue(body?.model) ? body.model : DEFAULT_AI_MODEL.value

      return {
        headers: {
          ...headers,
          Accept: 'text/event-stream'
        },
        body: {
          prompt,
          model,
          messages: messages.map(({ role, parts }) => ({ role, parts }))
        }
      }
    }
  })
}
