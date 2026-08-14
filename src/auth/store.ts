/**
 * Demo account store for dsh-auth: users + session tokens + the
 * registration switch persisted in one JSON file (atomically rewritten).
 * Passwords are salted scrypt hashes; tokens are random and stored only as
 * SHA-256 digests. A default admin account is seeded on first boot and can
 * toggle demo-mode registration on/off. Demo-grade by design: single-process,
 * no migrations, write failures throw (the route answers 500) while memory
 * already holds the mutation.
 */
import {
  createHash, randomBytes, scryptSync, timingSafeEqual,
} from 'node:crypto'
import {
  existsSync, mkdirSync, readFileSync, renameSync, writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

interface StoredUser {
  username: string
  displayName: string
  role: AuthRole
  salt: string
  hash: string
}

interface StoredSession {
  tokenHash: string
  username: string
  expiresAt: number
}

interface StoreFile {
  users: StoredUser[]
  sessions: StoredSession[]
  registrationOpen?: boolean
}

export type AuthRole = 'user' | 'admin'

export interface AuthUser {
  username: string
  displayName: string
  role: AuthRole
}

export interface LoginResult {
  token: string
  user: AuthUser
}

export class AuthError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

/** Built-in admin credentials (demo mode only; documented in the README). */
export const DEFAULT_ADMIN_USERNAME = 'admin'
export const DEFAULT_ADMIN_PASSWORD = 'admin123'

const SCRYPT_KEYLEN = 32

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function deriveHash(password: string, salt: string): string {
  return scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
}

function publicUser(user: StoredUser): AuthUser {
  return { username: user.username, displayName: user.displayName, role: user.role }
}

export class JsonAuthStore {
  private readonly users = new Map<string, StoredUser>()
  private readonly sessions = new Map<string, StoredSession>()
  private registrationOpen = true
  private readonly file: string
  private writeChain: Promise<void> = Promise.resolve()

  constructor(readonly dataDir: string, private readonly sessionTtlMs: number) {
    mkdirSync(dataDir, { recursive: true })
    this.file = join(dataDir, 'auth.json')
    if (existsSync(this.file)) {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as StoreFile
      for (const user of parsed.users) this.users.set(user.username, user)
      for (const session of parsed.sessions) this.sessions.set(session.tokenHash, session)
      if (typeof parsed.registrationOpen === 'boolean') this.registrationOpen = parsed.registrationOpen
    }
    // Seed the built-in admin account on first boot.
    if (!this.users.has(DEFAULT_ADMIN_USERNAME)) {
      const salt = randomBytes(16).toString('hex')
      this.users.set(DEFAULT_ADMIN_USERNAME, {
        username: DEFAULT_ADMIN_USERNAME,
        displayName: '管理员',
        role: 'admin',
        salt,
        hash: deriveHash(DEFAULT_ADMIN_PASSWORD, salt),
      })
      void this.persist()
    }
  }

  /** Register a new account; rejects duplicates and weak credentials. */
  register(username: string, password: string, displayName = ''): Promise<AuthUser> {
    const name = username.trim()
    const label = displayName.trim()
    if (!this.registrationOpen) {
      throw new AuthError('REGISTRATION_CLOSED', '管理员已关闭注册')
    }
    if (!/^[\w.-]{3,64}$/.test(name)) {
      throw new AuthError('INVALID_USERNAME', '用户名需为 3-64 位字母、数字、下划线、点或连字符')
    }
    if (password.length < 6) {
      throw new AuthError('WEAK_PASSWORD', '密码至少需要 6 位')
    }
    if (this.users.has(name)) {
      throw new AuthError('USERNAME_TAKEN', '该用户名已被注册')
    }
    const salt = randomBytes(16).toString('hex')
    const user: StoredUser = {
      username: name,
      displayName: label || name,
      role: 'user',
      salt,
      hash: deriveHash(password, salt),
    }
    this.users.set(name, user)
    return this.persist().then(() => publicUser(user))
  }

  /** Verify credentials and mint a session token. */
  async login(username: string, password: string): Promise<LoginResult> {
    const user = this.users.get(username.trim())
    if (user === undefined) throw new AuthError('INVALID_CREDENTIALS', '用户名或密码不正确')
    const derived = Buffer.from(deriveHash(password, user.salt), 'hex')
    const expected = Buffer.from(user.hash, 'hex')
    if (derived.length !== expected.length || !timingSafeEqual(derived, expected)) {
      throw new AuthError('INVALID_CREDENTIALS', '用户名或密码不正确')
    }
    const token = randomBytes(24).toString('base64url')
    this.sessions.set(hashToken(token), {
      tokenHash: hashToken(token),
      username: user.username,
      expiresAt: Date.now() + this.sessionTtlMs,
    })
    await this.persist()
    return { token, user: publicUser(user) }
  }

  /** Resolve a session token to its user; expired sessions are dropped. */
  async session(token: string): Promise<AuthUser | null> {
    if (token === '') return null
    const session = this.sessions.get(hashToken(token))
    if (session === undefined) return null
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(session.tokenHash)
      await this.persist()
      return null
    }
    const user = this.users.get(session.username)
    return user === undefined ? null : publicUser(user)
  }

  /** Revoke one session token. */
  async logout(token: string): Promise<void> {
    if (token === '') return
    if (this.sessions.delete(hashToken(token))) await this.persist()
  }

  /** Whether demo-mode registration is currently open. */
  get registrationState(): boolean {
    return this.registrationOpen
  }

  /** Admin-only: open or close demo-mode registration. */
  async setRegistrationOpen(open: boolean): Promise<boolean> {
    this.registrationOpen = open
    await this.persist()
    return this.registrationOpen
  }

  /** Admin-only: list every account (public fields only). */
  listUsers(): AuthUser[] {
    return [...this.users.values()]
      .map(publicUser)
      .sort((a, b) => a.username.localeCompare(b.username))
  }

  /** Admin-only: remove one account and its sessions. */
  async deleteUser(username: string): Promise<boolean> {
    const name = username.trim()
    if (name === DEFAULT_ADMIN_USERNAME) {
      throw new AuthError('ADMIN_PROTECTED', '内置管理员账号不可删除')
    }
    const removed = this.users.delete(name)
    for (const [tokenHash, session] of this.sessions) {
      if (session.username === name) this.sessions.delete(tokenHash)
    }
    if (removed) await this.persist()
    return removed
  }

  /** Serialized atomic rewrite of the JSON store. */
  private persist(): Promise<void> {
    const snapshot: StoreFile = {
      users: [...this.users.values()],
      sessions: [...this.sessions.values()],
      registrationOpen: this.registrationOpen,
    }
    const payload = `${JSON.stringify(snapshot, null, 2)}\n`
    this.writeChain = this.writeChain.then(() => {
      const tmp = `${this.file}.tmp`
      writeFileSync(tmp, payload, 'utf8')
      renameSync(tmp, this.file)
    })
    return this.writeChain
  }
}
