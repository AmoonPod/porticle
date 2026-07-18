// @ts-check

import { access, readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

const root = resolve(import.meta.dirname, '..')
const preload = resolve(root, 'out', 'preload', 'index.cjs')
const mainBundle = resolve(root, 'out', 'main', 'index.js')
const rendererHtml = resolve(root, 'out', 'renderer', 'index.html')
const rendererAssets = ['favicon.svg', 'favicon-32x32.png', 'favicon.ico', 'apple-touch-icon.png']
const MAX_RENDERER_JAVASCRIPT_BYTES = 700_000

await access(preload)
const mainSource = await readFile(mainBundle, 'utf8')
if (!mainSource.includes('../preload/index.cjs')) {
  throw new Error('The main bundle does not reference the sandbox-compatible preload artifact.')
}
const preloadSource = await readFile(preload, 'utf8')
const disallowedRequire = /require\(["'](?!electron["'])/.exec(preloadSource)
if (disallowedRequire) {
  throw new Error(`The sandboxed preload contains a disallowed dependency: ${disallowedRequire[0]}`)
}

const rendererSource = await readFile(rendererHtml, 'utf8')
for (const asset of rendererAssets) {
  await access(resolve(root, 'out', 'renderer', asset))
  if (!rendererSource.includes(`/${asset}`)) {
    throw new Error(`The renderer does not reference its generated ${asset} asset.`)
  }
}

const builtFiles = await walk(resolve(root, 'out'))
const sourceMaps = builtFiles.filter((file) => file.endsWith('.map'))
if (sourceMaps.length) {
  throw new Error(`Production output contains source maps: ${sourceMaps.join(', ')}`)
}
const rendererJavaScript = builtFiles.filter(
  (file) => file.startsWith(resolve(root, 'out', 'renderer')) && file.endsWith('.js')
)
const rendererJavaScriptBytes = (
  await Promise.all(rendererJavaScript.map(async (file) => (await stat(file)).size))
).reduce((total, size) => total + size, 0)
if (rendererJavaScriptBytes > MAX_RENDERER_JAVASCRIPT_BYTES) {
  throw new Error(
    `Renderer JavaScript is ${rendererJavaScriptBytes} bytes; budget is ${MAX_RENDERER_JAVASCRIPT_BYTES}.`
  )
}

process.stdout.write(
  `Verified packaged preload, renderer icons, and ${rendererJavaScriptBytes}-byte JavaScript budget.\n`
)

/**
 * @param {string} directory
 * @returns {Promise<string[]>}
 */
async function walk(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(path)))
    else files.push(path)
  }
  return files
}
