import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const execute = promisify(execFile)
const version = '0.1.0'
const product = 'Porticle'
const assets = [
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
  `${product}-${version}-windows-sbom.cdx.json`
]

describe('release asset verifier', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(resolve(tmpdir(), 'porticle-release-'))
    await createFixture(directory)
  })

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true })
  })

  it('accepts complete manifests and writes deterministic checksums', async () => {
    await execute(process.execPath, ['scripts/verify-release-assets.mjs', directory, version])

    const checksums = (await readFile(resolve(directory, 'SHA256SUMS.txt'), 'utf8'))
      .trim()
      .split('\n')
    expect(checksums).toHaveLength(14)
    expect(checksums.map((line) => line.slice(66))).toEqual(
      [...assets, 'latest-mac.yml', 'latest.yml'].sort()
    )
  })

  it('rejects an updater payload changed after its manifest was generated', async () => {
    await writeFile(resolve(directory, `${product}-${version}-mac-arm64.zip`), 'tampered')

    await expect(
      execute(process.execPath, ['scripts/verify-release-assets.mjs', directory, version])
    ).rejects.toThrow(/size mismatch|SHA-512 mismatch/)
  })
})

async function createFixture(directory: string) {
  for (const name of assets) await writeFile(resolve(directory, name), `fixture:${name}`)

  await writeManifest(
    directory,
    'latest-mac.yml',
    assets.filter((name) => /-mac-(?:arm64|x64)\.(?:dmg|zip)$/.test(name)),
    `${product}-${version}-mac-x64.zip`
  )
  await writeManifest(
    directory,
    'latest.yml',
    assets.filter((name) => /-windows-(?:arm64|x64)\.exe$/.test(name)),
    `${product}-${version}-windows-x64.exe`
  )
}

async function writeManifest(
  directory: string,
  manifestName: string,
  names: string[],
  primaryName: string
) {
  const records = await Promise.all(
    names.map(async (name) => {
      const content = await readFile(resolve(directory, name))
      return {
        name,
        sha512: createHash('sha512').update(content).digest('base64'),
        size: content.byteLength
      }
    })
  )
  const primary = records.find(({ name }) => name === primaryName)
  if (!primary) throw new Error(`Missing primary fixture ${primaryName}.`)

  const manifest = [
    `version: ${version}`,
    'files:',
    ...records.flatMap(({ name, sha512, size }) => [
      `  - url: ${name}`,
      `    sha512: ${sha512}`,
      `    size: ${size}`
    ]),
    `path: ${primary.name}`,
    `sha512: ${primary.sha512}`,
    "releaseDate: '2026-07-18T00:00:00.000Z'",
    ''
  ].join('\n')
  await writeFile(resolve(directory, manifestName), manifest)
}
