/**
 * dsh-auth browser half: registers the sidebar trigger and the
 * overlay modal, sharing one auth store handle between them. The trigger
 * lives in `sidebar.footer.action`; the window itself floats on the
 * frame-wide `shell.overlay` layer, both declared by ui-layout. Wait on the
 * declarations with slots.inject so activation order never matters.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls ctx.locale into this program.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings SlotMap merge ('settings.general.item').
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { AccountManagementRow } from './AccountManagementRow.tsx'
import { AuthModal, type AuthModalInjected } from './AuthModal.tsx'
import { AuthTrigger } from './AuthTrigger.tsx'
import { createAuthApi } from './api.ts'
import { createAuthStore } from './authStore.ts'
import { en, NS, zh, type AuthKey } from './locales.ts'
import { CSS, STYLE_ID } from './styles.ts'

export type { AuthModalInjected } from './AuthModal.tsx'
export type { AuthUser, AuthState } from './authStore.ts'
export type { AuthApi } from './api.ts'
export type { AuthKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Auth surfaces copy (sidebar trigger + modal). */
    auth: AuthKey
  }
}

/** Required services: slot registry + locale dictionaries. */
export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-auth: dictionaries')

  ctx.effect(() => {
    if (document.getElementById(STYLE_ID) !== null) return () => undefined
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = CSS
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'dsh-auth: styles')

  // One shared store handle: both entries read/write the same instance.
  const authStore = createAuthStore()
  const api = createAuthApi()

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'auth-window',
    order: 90,
    locale: NS,
    store: authStore,
  }, AuthTrigger))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'auth-window-modal',
    order: 100,
    locale: NS,
    store: authStore,
    inject: (actions: BoundActions<typeof authStore>): AuthModalInjected => {
      // Restore a persisted session once the store instance exists.
      void api.restore().then(
        restored => { actions.setUser(restored) },
        () => { actions.setUser(null) },
      )
      return { api }
    },
  }, AuthModal))

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'dsh-auth-account-management',
    order: 20,
    locale: NS,
    store: authStore,
    inject: (): AuthModalInjected => ({ api }),
  }, AccountManagementRow))
}
