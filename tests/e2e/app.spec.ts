import { expect, test } from '@playwright/test'

test('search, expand, and filter stay inside the compact workflow', async ({ page }) => {
  await page.goto('/?theme=dark')
  await expect(page.getByText('PORTICLE').first()).toBeVisible()
  await expect(page.getByText(':5173')).toBeVisible()

  const search = page.getByLabel('Search ports')
  await page.getByRole('button', { name: 'Focus port search (Command K)' }).click()
  await expect(search).toBeFocused()
  await search.fill('redis')
  await expect(page.getByText(':6379')).toBeVisible()
  await expect(page.getByText(':5173')).toBeHidden()
  await page.getByLabel('Clear search').click()

  await page.getByText(':5173').click()
  await expect(
    page.getByText('node ./node_modules/vite/bin/vite.js --host 127.0.0.1')
  ).toBeVisible()

  await page.getByRole('button', { name: 'UDP' }).click()
  await expect(page.getByText(':5353')).toBeVisible()
  await expect(page.getByText(':5173')).toBeHidden()
})

test('preferences expose only workflow-critical controls', async ({ page }) => {
  await page.goto('/?theme=light')
  await page.getByLabel('Preferences').click()
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible()
  await expect(page.getByText('Refresh')).toBeVisible()
  await expect(page.getByText('Force fallback')).toBeVisible()
  await expect(page.getByText('Global shortcut')).toBeVisible()
  await expect(page.getByText('Watched-port notifications')).toBeVisible()
})
