import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

import {
  CHAT_STORAGE_KEY_PREFIX,
  ChatPage,
  getNextThemeLabel,
  SELECTED_MODEL_STORAGE_KEY
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

const TWELVE_LINE_PROMPT = Array.from({ length: 12 }, (_, index) => `Line ${index + 1}`).join('\n')
const ORIGINAL_EDIT_PROMPT = 'Original editable prompt for e2e.'
const FOLLOWUP_EDIT_PROMPT = 'Follow-up prompt that should be removed after edit.'
const EDITED_EDIT_PROMPT = 'Edited replacement prompt for e2e.'
const SEEDED_MATH_MARKDOWN = [
  String.raw`Math check:

\[ Y = \beta_0 + \beta_1X + \varepsilon \]

Inline \( R^2 \) should render too.

$$ \sum_i x_i $$

Currency remains $5 and $10.`,
  'Inline code stays raw: `\\(\\alpha\\)`.'
].join('\n\n')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ keyPrefix, selectedModelKey }) => {
      localStorage.removeItem('THEME')
      localStorage.removeItem(selectedModelKey)
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(keyPrefix)) {
          localStorage.removeItem(key)
        }
      }
    },
    { keyPrefix: CHAT_STORAGE_KEY_PREFIX, selectedModelKey: SELECTED_MODEL_STORAGE_KEY }
  )
})

async function assertTableMarkdownResponse(page: Page): Promise<void> {
  await expect(page.locator('main h2').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('main table').first()).toBeVisible({ timeout: 10_000 })
}

async function assertCodeMarkdownResponse(page: Page): Promise<void> {
  await expect(page.locator('main h2').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('main pre code').first()).toBeVisible({ timeout: 10_000 })
}

async function getComposerTextareaMetrics(chat: ChatPage): Promise<{
  height: number
  maxTenLineHeight: number
  overflowY: string
}> {
  return chat.input.evaluate((element) => {
    const textarea = element as HTMLTextAreaElement
    const styles = window.getComputedStyle(textarea)
    const parsedLineHeight = Number.parseFloat(styles.lineHeight)
    const parsedFontSize = Number.parseFloat(styles.fontSize)
    const lineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : Number.isFinite(parsedFontSize)
        ? parsedFontSize * 1.5
        : 24
    const paddingTop = Number.parseFloat(styles.paddingTop)
    const paddingBottom = Number.parseFloat(styles.paddingBottom)
    const verticalPadding =
      (Number.isFinite(paddingTop) ? paddingTop : 0) +
      (Number.isFinite(paddingBottom) ? paddingBottom : 0)

    return {
      height: textarea.getBoundingClientRect().height,
      maxTenLineHeight: lineHeight * 10 + verticalPadding,
      overflowY: styles.overflowY
    }
  })
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

test('D2b — Chat composer expands up to ten lines (Desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop-only test.')
  const chat = new ChatPage(page)

  await chat.goto()

  const initialMetrics = await getComposerTextareaMetrics(chat)
  await chat.fillMessage(TWELVE_LINE_PROMPT)
  await expect(chat.sendButton).toBeEnabled()

  await expect
    .poll(async () => (await getComposerTextareaMetrics(chat)).height)
    .toBeGreaterThan(initialMetrics.height)

  const expandedMetrics = await getComposerTextareaMetrics(chat)
  expect(expandedMetrics.height).toBeLessThanOrEqual(Math.ceil(expandedMetrics.maxTenLineHeight))
  expect(expandedMetrics.overflowY).toBe('auto')
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

test('D3b — Render safe chat math delimiters (Desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop-only test.')
  await page.addInitScript(
    ({ keyPrefix, markdown }) => {
      localStorage.setItem(
        `${keyPrefix}chat-minimal-session`,
        JSON.stringify([
          {
            id: 'seed-user-math',
            role: 'user',
            parts: [{ type: 'text', text: 'Show math rendering.' }]
          },
          {
            id: 'seed-assistant-math',
            role: 'assistant',
            parts: [{ type: 'text', text: markdown }]
          }
        ])
      )
    },
    { keyPrefix: CHAT_STORAGE_KEY_PREFIX, markdown: SEEDED_MATH_MARKDOWN }
  )

  const chat = new ChatPage(page)
  await chat.goto()

  await expect.poll(() => page.locator('.markdown-body .katex').count()).toBeGreaterThanOrEqual(3)
  await expect
    .poll(() => page.locator('.markdown-body .katex-display').count())
    .toBeGreaterThanOrEqual(2)
  await expect(page.getByText('Currency remains $5 and $10.', { exact: true })).toBeVisible()
  await expect(
    page.locator('.markdown-body code').filter({ hasText: '\\(\\alpha\\)' })
  ).toBeVisible()

  const markdownText = await page.locator('.markdown-body').first().textContent()
  expect(markdownText).not.toContain('\\[')
  expect(markdownText).not.toContain('\\]')
  expect(markdownText).not.toContain('\\( R^2 \\)')
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

test('D5 — Copy and edit sent message (Desktop)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop-only test.')
  await page.context().grantPermissions(['clipboard-write'], { origin: 'http://localhost:3000' })
  const chat = new ChatPage(page)

  await chat.goto()
  await chat.fillMessage(ORIGINAL_EDIT_PROMPT)
  await chat.send()
  await expect(page.getByText(ORIGINAL_EDIT_PROMPT, { exact: true })).toBeVisible()
  await chat.waitForStreamingAndCompletion()

  await expect(chat.sentMessageCopyButton()).toBeVisible()
  await expect(chat.editSentMessageButton()).toBeEnabled()
  await chat.sentMessageCopyButton().click()
  await expect(page.getByRole('button', { name: 'Sent message copied to clipboard' })).toBeVisible()

  await chat.editSentMessageButton().click()
  await expect(chat.input).toHaveValue(ORIGINAL_EDIT_PROMPT)
  await expect(chat.cancelEditButton).toBeVisible()
  await chat.cancelEditButton.click()
  await expect(chat.input).toHaveValue('')
  await expect(page.getByText(ORIGINAL_EDIT_PROMPT, { exact: true })).toBeVisible()

  await chat.fillMessage(FOLLOWUP_EDIT_PROMPT)
  await chat.send()
  await expect(page.getByText(FOLLOWUP_EDIT_PROMPT, { exact: true })).toBeVisible()
  await chat.waitForStreamingAndCompletion()

  await chat.editSentMessageButton().click()
  await expect(chat.input).toHaveValue(ORIGINAL_EDIT_PROMPT)
  await chat.fillMessage(EDITED_EDIT_PROMPT)
  await chat.send()

  await expect(page.getByText(EDITED_EDIT_PROMPT, { exact: true })).toBeVisible()
  await expect(page.getByText(ORIGINAL_EDIT_PROMPT, { exact: true })).toBeHidden()
  await expect(page.getByText(FOLLOWUP_EDIT_PROMPT, { exact: true })).toBeHidden()
  await expect(chat.stopButton).toBeVisible({ timeout: 15_000 })
  await chat.waitForStreamingAndCompletion()
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
