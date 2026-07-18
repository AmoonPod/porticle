// @ts-check

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, 'docs', 'assets')
const url = 'http://127.0.0.1:4173'
await mkdir(output, { recursive: true })

const server = spawn(
  process.execPath,
  [
    resolve(root, 'node_modules/vite/bin/vite.js'),
    '--config',
    resolve(root, 'vite.renderer.config.ts')
  ],
  { cwd: root, shell: false, stdio: 'ignore' }
)

try {
  await waitForServer(url)
  const browser = await chromium.launch({ headless: true })
  try {
    await capture(browser, 'dark', 'porticle-dark.png')
    await capture(browser, 'light', 'porticle-light.png', async (page) => {
      await page.getByText(':5173').click()
    })
    await capture(browser, 'dark', 'porticle-preferences.png', async (page) => {
      await page.getByLabel('Preferences').click()
    })
  } finally {
    await browser.close()
  }
} finally {
  server.kill('SIGTERM')
}

process.stdout.write('Captured dark, light, and preferences screenshots.\n')

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {'dark' | 'light'} theme
 * @param {string} filename
 * @param {(page: import('@playwright/test').Page) => Promise<void>} [prepare]
 */
async function capture(browser, theme, filename, prepare) {
  const context = await browser.newContext({
    viewport: { width: 420, height: 640 },
    deviceScaleFactor: 2,
    colorScheme: theme
  })
  const page = await context.newPage()
  await page.goto(`${url}/?theme=${theme}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => globalThis.document.fonts.ready)
  if (prepare) await prepare(page)
  await page.screenshot({ path: resolve(output, filename), fullPage: false })
  await context.close()
}

/** @param {string} target */
async function waitForServer(target) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    try {
      const response = await globalThis.fetch(target)
      if (response.ok) return
    } catch {
      // Vite is still starting.
    }
    await delay(100)
  }
  throw new Error('Timed out waiting for the renderer preview server')
}
