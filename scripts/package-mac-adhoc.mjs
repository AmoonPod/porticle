// @ts-check

import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

if (process.platform !== 'darwin') {
  throw new Error('Ad-hoc macOS packaging can only run on macOS.')
}

const root = resolve(import.meta.dirname, '..')
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Run this script through npm: npm run package:mac:adhoc')

const appDirectory = resolve(
  root,
  'release',
  process.arch === 'x64' ? 'mac' : `mac-${process.arch}`
)
await rm(appDirectory, { recursive: true, force: true })
await run(process.execPath, [npmCli, 'run', 'build'])
await run(
  process.execPath,
  [
    resolve(root, 'node_modules/electron-builder/cli.js'),
    '--mac',
    'dir',
    `--${process.arch}`,
    '--publish',
    'never'
  ],
  { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
)
await run('/usr/bin/codesign', [
  '--force',
  '--deep',
  '--sign',
  '-',
  resolve(appDirectory, 'Porticle.app')
])
await run('/usr/bin/codesign', [
  '--verify',
  '--deep',
  '--strict',
  resolve(appDirectory, 'Porticle.app')
])

process.stdout.write(`Ad-hoc package ready at ${resolve(appDirectory, 'Porticle.app')}\n`)

/**
 * @param {string} executable
 * @param {readonly string[]} args
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<void>}
 */
function run(executable, args, env = process.env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, { cwd: root, env, shell: false, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${executable} exited with ${code ?? signal ?? 'an unknown error'}`))
    })
  })
}
