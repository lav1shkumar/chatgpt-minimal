'use client'

import { forwardRef, memo, useCallback, useId, useImperativeHandle, useRef, useState } from 'react'
import { useChatComposerContext } from '@/components/chat/chat-session-context'
import { AppIconButton } from '@/components/common/app-button'
import { ButtonWithTooltip } from '@/components/common/button-with-tooltip'
import { ConfirmActionDialog } from '@/components/common/confirm-action-dialog'
import { useFileAttachments } from '@/hooks/useFileAttachments'
import {
  createUploadedImage,
  type UploadedImage
} from '@/lib/chat-attachments'
import { getItem, removeItem, setItem } from '@/lib/client-storage'
import { getTextFromParts } from '@/lib/chat-utils'
import type { ChatMessage } from '@/lib/types'
import { CACHE_KEY } from '@/services/constant'
import { X } from 'lucide-react'

import { ComposerAttachments } from './composer/composer-attachments'
import { ComposerError } from './composer/composer-error'
import { ComposerTextarea } from './composer/composer-textarea'
import { ComposerToolbar } from './composer/composer-toolbar'

export interface ChatComposerHandle {
  focus: () => void
  startEdit: (message: ChatMessage) => void
}

interface ChatComposerProps {
  showClear: boolean
}

function readShouldConfirmClearHistory(): boolean {
  return getItem(CACHE_KEY.CLEAR_HISTORY_CONFIRM) !== '0'
}

function writeShouldConfirmClearHistory(shouldConfirm: boolean): void {
  if (shouldConfirm) {
    removeItem(CACHE_KEY.CLEAR_HISTORY_CONFIRM)
    return
  }

  setItem(CACHE_KEY.CLEAR_HISTORY_CONFIRM, '0')
}

function getFilePartName(part: ChatMessage['parts'][number]): string | undefined {
  if (!('filename' in part) || typeof part.filename !== 'string') {
    return undefined
  }

  return part.filename
}

function getEditableUploadedImages(message: ChatMessage): UploadedImage[] {
  return message.parts.flatMap((part) => {
    if (
      part.type !== 'file' ||
      !part.mediaType.startsWith('image/') ||
      typeof part.url !== 'string' ||
      part.url.length === 0
    ) {
      return []
    }

    return createUploadedImage({
      url: part.url,
      mimeType: part.mediaType,
      name: getFilePartName(part)
    })
  })
}

const ChatComposerComponent = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer({ showClear }, ref): React.JSX.Element {
    const {
      isSending,
      composerError,
      selectedModel,
      setComposerError,
      setSelectedModel,
      onClear,
      onSend,
      onStop
    } = useChatComposerContext()

    const [message, setMessage] = useState('')
    const [editingMessageId, setEditingMessageId] = useState<string | undefined>(undefined)
    const [isComposerFocused, setIsComposerFocused] = useState(false)
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
    const [shouldConfirmClearHistory, setShouldConfirmClearHistory] = useState(
      readShouldConfirmClearHistory
    )
    const [skipFutureClearConfirm, setSkipFutureClearConfirm] = useState(false)
    const composingRef = useRef(false)
    const messageRef = useRef(message)

    const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

    const {
      uploadedImages,
      fileInputRef,
      handleFileUpload,
      handlePaste,
      handleImagePreviewError,
      removeImage,
      resetAttachments,
      restoreAttachments,
      hasAttachments,
      hasCurrentAttachments
    } = useFileAttachments()

    const chatInputId = useId()
    const helperTextId = useId()
    const errorTextId = useId()

    const hasText = message.trim().length > 0
    const hasContent = hasText || hasAttachments
    const canSend = !isSending && hasContent

    const resetComposerState = useCallback(() => {
      messageRef.current = ''
      setMessage('')
      setEditingMessageId(undefined)
      resetAttachments()
    }, [resetAttachments])

    const startEdit = useCallback(
      (messageToEdit: ChatMessage) => {
        if (isSending || messageToEdit.role !== 'user') {
          return
        }

        const text = getTextFromParts(messageToEdit.parts)
        messageRef.current = text
        setMessage(text)
        setEditingMessageId(messageToEdit.id)
        restoreAttachments(getEditableUploadedImages(messageToEdit))
        setComposerError(null)
        requestAnimationFrame(() => textAreaRef.current?.focus())
      },
      [isSending, restoreAttachments, setComposerError]
    )

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          textAreaRef.current?.focus()
        },
        startEdit
      }),
      [startEdit]
    )

    const handleCancelEdit = useCallback(() => {
      resetComposerState()
      setComposerError(null)
      textAreaRef.current?.focus()
    }, [resetComposerState, setComposerError])

    const handleSubmit = useCallback(
      async (event: React.SyntheticEvent) => {
        event.preventDefault()

        if (!canSend) {
          return
        }

        const input = message.trim()

        const draftMessage = message
        const draftImages = uploadedImages
        const draftEditingMessageId = editingMessageId

        resetComposerState()
        setComposerError(null)

        let accepted = false
        try {
          accepted = await onSend({
            text: input,
            uploadedImages: draftImages,
            editingMessageId: draftEditingMessageId
          })
        } catch (error) {
          console.error(error)
          setComposerError('Something went wrong. Please try again.')
          accepted = false
        }

        if (!accepted) {
          const shouldRestoreDraft = messageRef.current.length === 0 && !hasCurrentAttachments()

          if (shouldRestoreDraft) {
            messageRef.current = draftMessage
            setMessage(draftMessage)
            setEditingMessageId(draftEditingMessageId)
            restoreAttachments(draftImages)
            textAreaRef.current?.focus()
          }
        }
      },
      [
        hasCurrentAttachments,
        canSend,
        message,
        editingMessageId,
        onSend,
        resetComposerState,
        restoreAttachments,
        setComposerError,
        uploadedImages
      ]
    )

    const handleClear = useCallback(() => {
      if (!shouldConfirmClearHistory) {
        onClear()
        resetComposerState()
        setComposerError(null)
        return
      }

      setSkipFutureClearConfirm(false)
      setIsClearConfirmOpen(true)
    }, [onClear, resetComposerState, setComposerError, shouldConfirmClearHistory])

    const confirmClear = useCallback(() => {
      if (skipFutureClearConfirm && shouldConfirmClearHistory) {
        setShouldConfirmClearHistory(false)
        writeShouldConfirmClearHistory(false)
      }

      onClear()
      resetComposerState()
      setComposerError(null)
      setIsClearConfirmOpen(false)
    }, [
      onClear,
      resetComposerState,
      setComposerError,
      shouldConfirmClearHistory,
      skipFutureClearConfirm
    ])

    const handleKeypress = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
          e.preventDefault()
          if (!canSend) {
            return
          }
          handleSubmit(e)
        }
      },
      [canSend, handleSubmit]
    )

    const handleMessageChange = useCallback(
      (value: string) => {
        messageRef.current = value
        setMessage(value)
        setComposerError(null)
      },
      [setComposerError]
    )

    const showPlaceholder = !message && !isComposerFocused && !hasAttachments
    const isEditing = Boolean(editingMessageId)

    return (
      <>
        <div className="relative">
          <div className="bg-card border-border/60 focus-within:border-primary/30 focus-within:ring-primary/20 has-[textarea[aria-invalid=true]]:border-destructive has-[textarea[aria-invalid=true]]:ring-destructive/20 flex flex-col rounded-2xl border shadow-md transition-[border-color,box-shadow] duration-200 ease-out focus-within:shadow-lg focus-within:ring-4 has-[textarea[aria-invalid=true]]:ring-2">
            {isEditing && (
              <div className="text-muted-foreground flex items-center justify-between gap-3 px-4 pt-3 text-sm">
                <span className="font-medium">Editing message</span>
                <ButtonWithTooltip label="Cancel edit">
                  <AppIconButton
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    touch={false}
                    mutedDisabled={false}
                    className="hover:text-foreground size-8"
                    onClick={handleCancelEdit}
                    aria-label="Cancel editing message"
                  >
                    <X aria-hidden="true" />
                  </AppIconButton>
                </ButtonWithTooltip>
              </div>
            )}
            {hasAttachments && (
              <ComposerAttachments
                uploadedImages={uploadedImages}
                onRemoveImage={removeImage}
                onImagePreviewError={handleImagePreviewError}
              />
            )}
            <ComposerTextarea
              textAreaRef={textAreaRef}
              message={message}
              showPlaceholder={showPlaceholder}
              composerError={composerError}
              chatInputId={chatInputId}
              helperTextId={helperTextId}
              errorTextId={errorTextId}
              onMessageChange={handleMessageChange}
              onFocus={() => setIsComposerFocused(true)}
              onBlur={() => setIsComposerFocused(false)}
              onCompositionStart={() => {
                composingRef.current = true
              }}
              onCompositionEnd={() => {
                composingRef.current = false
              }}
              onKeyDown={handleKeypress}
              onPaste={handlePaste}
            />

            {composerError ? (
              <ComposerError errorTextId={errorTextId} message={composerError} />
            ) : null}

            <ComposerToolbar
              isSending={isSending}
              canSend={canSend}
              showClear={showClear}
              fileInputRef={fileInputRef}
              selectedModel={selectedModel}
              onFileUpload={handleFileUpload}
              onModelChange={setSelectedModel}
              onClear={handleClear}
              onSend={handleSubmit}
              onStop={onStop}
            />
          </div>
          <p className="text-muted-foreground mt-2 hidden px-1 text-xs leading-relaxed text-pretty md:block">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
        {isClearConfirmOpen ? (
          <ConfirmActionDialog
            open={isClearConfirmOpen}
            onOpenChange={setIsClearConfirmOpen}
            title="Clear conversation history"
            description="This removes all messages in this conversation and cannot be undone."
            confirmLabel="Clear history"
            confirmVariant="destructive"
            rememberChoiceLabel="Don't ask again"
            rememberChoice={skipFutureClearConfirm}
            onRememberChoiceChange={setSkipFutureClearConfirm}
            onConfirm={confirmClear}
          />
        ) : null}
      </>
    )
  }
)

export const ChatComposer = memo(ChatComposerComponent)
ChatComposer.displayName = 'ChatComposer'
