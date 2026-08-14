/**
 * Browser-side auth client: talks to the plugin's own /dsh-auth routes on
 * the harness web server (same origin, no CORS). The token is kept in
 * localStorage; the user object lives in the shared auth store.
 */
import { TOKEN_KEY, type AuthUser } from './authStore.ts'

export interface AuthApi {
  login(username: string, password: string): Promise<AuthUser>
  register(username: string, password: string, displayName: string): Promise<void>
  logout(): Promise<void>
  restore(): Promise<AuthUser | null>
  meta(): Promise<AuthMeta>
  adminUsers(): Promise<AdminSnapshot>
  setRegistration(open: boolean): Promise<void>
  deleteUser(username: string): Promise<void>
}

export interface AuthMeta {
  mode: 'demo' | 'proxy'
  /** Demo mode only; null in proxy mode (unknown/owned by the external service). */
  registrationOpen: boolean | null
}

export interface AdminSnapshot {
  users: AuthUser[]
  registrationOpen: boolean
}

interface ApiErrorBody {
  ok?: boolean
  error?: { code?: string; message?: string }
}

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeToken(token: string): void {
  try {
    if (token === '') localStorage.removeItem(TOKEN_KEY)
    else localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Storage unavailable (private mode): session survives the page only.
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string },
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/dsh-auth${path}`, {
      method: options.method ?? 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` },
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new Error('network')
  }
  const payload = await response.json().catch(() => ({})) as T & ApiErrorBody
  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'request-failed')
  }
  return payload
}

export function createAuthApi(): AuthApi {
  return {
    async login(username, password) {
      const result = await request<{ token: string; user: AuthUser }>('/login', {
        body: { username, password },
      })
      writeToken(result.token)
      return result.user
    },
    async register(username, password, displayName) {
      await request<{ ok: boolean }>('/register', {
        body: { username, password, displayName },
      })
    },
    async logout() {
      const token = readToken()
      if (token !== '') await request<{ ok: boolean }>('/logout', { token })
      writeToken('')
    },
    async restore() {
      const token = readToken()
      if (token === '') return null
      try {
        const result = await request<{ user: AuthUser }>('/session', { token })
        return result.user
      } catch {
        writeToken('')
        return null
      }
    },
    async meta() {
      const result = await request<{ mode: 'demo' | 'proxy'; registrationOpen?: boolean }>('/meta', {
        method: 'GET',
      })
      return {
        mode: result.mode,
        registrationOpen: result.registrationOpen ?? null,
      }
    },
    async adminUsers() {
      const result = await request<{ users: AuthUser[]; registrationOpen: boolean }>('/admin/users', {
        token: readToken(),
      })
      return { users: result.users, registrationOpen: result.registrationOpen }
    },
    async setRegistration(open) {
      await request<{ ok: boolean }>('/admin/registration', {
        body: { open },
        token: readToken(),
      })
    },
    async deleteUser(username) {
      await request<{ ok: boolean }>('/admin/users/remove', {
        body: { username },
        token: readToken(),
      })
    },
  }
}
