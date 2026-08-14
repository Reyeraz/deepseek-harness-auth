/**
 * dsh-auth host half: registers the /dsh-auth HTTP surface on the
 * harness web server. The browser half (src/client) is discovered through
 * the package's dsh.client declaration.
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { registerAuthRoutes } from './auth/routes.ts'
import { JsonAuthStore } from './auth/store.ts'
import { Config, type Config as ConfigShape } from './config.ts'

export { Config }
export type { Config as ConfigType } from './config.ts'

export const name = 'dsh-auth'

/** The web server route registry ships with the Web composition. */
export const inject = ['webServer']

export function apply(ctx: Context, config: ConfigShape): void {
  // ctx.baseUrl is the cordis.yml directory and may arrive as a file: URL.
  const baseDir = ctx.baseUrl === undefined
    ? process.cwd()
    : ctx.baseUrl.startsWith('file:') ? fileURLToPath(ctx.baseUrl) : ctx.baseUrl
  const dataDir = config.dataDir !== '' ? config.dataDir : join(baseDir, 'data', 'dsh-auth')
  const store = new JsonAuthStore(dataDir, config.sessionTtlHours * 60 * 60 * 1000)
  ctx.effect(
    () => registerAuthRoutes(ctx.webServer, store, config),
    'dsh-auth: /dsh-auth routes',
  )
}
