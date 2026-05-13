import { useMemo, useState } from 'react'
import { AppButton } from '@/components/common/app-button'
import { cn } from '@/lib/utils'
import { AI_Models, isAIModelValue, type AIModelValue } from '@/services/ai-models'
import { Check, ChevronDown } from 'lucide-react'
import { Popover as PopoverPrimitive, RadioGroup as RadioGroupPrimitive } from 'radix-ui'

interface ModelSelectorProps {
  selectedModel: AIModelValue
  disabled: boolean
  onModelChange: (model: AIModelValue) => void
}

export function ModelSelector({
  selectedModel,
  disabled,
  onModelChange
}: ModelSelectorProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const selectedAIModel = useMemo(() => {
    return AI_Models.find((model) => model.value === selectedModel) ?? AI_Models[0]
  }, [selectedModel])

  const handleModelChange = (nextModel: string): void => {
    if (!isAIModelValue(nextModel)) {
      return
    }

    onModelChange(nextModel)
    setOpen(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <AppButton
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          aria-label={`Select model, current model ${selectedAIModel.name}`}
          aria-expanded={open}
          className="border-border/60 bg-background hover:border-primary/30 hover:bg-primary/5 h-8 max-w-[9.5rem] gap-1.5 rounded-lg px-2.5 text-xs shadow-none transition-colors duration-200 disabled:opacity-100"
        >
          <span className="min-w-0 truncate font-medium">{selectedAIModel.name}</span>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-3.5 transition-transform duration-200',
              open && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </AppButton>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="bg-popover text-popover-foreground border-border/70 z-50 w-40 origin-(--radix-popover-content-transform-origin) rounded-lg border p-1 shadow-lg outline-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
        >
          <RadioGroupPrimitive.Root
            value={selectedModel}
            onValueChange={handleModelChange}
            aria-label="AI model"
            className="flex flex-col gap-1"
          >
            {AI_Models.map((model) => {
              const isSelected = model.value === selectedModel

              return (
                <RadioGroupPrimitive.Item
                  key={model.value}
                  value={model.value}
                  aria-label={model.name}
                  className={cn(
                    'hover:bg-accent/70 focus-visible:ring-ring/60 grid h-8 w-full grid-cols-[1fr_auto] items-center gap-2 rounded-md px-2.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2',
                    isSelected && 'bg-accent/60'
                  )}
                >
                  <span className="text-foreground min-w-0 truncate text-xs font-medium">
                    {model.name}
                  </span>
                  <RadioGroupPrimitive.Indicator className="text-primary flex size-4 items-center justify-center">
                    <Check className="size-3.5" aria-hidden="true" />
                  </RadioGroupPrimitive.Indicator>
                </RadioGroupPrimitive.Item>
              )
            })}
          </RadioGroupPrimitive.Root>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
