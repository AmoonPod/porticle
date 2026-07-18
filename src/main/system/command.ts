import { spawn } from 'node:child_process'

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number | null
  signal: NodeJS.Signals | null
}

export interface CommandOptions {
  timeoutMs?: number
  maxOutputBytes?: number
  env?: NodeJS.ProcessEnv
}

export class CommandError extends Error {
  readonly code: 'spawn' | 'timeout' | 'output-limit'

  constructor(code: CommandError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CommandError'
    this.code = code
  }
}

export function runCommand(
  executable: string,
  args: readonly string[],
  options: CommandOptions = {}
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? 5_000
  const maxOutputBytes = options.maxOutputBytes ?? 8 * 1024 * 1024

  return new Promise((resolve, reject) => {
    const child = spawn(executable, [...args], {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env
    })

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let outputBytes = 0
    let settled = false

    const finishWithError = (error: CommandError): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill('SIGKILL')
      reject(error)
    }

    const collect = (target: Buffer[], chunk: Buffer): void => {
      outputBytes += chunk.byteLength
      if (outputBytes > maxOutputBytes) {
        finishWithError(
          new CommandError('output-limit', `${executable} exceeded its output safety limit`)
        )
        return
      }
      target.push(chunk)
    }

    child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk))
    child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk))

    child.once('error', (cause) => {
      finishWithError(new CommandError('spawn', `Could not start ${executable}`, { cause }))
    })

    child.once('close', (exitCode, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        exitCode,
        signal
      })
    })

    const timer = setTimeout(() => {
      finishWithError(new CommandError('timeout', `${executable} timed out after ${timeoutMs} ms`))
    }, timeoutMs)
    timer.unref()
  })
}
