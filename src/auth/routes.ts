/**
 * HTTP surface of dsh-auth, registered on ctx.webServer under the
 * /dsh-auth prefix (same origin as the Web UI, so the browser bundle needs
 * no CORS setup). Demo mode talks to the JsonAuthStore; proxy mode forwards
 * method, JSON body, and Authorization header to config.apiBaseUrl.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import type { Config } from '../config.ts'
import { AuthError, JsonAuthStore, type AuthUser } from './store.ts'

const MAX_BODY_BYTES = 16 * 1024

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function sendError(res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { ok: false, error: { code, message } })
}

/** Read and parse a bounded JSON request body. */
function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new AuthError('PAYLOAD_TOO_LARGE', '请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          reject(new AuthError('BAD_REQUEST', '请求体必须是 JSON 对象'))
          return
        }
        resolve(parsed as Record<string, unknown>)
      } catch {
        reject(new AuthError('BAD_REQUEST', '请求体不是合法的 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function bearerToken(req: IncomingMessage): string {
  const header = req.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value : ''
}

async function adminOf(req: IncomingMessage, store: JsonAuthStore): Promise<AuthUser | null> {
  const user = await store.session(bearerToken(req))
  return user !== null && user.role === 'admin' ? user : null
}

function adminError(res: ServerResponse): void {
  sendError(res, 403, 'ADMIN_REQUIRED', '需要管理员账号')
}

function proxyAdminError(res: ServerResponse): void {
  sendError(res, 501, 'ADMIN_IN_PROXY', '代理模式下账号管理由外部服务提供')
}

function routeOf(path: string, apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/+$/u, '')}${path}`
}

/** Forward one request to the configured external auth API and relay it. */
async function proxy(
  req: IncomingMessage,
  res: ServerResponse,
  apiBaseUrl: string,
): Promise<void> {
  const url = routeOf(req.url ?? '', apiBaseUrl)
  const body = await readJson(req)
  const response = await fetch(url, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...req.headers.authorization === undefined
        ? {}
        : { Authorization: req.headers.authorization },
    },
    body: req.method === 'GET' ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    payload = text
  }
  sendJson(res, response.status, payload)
}

/** Register all /dsh-auth routes; returns the combined disposer. */
export function registerAuthRoutes(
  webServer: WebServer,
  store: JsonAuthStore,
  config: Config,
): () => void {
  if (config.mode === 'proxy' && config.apiBaseUrl === '') {
    throw new Error('dsh-auth: mode=proxy requires a non-empty apiBaseUrl')
  }

  const routes = [
    {
      path: '/dsh-auth/register',
      handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (config.mode === 'proxy') return proxy(req, res, config.apiBaseUrl)
        try {
          const body = await readJson(req)
          const user = await store.register(
            stringField(body, 'username'),
            stringField(body, 'password'),
            stringField(body, 'displayName'),
          )
          sendJson(res, 201, { ok: true, user })
        } catch (error) {
          if (error instanceof AuthError) {
            const status = error.code === 'USERNAME_TAKEN'
              ? 409
              : error.code === 'REGISTRATION_CLOSED' ? 403 : 400
            sendError(res, status, error.code, error.message)
          } else {
            sendError(res, 500, 'INTERNAL', '注册失败，请稍后重试')
          }
        }
      },
    },
    {
      path: '/dsh-auth/login',
      handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (config.mode === 'proxy') return proxy(req, res, config.apiBaseUrl)
        try {
          const body = await readJson(req)
          const result = await store.login(
            stringField(body, 'username'),
            stringField(body, 'password'),
          )
          sendJson(res, 200, { ok: true, ...result })
        } catch (error) {
          if (error instanceof AuthError) {
            sendError(res, error.code === 'INVALID_CREDENTIALS' ? 401 : 400, error.code, error.message)
          } else {
            sendError(res, 500, 'INTERNAL', '登录失败，请稍后重试')
          }
        }
      },
    },
    {
      path: '/dsh-auth/session',
      handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (config.mode === 'proxy') return proxy(req, res, config.apiBaseUrl)
        const user = await store.session(bearerToken(req))
        if (user === null) {
          sendError(res, 401, 'UNAUTHENTICATED', '未登录或会话已过期')
          return
        }
        sendJson(res, 200, { ok: true, user })
      },
    },
    {
      path: '/dsh-auth/logout',
      handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (config.mode === 'proxy') return proxy(req, res, config.apiBaseUrl)
        await store.logout(bearerToken(req))
        sendJson(res, 200, { ok: true })
      },
    },
    {
      path: '/dsh-auth/meta',
      handler: async (_req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (config.mode === 'proxy') {
          sendJson(res, 200, { ok: true, mode: 'proxy' })
          return
        }
        sendJson(res, 200, { ok: true, mode: 'demo', registrationOpen: store.registrationState })
      },
    },
    {
      path: '/dsh-auth/admin/users',
      handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (config.mode === 'proxy') return proxyAdminError(res)
        const admin = await adminOf(req, store)
        if (admin === null) return adminError(res)
        sendJson(res, 200, {
          ok: true,
          users: store.listUsers(),
          registrationOpen: store.registrationState,
        })
      },
    },
    {
      path: '/dsh-auth/admin/registration',
      handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (config.mode === 'proxy') return proxyAdminError(res)
        const admin = await adminOf(req, store)
        if (admin === null) return adminError(res)
        try {
          const body = await readJson(req)
          if (typeof body.open !== 'boolean') {
            sendError(res, 400, 'BAD_REQUEST', 'open 必须是布尔值')
            return
          }
          const registrationOpen = await store.setRegistrationOpen(body.open)
          sendJson(res, 200, { ok: true, registrationOpen })
        } catch (error) {
          sendError(res, 500, 'INTERNAL', '更新注册开关失败')
        }
      },
    },
    {
      path: '/dsh-auth/admin/users/remove',
      handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (config.mode === 'proxy') return proxyAdminError(res)
        const admin = await adminOf(req, store)
        if (admin === null) return adminError(res)
        try {
          const body = await readJson(req)
          const removed = await store.deleteUser(stringField(body, 'username'))
          sendJson(res, 200, { ok: true, removed })
        } catch (error) {
          if (error instanceof AuthError) {
            sendError(res, error.code === 'ADMIN_PROTECTED' ? 400 : 404, error.code, error.message)
          } else {
            sendError(res, 500, 'INTERNAL', '删除账号失败')
          }
        }
      },
    },
  ]

  const disposers = routes.map(route => webServer.register({
    kind: 'exact',
    path: route.path,
    handler: route.handler,
  }))
  return () => { for (const dispose of disposers) dispose() }
}
