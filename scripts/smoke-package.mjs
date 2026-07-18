// @ts-check

import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'

const executable = process.env.PORTICLE_PACKAGE_EXECUTABLE
if (!executable) {
  throw new Error('Set PORTICLE_PACKAGE_EXECUTABLE to a packaged Porticle executable.')
}

const userData = await mkdtemp(join(tmpdir(), 'porticle-package-smoke-'))
/** @type {string[]} */
const output = []
const child = spawn(resolve(executable), [`--user-data-dir=${userData}`], {
  env: { ...process.env, NODE_ENV: 'test' },
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe']
})

if (child.stdout) capture(child.stdout)
if (child.stderr) capture(child.stderr)

/** @type {Promise<{ code: number | null, signal: NodeJS.Signals | null }>} */
const exit = new Promise((resolveExit, reject) => {
  child.once('error', reject)
  child.once('exit', (code, signal) => resolveExit({ code, signal }))
})

try {
  const outcome = await Promise.race([exit, setTimeout(5_000, 'running')])
  if (outcome !== 'running') {
    throw new Error(
      `Porticle exited during package smoke test: ${JSON.stringify(outcome)}\n${output.join('')}`
    )
  }
  process.stdout.write(
    'Packaged Porticle remained healthy for the five-second launch smoke test.\n'
  )
} finally {
  child.kill()
  await Promise.race([exit, setTimeout(5_000)])
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  await rm(userData, { recursive: true, force: true })
}

/**
 * @param {import('node:stream').Readable} stream
 */
function capture(stream) {
  stream.setEncoding('utf8')
  stream.on('data', (/** @type {string} */ chunk) => output.push(chunk))
}
