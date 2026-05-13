import { type RefObject } from 'react'
import { AppButton, AppIconButton } from '@/components/common/app-button'
import { ButtonWithTooltip } from '@/components/common/button-with-tooltip'
import { ATTACHMENTS_ACCEPT } from '@/lib/chat-attachments'
import { type AIModelValue } from '@/services/ai-models'
import { ArrowUp, Paperclip, Square, Trash2 } from 'lucide-react'

import { ModelSelector } from './model-selector'

interface ComposerToolbarProps {
  isSending: boolean
  canSend: boolean
  showClear: boolean
  selectedModel: AIModelValue
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onModelChange: (model: AIModelValue) => void
  onClear: () => void
  onSend: (e: React.SyntheticEvent) => void
  onStop: () => void
}

export function ComposerToolbar({
  isSending,
  canSend,
  showClear,
  selectedModel,
  fileInputRef,
  onFileUpload,
  onModelChange,
  onClear,
  onSend,
  onStop
}: ComposerToolbarProps) {
  return (
    <div className="flex items-center justify-between px-3 pb-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          name="attachments"
          accept={ATTACHMENTS_ACCEPT}
          multiple
          className="hidden"
          aria-label="Attach file"
          onChange={onFileUpload}
        />
        <ButtonWithTooltip label="Attach file">
          <AppIconButton
            size="icon-sm"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            className="text-muted-foreground hover:text-foreground hover:bg-primary/5 rounded-full transition-colors duration-200"
          >
            <Paperclip aria-hidden="true" />
          </AppIconButton>
        </ButtonWithTooltip>
        <ModelSelector
          selectedModel={selectedModel}
          disabled={isSending}
          onModelChange={onModelChange}
        />
        {showClear && (
          <ButtonWithTooltip label="Clear conversation history">
            <AppButton
              size="sm"
              variant="outline"
              className="hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive disabled:border-border/40 rounded-lg shadow-none transition-colors duration-200 md:h-7"
              disabled={isSending}
              onClick={onClear}
            >
              <Trash2 data-icon="inline-start" aria-hidden="true" />
              <span className="text-xs font-medium">Clear history</span>
            </AppButton>
          </ButtonWithTooltip>
        )}
      </div>
      {isSending ? (
        <div className="flex items-center gap-2" role="status" aria-live="polite">
          <span className="sr-only">Generating response</span>
          <ButtonWithTooltip label="Stop generating">
            <AppIconButton
              type="button"
              size="icon-sm"
              onClick={onStop}
              aria-label="Stop generating"
              className="bg-accent text-accent-foreground hover:bg-accent/90 relative overflow-hidden rounded-full transition-colors duration-200 hover:shadow-lg"
            >
              <Square fill="currentColor" stroke="none" aria-hidden="true" />
            </AppIconButton>
          </ButtonWithTooltip>
        </div>
      ) : (
        <ButtonWithTooltip label="Send message">
          <AppIconButton
            size="icon-sm"
            disabled={!canSend}
            className="bg-primary text-primary-foreground hover:bg-primary/90 relative overflow-hidden rounded-full transition-colors duration-200 hover:shadow-lg disabled:cursor-not-allowed disabled:hover:shadow-none"
            onClick={onSend}
            aria-label="Send message"
          >
            <ArrowUp aria-hidden="true" />
          </AppIconButton>
        </ButtonWithTooltip>
      )}
    </div>
  )
}
