import fs from 'node:fs'
import path from 'node:path'
import { expect, type Locator, type Page } from '@playwright/test'

import { CACHE_KEY } from '../../src/services/constant'

export const CHAT_STORAGE_KEY_PREFIX = CACHE_KEY.chatMessages('')

const SCREENSHOT_DIR = path.resolve(process.cwd(), '_generated/screenshots')

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

export function getNextThemeLabel(currentLabel: string): string {
  if (currentLabel.includes('Light')) {
    return 'Switch to Dark Theme'
  }

  if (currentLabel.includes('Dark')) {
    return 'Switch to Light Theme'
  }

  throw new Error(`Unexpected theme toggle label: ${currentLabel}`)
}

export class ChatPage {
  private readonly page: Page

  readonly input: Locator
  readonly attachButton: Locator
  readonly sendButton: Locator
  readonly stopButton: Locator
  readonly fileInput: Locator
  readonly themeToggleButton: Locator

  constructor(page: Page) {
    this.page = page
    this.input = page.getByRole('textbox', { name: /message input/i })
    this.attachButton = page.getByRole('button', { name: /attach file/i })
    this.sendButton = page.getByRole('button', { name: /send message/i })
    this.stopButton = page.getByRole('button', { name: /stop generating/i })
    this.fileInput = page.locator('input[type="file"][name="attachments"]')
    this.themeToggleButton = page.getByRole('button', { name: /Switch to (Dark|Light) Theme/ })
  }

  async goto(): Promise<void> {
    await this.page.goto('/chat')
    await expect(this.input).toBeVisible()
    await expect(this.attachButton).toBeVisible()
  }

  async screenshot(filename: string): Promise<void> {
    await this.page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true })
  }

  async getThemeToggleLabel(): Promise<string> {
    const label = await this.themeToggleButton.getAttribute('aria-label')
    if (!label) {
      throw new Error('Theme toggle label not found.')
    }

    return label
  }

  async isDarkTheme(): Promise<boolean> {
    return this.page.evaluate(() => document.documentElement.classList.contains('dark'))
  }

  async toggleTheme(): Promise<void> {
    await this.themeToggleButton.click()
  }

  async fillMessage(text: string): Promise<void> {
    await this.input.fill(text)
    await expect(this.input).toHaveValue(text)
  }

  async send(): Promise<void> {
    await this.sendButton.click()
  }

  async uploadImage(filePath: string): Promise<void> {
    await this.fileInput.setInputFiles(filePath)
  }

  async waitForStreamingAndCompletion(): Promise<void> {
    await expect(this.stopButton).toBeVisible({ timeout: 15_000 })
    await expect(this.stopButton).toBeHidden({ timeout: 30_000 })
  }

  async expectUploadedPreview(imageAlt: string): Promise<void> {
    await expect(this.page.getByRole('button', { name: 'Remove image' })).toBeVisible()
    await expect(this.page.locator(`img[alt="${imageAlt}"]`).first()).toBeVisible()
  }

  async isSingleColumnViewport(): Promise<boolean> {
    return this.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  }
}
