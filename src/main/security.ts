import { app, net, protocol, session } from 'electron'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const APP_SCHEME = 'porticle'
export const APP_ORIGIN = `${APP_SCHEME}://app`

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
      stream: true
    }
  }
])

export function installAppProtocol(rendererRoot: string): void {
  if (!app.isPackaged) return
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host !== 'app') return new Response('Not found', { status: 404 })
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const target = resolve(rendererRoot, `.${pathname}`)
    const root = resolve(rendererRoot)
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      return new Response('Forbidden', { status: 403 })
    }
    return net.fetch(pathToFileURL(target).toString())
  })
}

export function hardenSession(): void {
  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  const development = !app.isPackaged && Boolean(developmentUrl)
  const csp = development
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' http://127.0.0.1:* http://localhost:*",
        "style-src 'self' 'unsafe-inline' http://127.0.0.1:* http://localhost:*",
        "font-src 'self' data: http://127.0.0.1:* http://localhost:*",
        "img-src 'self' data:",
        "connect-src 'self' ws://127.0.0.1:* ws://localhost:* http://127.0.0.1:* http://localhost:*",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-src 'none'",
        "form-action 'none'"
      ].join('; ')
    : [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data:",
        "connect-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-src 'none'",
        "form-action 'none'"
      ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler(() => false)
}

export function isAllowedRendererUrl(value: string): boolean {
  if (value.startsWith(`${APP_ORIGIN}/`) || value === APP_ORIGIN) return true
  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && developmentUrl) {
    try {
      return new URL(value).origin === new URL(developmentUrl).origin
    } catch {
      return false
    }
  }
  return false
}
