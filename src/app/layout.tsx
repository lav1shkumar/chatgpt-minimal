import type { Metadata, Viewport } from 'next'
import { SkipToContentLink } from '@/components/accessibility/skip-to-content-link'
import { ThemeProvider } from '@/providers/themes-provider'

import 'katex/dist/katex.min.css'
import './globals.css'

import { appFontClassName } from './fonts'

export const metadata: Metadata = {
  title: {
    default: 'ChatGPT Minimal',
    template: `%s - ChatGPT Minimal`
  },
  description: 'AI assistant powered by ChatGPT',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png'
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'oklch(0.99 0 0)' },
    { media: '(prefers-color-scheme: dark)', color: 'oklch(0 0 0)' }
  ]
}

type RootLayoutProps = {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps): React.JSX.Element {
  const shouldRenderAnalytics = process.env.VERCEL === '1'

  return (
    <html lang="en" suppressHydrationWarning className={`${appFontClassName} h-full`}>
      <body className="h-dvh overflow-hidden text-sm antialiased">
        <SkipToContentLink />
        <ThemeProvider enableAnalytics={shouldRenderAnalytics}>
          <main
            id="main-content"
            className="bg-background text-foreground flex h-full flex-1 flex-col overflow-hidden"
          >
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
