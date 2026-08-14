/**
 * Plugin configuration, validated by Schemastery. Defaults ship demo mode:
 * the host stores accounts in a local JSON file and mints its own session
 * tokens. Set `mode: proxy` (plus `apiBaseUrl`) to forward every /dsh-auth
 * request to your own account backend instead.
 */
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  /** demo: built-in local account store. proxy: forward to apiBaseUrl. */
  mode: 'demo' | 'proxy'
  /** Base URL of the external auth API used in proxy mode. */
  apiBaseUrl: string
  /** Where demo mode keeps its JSON store; empty = under the profile data dir. */
  dataDir: string
  /** Session token lifetime in hours (demo mode). */
  sessionTtlHours: number
}

export const Config = Schema.object({
  mode: Schema.union(['demo', 'proxy']).default('demo'),
  apiBaseUrl: Schema.string().default(''),
  dataDir: Schema.string().default(''),
  sessionTtlHours: Schema.natural().min(1).default(24 * 7),
})
