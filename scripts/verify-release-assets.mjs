// @ts-check

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'

const directory = resolve(process.argv[2] ?? 'artifacts')
const version = process.argv[3]

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('Usage: node scripts/verify-release-assets.mjs <directory> <semver>')
}

const product = 'Porticle'
const expected = [
  `${product}-${version}-mac-arm64.dmg`,
  `${product}-${version}-mac-arm64.zip`,
  `${product}-${version}-mac-arm64.zip.blockmap`,
  `${product}-${version}-mac-x64.dmg`,
  `${product}-${version}-mac-x64.zip`,
  `${product}-${version}-mac-x64.zip.blockmap`,
  `${product}-${version}-windows-arm64.exe`,
  `${product}-${version}-windows-arm64.exe.blockmap`,
  `${product}-${version}-windows-x64.exe`,
  `${product}-${version}-windows-x64.exe.blockmap`,
  `${product}-${version}-macos-sbom.cdx.json`,
  `${product}-${version}-windows-sbom.cdx.json`,
  'latest-mac.yml',
  'latest.yml'
].sort()

const entries = (await readdir(directory)).sort()
const unexpected = entries.filter(
  (entry) => entry !== 'SHA256SUMS.txt' && !expected.includes(entry)
)
const missing = expected.filter((entry) => !entries.includes(entry))
if (missing.length || unexpected.length) {
  throw new Error(
    [
      missing.length ? `Missing release assets: ${missing.join(', ')}` : '',
      unexpected.length ? `Unexpected release assets: ${unexpected.join(', ')}` : ''
    ]
      .filter(Boolean)
      .join('\n')
  )
}

const manifestAssets = {
  'latest-mac.yml': [
    `${product}-${version}-mac-arm64.dmg`,
    `${product}-${version}-mac-arm64.zip`,
    `${product}-${version}-mac-x64.dmg`,
    `${product}-${version}-mac-x64.zip`
  ].sort(),
  'latest.yml': [
    `${product}-${version}-windows-arm64.exe`,
    `${product}-${version}-windows-x64.exe`
  ].sort()
}

for (const [manifestName, requiredAssets] of Object.entries(manifestAssets)) {
  const manifest = parseUpdateManifest(
    await readFile(resolve(directory, manifestName), 'utf8'),
    manifestName
  )
  if (manifest.version !== version) {
    throw new Error(`${manifestName} describes ${manifest.version}, expected ${version}.`)
  }

  const declaredAssets = manifest.files.map(({ url }) => url).sort()
  if (JSON.stringify(declaredAssets) !== JSON.stringify(requiredAssets)) {
    throw new Error(
      `${manifestName} has an unexpected asset set.\nExpected: ${requiredAssets.join(', ')}\nActual: ${declaredAssets.join(', ')}`
    )
  }

  for (const file of manifest.files) {
    if (basename(file.url) !== file.url || !entries.includes(file.url)) {
      throw new Error(`${manifestName} references invalid or missing asset ${file.url}.`)
    }
    const path = resolve(directory, file.url)
    const metadata = await stat(path)
    if (!metadata.isFile() || metadata.size !== file.size) {
      throw new Error(
        `${manifestName} size mismatch for ${file.url}: expected ${file.size}, got ${metadata.size}.`
      )
    }
    const digest = await digestFile(path, 'sha512', 'base64')
    if (digest !== file.sha512) {
      throw new Error(`${manifestName} SHA-512 mismatch for ${file.url}.`)
    }
  }

  const primary = manifest.files.find(({ url }) => url === manifest.path)
  if (!primary || primary.sha512 !== manifest.sha512) {
    throw new Error(`${manifestName} primary path or SHA-512 does not match its files entry.`)
  }
  const expectedPrimaryExtension = manifestName === 'latest-mac.yml' ? '.zip' : '.exe'
  if (!manifest.path.endsWith(expectedPrimaryExtension)) {
    throw new Error(
      `${manifestName} primary updater payload must end in ${expectedPrimaryExtension}.`
    )
  }
}

const checksumLines = []
for (const name of expected) {
  const path = resolve(directory, name)
  if (!(await stat(path)).isFile()) throw new Error(`Release asset is not a file: ${name}`)
  const digest = await digestFile(path, 'sha256', 'hex')
  checksumLines.push(`${digest}  ${basename(name)}`)
}
await writeFile(resolve(directory, 'SHA256SUMS.txt'), `${checksumLines.join('\n')}\n`)
process.stdout.write(
  `Verified ${expected.length} Porticle release assets and wrote SHA256SUMS.txt.\n`
)

/**
 * @param {string} source
 * @param {string} name
 * @returns {{version: string, files: Array<{url: string, sha512: string, size: number}>, path: string, sha512: string}}
 */
function parseUpdateManifest(source, name) {
  /** @type {string | undefined} */
  let version
  /** @type {string | undefined} */
  let path
  /** @type {string | undefined} */
  let sha512
  /** @type {Array<{url: string, sha512: string, size: number}>} */
  const files = []
  /** @type {Partial<{url: string, sha512: string, size: number}> | undefined} */
  let currentFile

  for (const line of source.split(/\r?\n/)) {
    const versionMatch = /^version:\s*(.+?)\s*$/.exec(line)
    if (versionMatch?.[1]) version = scalar(versionMatch[1])

    const urlMatch = /^ {2}- url:\s*(.+?)\s*$/.exec(line)
    if (urlMatch?.[1]) {
      if (currentFile) files.push(completeManifestFile(currentFile, name))
      currentFile = { url: scalar(urlMatch[1]) }
      continue
    }

    const fileDigestMatch = /^ {4}sha512:\s*(.+?)\s*$/.exec(line)
    if (fileDigestMatch?.[1] && currentFile) {
      currentFile.sha512 = scalar(fileDigestMatch[1])
      continue
    }

    const sizeMatch = /^ {4}size:\s*(\d+)\s*$/.exec(line)
    if (sizeMatch?.[1] && currentFile) {
      currentFile.size = Number(sizeMatch[1])
      continue
    }

    const pathMatch = /^path:\s*(.+?)\s*$/.exec(line)
    if (pathMatch?.[1]) path = scalar(pathMatch[1])
    const digestMatch = /^sha512:\s*(.+?)\s*$/.exec(line)
    if (digestMatch?.[1]) sha512 = scalar(digestMatch[1])
  }
  if (currentFile) files.push(completeManifestFile(currentFile, name))

  if (!version || !path || !sha512 || files.length === 0) {
    throw new Error(`${name} is missing required updater metadata.`)
  }
  if (new Set(files.map(({ url }) => url)).size !== files.length) {
    throw new Error(`${name} contains duplicate updater assets.`)
  }
  return { version, files, path, sha512 }
}

/**
 * @param {Partial<{url: string, sha512: string, size: number}>} file
 * @param {string} manifestName
 */
function completeManifestFile(file, manifestName) {
  if (
    !file.url ||
    !file.sha512 ||
    file.size === undefined ||
    !Number.isSafeInteger(file.size) ||
    file.size <= 0
  ) {
    throw new Error(`${manifestName} contains an incomplete files entry.`)
  }
  return { url: file.url, sha512: file.sha512, size: file.size }
}

/** @param {string} value */
function scalar(value) {
  const trimmed = value.trim()
  const quote = trimmed[0]
  if (quote === "'" || quote === '"') {
    if (!trimmed.endsWith(quote)) throw new Error(`Unterminated quoted manifest value: ${value}`)
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/**
 * @param {string} path
 * @param {'sha256' | 'sha512'} algorithm
 * @param {'hex' | 'base64'} encoding
 */
async function digestFile(path, algorithm, encoding) {
  const digest = createHash(algorithm)
  for await (const chunk of /** @type {AsyncIterable<Buffer>} */ (createReadStream(path))) {
    digest.update(chunk)
  }
  return digest.digest(encoding)
}
