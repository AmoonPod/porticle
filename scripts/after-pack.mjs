// @ts-check

import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Tighten Electron Builder's default macOS plist before fuses and signing.
 * Porticle opens localhost URLs in the user's browser; its own process does not
 * need arbitrary App Transport Security loads or media permission descriptions.
 *
 * @param {import('electron-builder').AfterPackContext} context
 */
export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const plist = resolve(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    'Contents',
    'Info.plist'
  )

  await execFileAsync('/usr/bin/plutil', [
    '-replace',
    'NSAppTransportSecurity.NSAllowsArbitraryLoads',
    '-bool',
    'false',
    plist
  ])
  await execFileAsync('/usr/bin/plutil', [
    '-remove',
    'NSAppTransportSecurity.NSExceptionDomains',
    plist
  ])
}
