'use client'

import { ButtonWithTooltip } from '@/components/common/button-with-tooltip'
import ThemeToggle from '@/components/theme/toggle'
import { Button } from '@/components/ui/button'
import { Github } from 'lucide-react'

export function Header(): React.JSX.Element {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 w-full pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[60rem] items-center py-2 pr-[max(env(safe-area-inset-right),0.5rem)] pl-[max(env(safe-area-inset-left),0.5rem)] sm:py-2.5 sm:pr-[max(env(safe-area-inset-right),0.75rem)] sm:pl-[max(env(safe-area-inset-left),0.75rem)]">
        <div className="flex min-w-0 flex-1 items-center">
          <span className="text-foreground text-xl font-medium tracking-tight select-none sm:text-2xl">
            ChatGPT Minimal
          </span>
        </div>
        <nav className="flex min-w-0 items-center justify-end">
          <ThemeToggle />
          <ButtonWithTooltip label="Open ChatGPT Minimal on GitHub" placement="bottom">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground/50 hover:text-foreground/70 rounded-full transition-colors duration-200 hover:bg-transparent"
              asChild
            >
              <a
                href="https://github.com/blrchen/chatgpt-minimal"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open ChatGPT Minimal on GitHub"
              >
                <Github aria-hidden="true" />
              </a>
            </Button>
          </ButtonWithTooltip>
        </nav>
      </div>
    </header>
  )
}
