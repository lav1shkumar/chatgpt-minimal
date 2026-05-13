import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

import {
  CHAT_STORAGE_KEY_PREFIX,
  ChatPage,
  SELECTED_MODEL_STORAGE_KEY,
  getNextThemeLabel
} from './pages/chat'

const TEST_IMAGE_PATH = path.resolve(process.cwd(), 'docs/images/demo.jpg')

const TABLE_PROMPT = [
  'List common HTTP status codes in Markdown.',
  'Start with a heading (## ...).',
  'Include one Markdown table.'
].join('\n')

const CODE_PROMPT = [
  'Explain JavaScript reduce in Markdown.',
  'Start with a heading (## ...).',
  'Include one JavaScript code block.'
].join('\n')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ keyPrefix, selectedModelKey }) => {
    localStorage.removeItem('THEME')
    localStorage.removeItem(selectedModelKey)
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(keyPrefix)) {
        localStorage.removeItem(key)
      }
    }
  }, { keyPrefix: CHAT_STORAGE_KEY_PREFIX, selectedModelKey: SELECTED_MODEL_STORAGE_KEY })
})

async function assertTableMarkdownResponse(page: Page): Promise<void> {
  await expect(page.locator('main h2').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('main table').first()).toBeVisible({ timeout: 10_000 })
}

async function assertCodeMarkdownResponse(page: Page): Promise<void> {
  await expect(page.locator('main h2').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('main pre code').first()).toBeVisible({ timeout: 10_000 })
}

test('D1 — Dark/Light mode toggle (Desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop-only test.')
  const chat = new ChatPage(page)

  await chat.goto()
  await chat.screenshot('D1-initial-mode.png')

  const initialLabel = await chat.getThemeToggleLabel()
  const initialThemeIsDark = await chat.isDarkTheme()

  const labelAfterFirstToggle = getNextThemeLabel(initialLabel)
  await chat.toggleTheme()
  await expect(chat.themeToggleButton).toHaveAttribute('aria-label', labelAfterFirstToggle)
  await expect.poll(() => chat.isDarkTheme()).toBe(!initialThemeIsDark)
  await chat.screenshot('D1-toggled-mode.png')

  const labelAfterSecondToggle = getNextThemeLabel(labelAfterFirstToggle)
  await chat.toggleTheme()
  await expect(chat.themeToggleButton).toHaveAttribute('aria-label', labelAfterSecondToggle)
  await expect.poll(() => chat.isDarkTheme()).toBe(initialThemeIsDark)
  await chat.screenshot('D1-restored-mode.png')
})

test('D2a — Model selector persists selected model (Desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop-only test.')
  const chat = new ChatPage(page)

  await chat.goto()
  await chat.expectSelectedModel('GPT-5.5')

  await chat.selectModel('GPT-5.4 Pro')
  await chat.expectSelectedModel('GPT-5.4 Pro')

  await page.reload()
  await expect(chat.input).toBeVisible()
  await chat.expectSelectedModel('GPT-5.4 Pro')

  await chat.openModelSelector()
  await expect(chat.modelOption('GPT-5.4 Pro')).toHaveAttribute('data-state', 'checked')
})

test('D2 — Chat composer and render table (Desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop-only test.')
  const chat = new ChatPage(page)

  await chat.goto()

  await chat.screenshot('D2-empty-composer.png')
  await expect(chat.sendButton).toBeDisabled()

  await chat.fillMessage(TABLE_PROMPT)
  await expect(chat.sendButton).toBeEnabled()
  await chat.screenshot('D2-table-filled-composer.png')

  await chat.send()
  await expect(page.getByText('List common HTTP status codes in Markdown.')).toBeVisible()

  await expect(chat.stopButton).toBeVisible({ timeout: 15_000 })
  await chat.screenshot('D2-table-streaming.png')

  await chat.waitForStreamingAndCompletion()
  await assertTableMarkdownResponse(page)
  await expect(chat.sendButton).toBeDisabled()
  await chat.screenshot('D2-table-response-complete.png')
})

test('D3 — Chat composer and render code block (Desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop-only test.')
  const chat = new ChatPage(page)

  await chat.goto()
  await chat.fillMessage(CODE_PROMPT)
  await expect(chat.sendButton).toBeEnabled()
  await chat.screenshot('D3-code-filled-composer.png')

  await chat.send()
  await expect(page.getByText('Explain JavaScript reduce in Markdown.')).toBeVisible()

  await expect(chat.stopButton).toBeVisible({ timeout: 15_000 })
  await chat.screenshot('D3-code-streaming.png')

  await chat.waitForStreamingAndCompletion()
  await assertCodeMarkdownResponse(page)
  await expect(chat.sendButton).toBeDisabled()
  await chat.screenshot('D3-code-response-complete.png')
})

test('D4 — Upload image attachment (Desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop-only test.')
  const chat = new ChatPage(page)

  await chat.goto()
  await chat.screenshot('D4-before-image-upload.png')

  await chat.uploadImage(TEST_IMAGE_PATH)

  await chat.expectUploadedPreview('demo.jpg')
  await chat.screenshot('D4-image-uploaded.png')

  await chat.fillMessage('Describe this image in one sentence.')
  await expect(chat.sendButton).toBeEnabled()
  await chat.send()

  await expect(chat.stopButton).toBeVisible({ timeout: 15_000 })
  await chat.screenshot('D4-image-streaming.png')

  await chat.waitForStreamingAndCompletion()
  await expect(page.getByRole('button', { name: 'Copy to clipboard' }).first()).toBeVisible({
    timeout: 10_000
  })
  await chat.screenshot('D4-image-response.png')
})

test('M1 — Mobile layout (Mobile)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only test.')
  const chat = new ChatPage(page)

  await chat.goto()

  await expect(page.getByText('Enter to send · Shift+Enter for new line')).toBeHidden()
  await expect.poll(() => chat.isSingleColumnViewport()).toBe(true)

  await chat.screenshot('M1-mobile-layout.png')
})

test('M2 — Mobile render table (Mobile)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only test.')
  const chat = new ChatPage(page)

  await chat.goto()

  await chat.screenshot('M2-mobile-table-empty.png')
  await expect(chat.sendButton).toBeDisabled()

  await chat.fillMessage(TABLE_PROMPT)
  await expect(chat.sendButton).toBeEnabled()
  await chat.screenshot('M2-mobile-table-filled.png')

  await chat.send()

  await expect(chat.stopButton).toBeVisible({ timeout: 15_000 })
  await chat.screenshot('M2-mobile-table-streaming.png')

  await chat.waitForStreamingAndCompletion()
  await assertTableMarkdownResponse(page)
  await expect(chat.sendButton).toBeDisabled()
  await chat.screenshot('M2-mobile-table-response.png')
})

test('M3 — Mobile render code block (Mobile)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only test.')
  const chat = new ChatPage(page)

  await chat.goto()

  await chat.fillMessage(CODE_PROMPT)
  await expect(chat.sendButton).toBeEnabled()
  await chat.screenshot('M3-mobile-code-filled.png')

  await chat.send()

  await expect(chat.stopButton).toBeVisible({ timeout: 15_000 })
  await chat.screenshot('M3-mobile-code-streaming.png')

  await chat.waitForStreamingAndCompletion()
  await assertCodeMarkdownResponse(page)
  await expect(chat.sendButton).toBeDisabled()
  await chat.screenshot('M3-mobile-code-response.png')
})
